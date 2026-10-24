import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { platformEmail } from '@/features/platform-admin/credentials';
import { organizationEmailBranding } from '@/features/email-integration/test-email-template';
import { HR_EMAIL_TYPES, renderHrEmail, type HrEmailDetails } from '@/features/email-integration/hr-templates';
import type { EmailActor } from '@/features/email-integration/service';
import { sendRenderedHrEmail } from '@/lib/email/hr';
import { sendEmail } from '@/lib/email';
import { publicOrigin } from '@/lib/tenant/host';

const requestSchema = z.object({ applicationId: z.string().min(1).max(100), type: z.enum(HR_EMAIL_TYPES), interviewId: z.string().max(100).optional(), instructions: z.string().trim().max(4000).optional() }).strict();
export type HrWorkflowRequest = z.infer<typeof requestSchema>;
export class HrWorkflowError extends Error {}
const fail = (message: string): never => { throw new HrWorkflowError(message); };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mutable = ['DRAFT', 'FAILED'];

async function authorize(db: PrismaClient, actor: EmailActor) {
  if (!await db.user.findFirst({ where: { id: actor.userId, organizationId: actor.organizationId, role: { in: ['HR_ADMIN', 'ORGANIZATION_ADMIN'] } }, select: { id: true } })) fail('Only this organization’s HR Administrators can send HR emails.');
}

async function compose(db: PrismaClient, actor: EmailActor, raw: unknown) {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return fail('Choose an email type and application. Instructions must be at most 4,000 characters.');
  const input = parsed.data;
  if (input.type !== 'onboarding' && input.instructions) fail('Additional onboarding instructions belong to the onboarding email only.');
  const app = await db.application.findFirst({ where: { id: input.applicationId, job: { organizationId: actor.organizationId } }, include: {
    applicant: true, job: { include: { organization: { select: { slug: true, contactEmail: true } } } },
    interviews: { orderBy: { scheduledAt: 'desc' }, include: { interviewer: { select: { name: true, organizationId: true } } } },
    offers: { orderBy: { createdAt: 'desc' }, include: { approvedBy: { select: { organizationId: true } } } },
    onboarding: { include: { tasks: { orderBy: { createdAt: 'asc' } } } }, employee: true,
  } });
  if (!app) return fail('Application unavailable in this organization.');
  const terminal = ['REJECTED', 'WITHDRAWN'].includes(app.status);
  const details: HrEmailDetails = { recipientName: `${app.applicant.firstName} ${app.applicant.lastName}`, jobTitle: app.job.title,
    portalUrl: `${publicOrigin()}/careers/${app.job.organization.slug}/portal/${app.id}`,
    contactEmail: platformEmail.safeParse(app.job.organization.contactEmail).success ? app.job.organization.contactEmail! : undefined,
  };
  let eventKey = `${app.id}:${input.type}`;
  if (input.type === 'acknowledgment' && (terminal || app.status === 'HIRED')) fail('Acknowledgment is available for active applications before hiring.');
  if (input.type === 'interview') {
    const interview = app.interviews.find(item => item.id === input.interviewId);
    if (terminal || app.status === 'HIRED' || !interview || interview.status !== 'SCHEDULED' || interview.scheduledAt <= new Date() || interview.interviewer.organizationId !== actor.organizationId) return fail('Select a future scheduled interview belonging to this application and organization.');
    Object.assign(details, { scheduledAt: interview.scheduledAt.toISOString(), durationMinutes: interview.durationMinutes, location: interview.location || undefined, meetingUrl: interview.meetingUrl || undefined, interviewerName: interview.interviewer.name });
    // A rescheduled interview is a new invitation; ordinary retries are not.
    eventKey += `:${interview.id}:${interview.scheduledAt.toISOString()}`;
  }
  const approvedOffer = app.offers.find(offer => ['APPROVED', 'SENT', 'ACCEPTED'].includes(offer.status) && offer.approvedBy?.organizationId === actor.organizationId && (offer.status === 'ACCEPTED' || !offer.expirationDate || offer.expirationDate > new Date()));
  if (input.type === 'acceptance') {
    if (!['OFFER', 'HIRED'].includes(app.status) || !approvedOffer) return fail('A current approved offer and an application at Offer or Hired are required before notifying a successful applicant.');
    details.startDate = approvedOffer.startDate.toISOString();
    eventKey += `:${approvedOffer.id}`;
  }
  if (input.type === 'rejection' && app.status !== 'REJECTED') fail('Record the rejection through the existing status workflow before sending its notification.');
  if (input.type === 'onboarding') {
    if (terminal || !['OFFER', 'HIRED'].includes(app.status) || !app.offers.some(offer => offer.status === 'ACCEPTED') || !app.onboarding || !['NOT_STARTED', 'IN_PROGRESS'].includes(app.onboarding.status)) return fail('An accepted offer and an active onboarding process are required before sending onboarding instructions.');
    if (app.employee) {
      if (app.employee.organizationId !== actor.organizationId) return fail('Employee unavailable in this organization.');
      details.recipientName = `${app.employee.firstName} ${app.employee.lastName}`;
    }
    details.startDate = app.onboarding.startDate.toISOString();
    details.instructions = app.onboarding.tasks.filter(task => !['VERIFIED', 'WAIVED'].includes(task.status)).map(task => `${task.title}${task.dueDate ? ' — due ' + task.dueDate.toISOString().slice(0, 10) : ''}`);
    if (input.instructions) details.instructions.push(input.instructions);
    eventKey += `:${app.onboarding.id}`;
  }
  const recipient = platformEmail.safeParse(input.type === 'onboarding' && app.employee ? app.employee.email : app.applicant.email);
  if (!recipient.success) return fail('The saved applicant or employee email address is invalid. Correct it through the existing record workflow first.');
  const branding = await organizationEmailBranding(db, actor.organizationId);
  const message = { ...renderHrEmail(branding, input.type, details), to: recipient.data };
  const connection = await db.organizationEmailIntegration.findUnique({ where: { organizationId: actor.organizationId }, select: { email: true, status: true, generation: true, recruitmentGmailActive: true } });
  const legacy = branding.slug === 'st-aloysius' && !connection?.recruitmentGmailActive;
  const sender = { mode: legacy ? 'legacy' as const : 'gmail' as const, email: legacy ? process.env.EMAIL_FROM || process.env.GMAIL_USER || 'no-reply@workpulse.saga.edu' : connection?.email || '', generation: connection?.generation ?? 0, status: legacy ? 'LEGACY' : connection?.status || 'DISCONNECTED' };
  const contentHash = digest({ eventKey, type: input.type, applicationStatus: app.status, to: message.to, subject: message.subject, html: message.html, text: message.text, logo: message.inlineLogo ? digest(message.inlineLogo.content.toString('base64')) : null, sender });
  return { input, eventKey, message, sender, contentHash };
}

