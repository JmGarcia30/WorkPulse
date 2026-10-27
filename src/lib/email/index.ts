import nodemailer from 'nodemailer';
import { publicOrigin } from '@/lib/tenant/host';
import { recruitmentOrganization, sendCompanyRecruitmentEmail, sendCompanyApplicantAccessEmail, sendSagaRecruitment } from './recruitment';
import { deliverHrEmail, type HrNotificationInput } from './hr';
import type { EmailInlineLogo } from '@/features/email-integration/google';

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  sentAt: Date;
  mode: 'smtp' | 'preview_log';
}

// In-memory cache for development, testing, and capstone presentation inspection
const emailLogQueue: EmailLogEntry[] = [];

export function getEmailLogs(): EmailLogEntry[] {
  return [...emailLogQueue];
}

export function clearEmailLogs(): void {
  emailLogQueue.length = 0;
}

export function getLastSentEmail(): EmailLogEntry | undefined {
  return emailLogQueue[emailLogQueue.length - 1];
}

/**
 * Creates a transporter instance if credentials exist in environment variables.
 * Free Gmail SMTP requires a standard Gmail address and an App Password (zero cost).
 */
// Normalize literal .env-style quoting accidentally pasted into Vercel's editor.
function unquoteEmailEnv(value: string | undefined) {
  const clean = (value ?? '').trim();
  if (clean.length >= 2 && ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'")))) return clean.slice(1, -1);
  return clean;
}

function configuredSmtpCredentials() {
  const user = unquoteEmailEnv(process.env.GMAIL_USER || process.env.SMTP_USER);
  const rawPass = unquoteEmailEnv(process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD);
  // Google sometimes displays its 16-letter App Password in four space-separated groups.
  const pass = !process.env.SMTP_HOST && /^[a-z]{4}(?: [a-z]{4}){3}$/i.test(rawPass) ? rawPass.replace(/ /g, '') : rawPass;
  return { user, pass };
}
// Sensitive onboarding emails use the authenticated SMTP mailbox as the sender.
// EMAIL_FROM may be a branded display address in other workflows; Gmail App Password
// accounts generally cannot send from an arbitrary unverified address.
function onboardingSenderAddress() {
  const { user } = configuredSmtpCredentials();
  return user;
}

function getTransporter() {
  const { user, pass } = configuredSmtpCredentials();

  if (user && pass) {
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT || '587');
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: { user, pass },
      });
    }
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  return null;
}

// Only log non-sensitive SMTP failure classifications. Never log provider
// messages, stack traces, headers, credentials, recipients, or activation URLs.
function smtpFailureDiagnostic(error: unknown): { category: string; smtpStatus?: number; stage?: string } {
  const details = error && typeof error === 'object' ? error as { code?: unknown; responseCode?: unknown; command?: unknown } : {};
  const code = typeof details.code === 'string' ? details.code : '';
  const status = typeof details.responseCode === 'number' && Number.isInteger(details.responseCode) &&
    details.responseCode >= 400 && details.responseCode <= 599 ? details.responseCode : undefined;
  const category = code === 'EINVALIDSENDER' ? 'SENDER_CONFIGURATION'
    : status === 535 || status === 534 || code === 'EAUTH' ? 'AUTHENTICATION'
    : status === 550 || status === 553 || code === 'EENVELOPE' ? 'SENDER_OR_RECIPIENT'
    : status === 421 || status === 450 || status === 451 || status === 452 ? 'PROVIDER_TEMPORARY'
    : code === 'ETIMEDOUT' ? 'TIMEOUT'
    : ['ESOCKET', 'ECONNECTION', 'ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH'].includes(code) ? 'CONNECTION'
    : 'OTHER';
  const stage = typeof details.command === 'string' && /^(AUTH|CONN|MAIL|RCPT|DATA)$/.test(details.command) ? details.command : undefined;
  return { category, ...(status === undefined ? {} : { smtpStatus: status }), ...(stage ? { stage } : {}) };
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  sensitive?: boolean;
  senderName?: string;
  requireConfiguredSender?: boolean;
  inlineLogo?: EmailInlineLogo;
}

