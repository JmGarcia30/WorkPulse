import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { sendOrganizationEmail, sendSagaRecruitmentEmail, type CompanyEmail } from '@/features/email-integration/service';
import { emailMessage } from '@/features/email-integration/messages';

export async function recruitmentOrganization(organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true } });
  if (!org) throw Error('RECRUITMENT_ORGANIZATION_REQUIRED');
  return org;
}
export function sendSagaRecruitment(organizationId: string, input: CompanyEmail, legacySender: () => Promise<{ success: boolean; mode: 'smtp' | 'preview_log'; id: string }>) {
  return sendSagaRecruitmentEmail(prisma, organizationId, input, legacySender);
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
export async function sendCompanyRecruitmentEmail(org: { id: string; name: string }, input: { to: string; candidateName: string; title: string; message: string; portalUrl: string }) {
  const subject = input.title + ' — ' + org.name;
  const result = await sendOrganizationEmail(prisma, org.id, {
    to: input.to, subject,
    text: `Hello ${input.candidateName},\n${input.message}\nCandidate portal: ${input.portalUrl}\n${org.name}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>${escape(org.name)}</h2><p>Hello ${escape(input.candidateName)},</p><p>${escape(input.message)}</p><p><a href="${escape(input.portalUrl)}">Open candidate portal</a></p><p>${escape(org.name)} recruitment team</p></div>`,
  });
  return { success: result.success, mode: 'gmail_api' as const, id: '', ...(result.success ? {} : { warning: emailMessage(result.code) }) };
}

export async function sendCompanyApplicantAccessEmail(organizationId: string, input: { to: string; url: string }) {
  // Applicant authentication links are sensitive too: the Gmail transport never
  // retains message bodies, previews, authorization codes, or bearer links.
  const result = await sendOrganizationEmail(prisma, organizationId, { to: input.to, subject: 'Verify your application email',
    text: `Verify your email to access your application. This single-use link expires in 15 minutes: ${input.url}`,
    html: `<p>Verify your email to access your application.</p><p><a href="${escape(input.url)}">Verify application email</a></p><p>This single-use link expires in 15 minutes.</p>`,
  });
  return { success: result.success, mode: 'gmail_api' as const, id: '' };
}