export async function prepareHrWorkflow(actor: EmailActor, input: unknown, db: PrismaClient = prisma) {
  await authorize(db, actor);
  const preview = await compose(db, actor, input);
  const row = await db.hrEmailDelivery.upsert({ where: { organizationId_eventKey: { organizationId: actor.organizationId, eventKey: preview.eventKey } }, create: {
    organizationId: actor.organizationId, applicationId: preview.input.applicationId, actorId: actor.userId, eventKey: preview.eventKey, type: preview.input.type, recipient: preview.message.to, contentHash: preview.contentHash,
  }, update: {} });
  if (!mutable.includes(row.status)) fail(row.status === 'SUBMITTED' ? 'This email has already been submitted. Duplicate sending is blocked.' : 'A send is in progress or delivery is uncertain. Check the sending account before taking further action; duplicate sending is blocked.');
  if (row.attemptCount >= 5) fail('The maximum of five confirmed attempts has been reached. Ask your administrator to review delivery.');
  const updated = await db.hrEmailDelivery.updateMany({ where: { id: row.id, organizationId: actor.organizationId, status: { in: mutable } }, data: { contentHash: preview.contentHash, recipient: preview.message.to, actorId: actor.userId } });
  if (!updated.count) fail('The delivery changed. Refresh its status before continuing.');
  const html = preview.message.inlineLogo ? preview.message.html.replace('cid:' + preview.message.inlineLogo.cid, `data:${preview.message.inlineLogo.contentType};base64,${preview.message.inlineLogo.content.toString('base64')}`) : preview.message.html;
  return { id: row.id, contentHash: preview.contentHash, to: preview.message.to, from: preview.sender.email || 'No organization Gmail account connected', senderMode: preview.sender.mode, subject: preview.message.subject, html, text: preview.message.text || '' };
}

