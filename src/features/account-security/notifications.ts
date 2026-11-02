import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { sendEmail } from '@/lib/email';

export const verifiedStaffSelection = {
  id: true, organizationId: true, email: true, role: true, passwordHash: true,
  organizationInvitation: { select: { email: true, status: true, activatedAt: true } },
  organization: { select: { slug: true, companyRegistration: { select: { email: true, verifiedAt: true } } } },
  employeeAccount: { select: { organizationId: true, status: true, activatedAt: true, employee: { select: { organizationId: true, employeeStatus: true } } } },
} satisfies Prisma.UserSelect;
type VerifiedStaff = Prisma.UserGetPayload<{ select: typeof verifiedStaffSelection }>;
export function hasVerifiedMailbox(user: VerifiedStaff) {
  if (!user.passwordHash) return false;
  if (user.role === 'EMPLOYEE') return !!user.employeeAccount?.activatedAt && user.employeeAccount.status === 'ACTIVE'
    && user.employeeAccount.organizationId === user.organizationId && user.employeeAccount.employee.organizationId === user.organizationId && user.employeeAccount.employee.employeeStatus === 'ACTIVE';
  const invitation = user.organizationInvitation, registration = user.organization.companyRegistration;
  return !!(invitation?.activatedAt && invitation.status === 'ACTIVATED' && invitation.email === user.email)
    || !!(registration?.verifiedAt && registration.email === user.email);
}

/** Each recipient gets at most one claimed SMTP attempt per durable lockout event. */
export async function notifyLoginLockout(db: PrismaClient, event: { id: string; organizationId: string; subjectIdentifier: string }) {
  const candidates = await db.user.findMany({ where: { organizationId: event.organizationId, OR: [{ id: event.subjectIdentifier }, { role: { in: ['HR_ADMIN', 'ORGANIZATION_ADMIN'] } }] }, select: verifiedStaffSelection });
  const recipients = [...new Set(candidates.filter(hasVerifiedMailbox).map(user => user.email))];
  for (const to of recipients) {
    const key = `security-alert:${event.id}:${createHash('sha256').update(to.toLowerCase()).digest('hex')}`;
    const claimed = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      if (await tx.accountSecurityEvent.findUnique({ where: { operationKey: key }, select: { id: true } })) return false;
      await tx.accountSecurityEvent.create({ data: { organizationId: event.organizationId, subjectIdentifier: event.subjectIdentifier, action: 'SECURITY_ALERT_CLAIMED', success: true, operationKey: key } });
      return true;
    });
    if (!claimed) continue;
    let accepted = false;
    try {
      const result = await sendEmail({ to, subject: 'WorkPulse account security alert', text: 'Five incorrect password attempts temporarily restricted an account in your WorkPulse workspace for 15 minutes. If this was unexpected, use your workspace password recovery page or contact your authorized HR administrator. No password was changed by this alert.', html: '<p>Five incorrect password attempts temporarily restricted an account in your WorkPulse workspace for 15 minutes.</p><p>If this was unexpected, use your workspace password recovery page or contact your authorized HR administrator.</p>', sensitive: true, requireConfiguredSender: true, senderName: 'WorkPulse Security' });
      accepted = result.success && result.mode === 'smtp';
    } catch { /* Record only a fixed delivery outcome, never SMTP errors or addresses. */ }
    await db.accountSecurityEvent.create({ data: { organizationId: event.organizationId, subjectIdentifier: event.subjectIdentifier, action: accepted ? 'SECURITY_ALERT_ACCEPTED' : 'SECURITY_ALERT_FAILED', success: accepted, operationKey: `${key}:result` } });
  }
}