export async function sendEmail({ to, subject, html, text, sensitive = false, senderName, requireConfiguredSender = false, inlineLogo }: SendEmailParams): Promise<{ success: boolean; mode: 'smtp' | 'preview_log'; id: string }> {
  const plainText = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const id = `email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const transporter = getTransporter();

  if (transporter) {
    try {
      const fromAddress = requireConfiguredSender ? onboardingSenderAddress() : unquoteEmailEnv(process.env.EMAIL_FROM || process.env.GMAIL_USER || 'no-reply@workpulse.saga.edu');
      if (requireConfiguredSender && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fromAddress)) throw Object.assign(new Error('Configured SMTP mailbox is invalid.'), { code: 'EINVALIDSENDER' });
      await transporter.sendMail({
        from: `"${senderName || 'WorkPulse — St. Aloysius Gonzaga Academy'}" <${fromAddress}>`,
        to,
        subject,
        text: plainText,
        html,
        attachments: inlineLogo ? [{ filename: 'organization-logo', content: inlineLogo.content, contentType: inlineLogo.contentType, cid: inlineLogo.cid, contentDisposition: 'inline' }] : undefined,
      });

      if (!sensitive) {
        const entry: EmailLogEntry = { id, to, subject, text: plainText, html, sentAt: new Date(), mode: 'smtp' };
        emailLogQueue.push(entry);
      }
      if (sensitive) console.log('[WorkPulse Emailer (SMTP)] Sensitive transactional email accepted by SMTP provider.');
      else console.log(`[WorkPulse Emailer (SMTP)] Dispatched to ${to} | Subject: "${subject}"`);
      return { success: true, mode: 'smtp', id };
    } catch (error) {
      console.warn('[WorkPulse Emailer] SMTP primary delivery failed:', smtpFailureDiagnostic(error));
      const details = error && typeof error === 'object' ? error as { code?: unknown; command?: unknown; responseCode?: unknown } : {};
      const connectionFailure = !process.env.SMTP_HOST && Boolean(process.env.GMAIL_USER) && !details.responseCode &&
        (['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH'].includes(String(details.code ?? '')) ||
        (details.command === 'CONN' && ['ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(String(details.code ?? ''))));
      if (connectionFailure) {
        try {
          const { user, pass } = configuredSmtpCredentials();
          const fallback = nodemailer.createTransport({
            host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
            auth: { user, pass }, connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 20000,
          });
          const fromAddress = requireConfiguredSender ? onboardingSenderAddress() : unquoteEmailEnv(process.env.EMAIL_FROM || process.env.GMAIL_USER);
          if (requireConfiguredSender && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fromAddress)) throw Object.assign(new Error('Configured SMTP mailbox is invalid.'), { code: 'EINVALIDSENDER' });
          await fallback.sendMail({
            from: '"' + (senderName || 'WorkPulse') + '" <' + fromAddress + '>',
            to, subject, text: plainText, html,
            attachments: inlineLogo ? [{ filename: 'organization-logo', content: inlineLogo.content, contentType: inlineLogo.contentType, cid: inlineLogo.cid, contentDisposition: 'inline' }] : undefined,
          });
          if (!sensitive) emailLogQueue.push({ id, to, subject, text: plainText, html, sentAt: new Date(), mode: 'smtp' });
          console.log('[WorkPulse Emailer] SMTP STARTTLS fallback accepted email.');
          return { success: true, mode: 'smtp', id };
        } catch (retryError) {
          console.warn('[WorkPulse Emailer] SMTP STARTTLS fallback failed:', smtpFailureDiagnostic(retryError));
        }
      }
    }
  }

  // Secret-bearing messages must never be retained or printed by the preview logger.
  if (sensitive) {
    console.warn(`[WorkPulse Emailer] Sensitive email ${id} was not delivered; content was discarded.`);
    return { success: false, mode: 'preview_log', id };
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn(`[WorkPulse Emailer] Email ${id} was not delivered because SMTP is unavailable.`);
    return { success: false, mode: 'preview_log', id };
  }

  // Preview / Development / Defense mode (Zero-cost, 100% reliable offline)
  const entry: EmailLogEntry = { id, to, subject, text: plainText, html, sentAt: new Date(), mode: 'preview_log' };
  emailLogQueue.push(entry);

  console.log(`\n================== [WORKPULSE TRANSACTIONAL EMAIL] ==================`);
  console.log(`ID:      ${id}`);
  console.log(`TO:      ${to}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`TIME:    ${entry.sentAt.toISOString()}`);
  console.log(`BODY PREVIEW:\n${plainText.slice(0, 300)}...`);
  console.log(`=====================================================================\n`);

  return { success: true, mode: 'preview_log', id };
}