type SendResult = { success: boolean; mode: string; code?: string };
export type HrWorkflowTransport = (organizationId: string, message: Parameters<typeof sendRenderedHrEmail>[1]) => Promise<SendResult>;
const deliver: HrWorkflowTransport = (organizationId, message) => sendRenderedHrEmail(organizationId, message, value => sendEmail({ ...value, sensitive: true }));

export async function sendHrWorkflow(actor: EmailActor, input: unknown, approval: unknown, db: PrismaClient = prisma, transport: HrWorkflowTransport = deliver) {
  await authorize(db, actor);
  const confirmed = z.object({ id: z.string().min(1).max(100), contentHash: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) }).strict().safeParse(approval);
  if (!confirmed.success) return fail('Preview the email and explicitly confirm its recipient and content before sending.');
  const preview = await compose(db, actor, input);
  if (preview.contentHash !== confirmed.data.contentHash) return fail('The recipient, sender, content, or workflow changed. Preview the email again before sending.');
  const claimed = await db.hrEmailDelivery.updateMany({ where: { id: confirmed.data.id, organizationId: actor.organizationId, applicationId: preview.input.applicationId, eventKey: preview.eventKey, contentHash: preview.contentHash, status: { in: mutable }, attemptCount: { lt: 5 } }, data: { status: 'SENDING', actorId: actor.userId, attemptCount: { increment: 1 }, lastAttemptAt: new Date(), errorCode: null } });
  if (!claimed.count) return fail('This email was already submitted, is being sent, or needs a fresh preview. No duplicate was sent.');
  let result: SendResult;
  try {
    if (preview.sender.mode === 'legacy' && (!(process.env.GMAIL_USER || process.env.SMTP_USER) || !(process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD))) result = { success: false, mode: 'not_sent', code: 'SETUP_REQUIRED' };
    else result = await transport(actor.organizationId, { ...preview.message, expectedSender: { mode: preview.sender.mode, email: preview.sender.email } });
  } catch { result = { success: false, mode: 'unknown', code: 'DELIVERY_UNCONFIRMED' }; }
  // SMTP and network failures can be ambiguous. Never automatically repeat them.
  const definiteFailures = ['NOT_CONNECTED', 'SETUP_REQUIRED', 'INVALID_MESSAGE', 'SAGA_GMAIL_NOT_ACTIVE', 'RECONNECT_REQUIRED', 'ACCESS_EXPIRED', 'SENDING_LIMIT', 'SEND_FAILED', 'STALE_PREVIEW', 'CREDENTIALS_UNAVAILABLE'];
  const status = result.success ? (result.mode === 'preview_log' ? 'FAILED' : 'SUBMITTED') : result.code && definiteFailures.includes(result.code) ? 'FAILED' : 'UNKNOWN';
  const errorCode = status === 'SUBMITTED' ? null : result.mode === 'preview_log' && result.success ? 'PREVIEW_ONLY' : result.code || 'DELIVERY_UNCONFIRMED';
  await db.hrEmailDelivery.update({ where: { id: confirmed.data.id }, data: { status, errorCode, submittedAt: status === 'SUBMITTED' ? new Date() : null } });
  if (status === 'SUBMITTED') return { success: true, message: 'Email submitted to the sending provider. Inbox delivery is not yet confirmed.' };
  return { success: false, message: status === 'UNKNOWN' ? 'Delivery could not be confirmed. Check the sending account. Resending is blocked to prevent a duplicate.' : `Email was not submitted (${errorCode}). Review Email Integration and preview again before a confirmed retry.` };
}

export async function hrWorkflowHistory(actor: EmailActor, applicationId: string, db: PrismaClient = prisma) {
  await authorize(db, actor);
  if (!await db.application.findFirst({ where: { id: applicationId, job: { organizationId: actor.organizationId } }, select: { id: true } })) return fail('Application unavailable in this organization.');
  return db.hrEmailDelivery.findMany({ where: { organizationId: actor.organizationId, applicationId }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, type: true, recipient: true, status: true, attemptCount: true, lastAttemptAt: true, submittedAt: true, errorCode: true } });
}
