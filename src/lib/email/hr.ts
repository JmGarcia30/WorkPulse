import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { platformEmail } from '@/features/platform-admin/credentials';
import { organizationEmailBranding } from '@/features/email-integration/test-email-template';
import { renderHrEmail, type HrEmailDetails, type HrEmailType } from '@/features/email-integration/hr-templates';
import { sendOrganizationEmail, sendSagaRecruitmentEmail, type CompanyEmail } from '@/features/email-integration/service';
import { emailMessage } from '@/features/email-integration/messages';

export type HrNotificationInput = HrEmailDetails & { organizationId: string; to: string };
type LegacySender = (message: CompanyEmail) => Promise<{ success: boolean; mode: 'smtp' | 'preview_log'; id: string }>;

// Internal notification service, not a Server Action. Existing workflows remain
// responsible for their authorized record selection and decision to send.
export async function deliverHrEmail(organizationId: string, type: HrEmailType, recipient: string, details: HrEmailDetails, legacySender: LegacySender) {
  const validated = platformEmail.safeParse(recipient);
  if (!validated.success) return { success: false, mode: 'not_sent' as const, id: '', warning: 'Enter one valid recipient email address.' };
  const branding = await organizationEmailBranding(prisma, organizationId);
  const message = { ...renderHrEmail(branding, type, details), to: validated.data };
  return sendRenderedHrEmail(organizationId, message, legacySender);
}

// Used after an authorized workflow preview; preserves the exact rendered content.
export async function sendRenderedHrEmail(organizationId: string, message: CompanyEmail, legacySender: LegacySender) {
  const validated = platformEmail.safeParse(message.to);
  if (!validated.success) return { success: false, mode: 'not_sent' as const, id: '', code: 'INVALID_MESSAGE' };
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { slug: true } });
  if (org.slug === 'st-aloysius') return sendSagaRecruitmentEmail(prisma, organizationId, message, () => legacySender(message));
  const result = await sendOrganizationEmail(prisma, organizationId, message);
  return { success: result.success, mode: 'gmail_api' as const, id: '', code: result.code, ...(result.success ? {} : { warning: emailMessage(result.code) }) };
}