export async function sendApplicantVerificationEmail(input: { organizationId: string; to: string; url: string }) {
  const org = await recruitmentOrganization(input.organizationId);
  if (org.slug !== 'st-aloysius') return sendCompanyApplicantAccessEmail(org.id, input);
  const message = { to: input.to, subject: 'Verify your WorkPulse application', sensitive: true,
    text: `Verify email ownership to access your application. This one-time link expires in 15 minutes: ${input.url}`,
    html: `<p>Verify email ownership to access your application.</p><p><a href="${input.url}">Verify application</a></p><p>This one-time link expires in 15 minutes.</p>`,
  };
  return sendSagaRecruitment(org.id, message, () => sendEmail(message));
}

export function sendCompanyRegistrationVerificationEmail(input: { to: string; organizationName: string; code: string; verificationUrl: string; expiresAt: Date }) {
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
  return sendEmail({
    to: input.to, subject: 'Verify your company email — WorkPulse',
    sensitive: true, senderName: 'WorkPulse', requireConfiguredSender: true,
    text: `Your WorkPulse verification code is: ${input.code}\nVerify your email to create ${input.organizationName}: ${input.verificationUrl}\nThis code expires in 10 minutes (${input.expiresAt.toISOString()}) and can only be used once. On another browser, enter your email and registration password too. Never share this code. If you did not register, ignore this email. No workspace has been created.`,
    html: `<p>Verify your email to create <strong>${escape(input.organizationName)}</strong> on WorkPulse.</p><p>Your verification code:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${escape(input.code)}</p><p><a href="${escape(input.verificationUrl)}">Enter verification code</a></p><p>This code expires in 10 minutes and can only be used once. On another browser, enter your email and registration password too. Never share this code. If you did not register, ignore this email. No workspace has been created.</p>`,
  });
}

export function sendOrganizationAdministratorActivationEmail(input: { to: string; organizationName: string; activationUrl: string; expiresAt: Date }) {
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
  return sendEmail({
    to: input.to, subject: `Activate your WorkPulse HR administrator account — ${input.organizationName}`,
    sensitive: true, senderName: 'WorkPulse', requireConfiguredSender: true,
    text: `You were invited to administer ${input.organizationName} on WorkPulse. Set your own password using this single-use link: ${input.activationUrl}\nExpires: ${input.expiresAt.toISOString()}. If this invitation was unexpected, ignore it.`,
    html: `<p>You were invited to administer ${escape(input.organizationName)} on WorkPulse.</p><p><a href="${escape(input.activationUrl)}">Activate your HR administrator account</a> and set your own password.</p><p>Expires: ${input.expiresAt.toISOString()}. If this invitation was unexpected, ignore it.</p>`,
  });
}

export function sendEmployeeActivationEmail(input: {
  to: string;
  employeeName: string;
  organizationName: string;
  activationUrl: string;
  expiresAt: Date;
}) {
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
  const subject = `Activate your WorkPulse account — ${input.organizationName}`;
  const expiry = input.expiresAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  return sendEmail({
    to: input.to,
    subject,
    sensitive: true,
    text: `Hello ${input.employeeName}, activate your WorkPulse account using this one-time link: ${input.activationUrl}\nThis link expires on ${expiry}.`,
    html: `<p>Hello ${escapeHtml(input.employeeName)},</p><p>Activate your WorkPulse account using the secure one-time link below.</p><p><a href="${escapeHtml(input.activationUrl)}">Activate WorkPulse account</a></p><p>This link expires on ${escapeHtml(expiry)}.</p>`,
  });
}

// ==========================================
// INSTITUTIONAL SAGA EMAIL TEMPLATES
// ==========================================

export async function sendApplicationConfirmationEmail({
  organizationId,
  to,
  candidateName,
  jobTitle,
  applicationId,
  baseUrl = publicOrigin(),
}: {
  organizationId: string;
  to: string;
  candidateName: string;
  jobTitle: string;
  organizationName: string;
  organizationSlug: string;
  applicationId: string;
  baseUrl?: string;
}) {
  const org = await recruitmentOrganization(organizationId);
  const portalUrl = `${baseUrl}/careers/${org.slug}/portal/${applicationId}`;
  return deliverHrEmail(org.id, 'acknowledgment', to, {
    recipientName: candidateName, jobTitle, portalUrl,
    instructions: org.slug === 'st-aloysius' ? [
      'In accordance with the SAGA Institutional Hiring Policy, submit verified credential copies (Transcript of Records, Diploma, Board LET license, 3 Moral Recommendation Letters, and NBI Clearance) to the Head of the Department.',
      'You can upload your scanned credentials through your Candidate Document Portal.',
    ] : undefined,
  }, message => sendEmail(message));
}

export function sendInterviewInvitationEmail(input: HrNotificationInput) {
  return deliverHrEmail(input.organizationId, 'interview', input.to, input, message => sendEmail(message));
}
export function sendSuccessfulApplicantEmail(input: HrNotificationInput) {
  return deliverHrEmail(input.organizationId, 'acceptance', input.to, input, message => sendEmail(message));
}
export function sendApplicantRejectionEmail(input: HrNotificationInput) {
  return deliverHrEmail(input.organizationId, 'rejection', input.to, input, message => sendEmail(message));
}
export function sendEmployeeOnboardingEmail(input: HrNotificationInput) {
  return deliverHrEmail(input.organizationId, 'onboarding', input.to, input, message => sendEmail(message));
}

export async function sendDocumentRejectedEmail({
  organizationId,
  to,
  candidateName,
  documentTitle,
  rejectionReason,
  portalUrl,
  organizationName,
}: {
  organizationId: string;
  to: string;
  candidateName: string;
  documentTitle: string;
  rejectionReason: string;
  portalUrl: string;
  organizationName: string;
}) {
  const org = await recruitmentOrganization(organizationId);
  if (org.slug !== 'st-aloysius') return sendCompanyRecruitmentEmail(org, { to, candidateName, title: 'Document resubmission requested: ' + documentTitle, message: `Please resubmit ${documentTitle}. Reviewer feedback: ${rejectionReason}`, portalUrl });
  const subject = `Action Required: Document Resubmission Requested (${documentTitle}) — ${organizationName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="padding-bottom: 16px; border-bottom: 2px solid #dc2626;">
        <h2 style="margin: 0; color: #1e293b; font-size: 20px;">${organizationName}</h2>
        <p style="margin: 4px 0 0; color: #dc2626; font-weight: 600; font-size: 13px;">Document Review Notice — Action Required</p>
      </div>

      <div style="padding: 24px 0;">
        <h3 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">Dear ${candidateName},</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px;">
          Our hiring team and the Head of the Department reviewed your submitted document: <strong>${documentTitle}</strong>.
        </p>

        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: #991b1b;">Reviewer Feedback / Rejection Reason:</h4>
          <p style="font-size: 14px; line-height: 1.5; color: #b91c1c; margin: 0; font-style: italic;">
            "${rejectionReason}"
          </p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px;">
          Please review the feedback above and re-upload a clear, high-resolution, and complete replacement through your candidate portal as soon as possible.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalUrl}" style="background-color: #dc2626; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Re-Upload Document Now &rarr;
          </a>
        </div>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0;">St. Aloysius Gonzaga Academy, Inc. • Recruitment & Placement Department</p>
      </div>
    </div>
  `;

  return sendSagaRecruitment(org.id, { to, subject, html }, () => sendEmail({ to, subject, html }));
}

export async function sendDocumentVerifiedEmail({
  organizationId,
  to,
  candidateName,
  documentTitle,
  organizationName,
  portalUrl,
}: {
  organizationId: string;
  to: string;
  candidateName: string;
  documentTitle: string;
  organizationName: string;
  portalUrl: string;
}) {
  const org = await recruitmentOrganization(organizationId);
  if (org.slug !== 'st-aloysius') return sendCompanyRecruitmentEmail(org, { to, candidateName, title: 'Document verified: ' + documentTitle, message: `Your document ${documentTitle} has been reviewed and verified.`, portalUrl });
  const subject = `Document Verified: ${documentTitle} — ${organizationName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="padding-bottom: 16px; border-bottom: 2px solid #16a34a;">
        <h2 style="margin: 0; color: #1e293b; font-size: 20px;">${organizationName}</h2>
        <p style="margin: 4px 0 0; color: #16a34a; font-weight: 600; font-size: 13px;">Document Status Update: Verified</p>
      </div>

      <div style="padding: 24px 0;">
        <h3 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">Dear ${candidateName},</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px;">
          Good news! Your submission for <strong>${documentTitle}</strong> has been successfully reviewed and verified by the hiring department.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalUrl}" style="background-color: #16a34a; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">
            View Your Candidate Portal &rarr;
          </a>
        </div>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0;">St. Aloysius Gonzaga Academy, Inc. • Recruitment & Placement Department</p>
      </div>
    </div>
  `;

  return sendSagaRecruitment(org.id, { to, subject, html }, () => sendEmail({ to, subject, html }));
}
