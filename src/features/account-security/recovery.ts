import 'server-only';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';
import { platformEmail, platformPassword } from '@/features/platform-admin/credentials';
import { workspaceActivationOrigin } from '@/features/platform-admin/onboarding';
import { staffTokenHash } from '@/lib/auth/staff-security';
import { sendEmail } from '@/lib/email';
import { AccountSecurityError } from './profile';
import { hasVerifiedMailbox, verifiedStaffSelection } from './notifications';

export const RECOVERY_RESPONSE = 'If this is a verified, eligible account in this workspace, a password reset email will be sent. Check your inbox or contact HR.';
export async function requestStaffPasswordReset(db: PrismaClient, organizationId: string, emailInput: unknown, schedule: (work: () => Promise<void>) => Promise<void> = work => work()) {
  const email = platformEmail.safeParse(emailInput);
  if (!email.success) return RECOVERY_RESPONSE;
  const allowed = await db.$transaction(async tx => {
    if (!await consumeAuthenticationAttempt(tx, `staff-recovery-tenant:${organizationId}`, 100)) return false;
    return consumeAuthenticationAttempt(tx, `staff-recovery-email:${organizationId}:${email.data}`, 3);
  });
  if (!allowed) return RECOVERY_RESPONSE;
  const result = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE email=${email.data} AND "organizationId"=${organizationId} FOR UPDATE`;
    const user = await tx.user.findFirst({ where: { organizationId, email: email.data }, select: verifiedStaffSelection });
    if (!user || !['HR_ADMIN','ORGANIZATION_ADMIN','EMPLOYEE'].includes(user.role) || !hasVerifiedMailbox(user)) return null;
    const now = new Date();
    // One issuance/delivery per 15-minute window, including a failed/ambiguous send.
    if (await tx.staffPasswordReset.findFirst({ where: { userId: user.id, organizationId, createdAt: { gt: new Date(now.getTime() - 15 * 60 * 1000) } }, select: { tokenHash: true } })) return null;
    const origin = workspaceActivationOrigin(user.organization.slug);
    const token = randomBytes(32).toString('hex'), expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    await tx.staffPasswordReset.create({ data: { tokenHash: staffTokenHash(token), organizationId, userId: user.id, expiresAt } });
    await tx.accountSecurityEvent.create({ data: { organizationId, subjectIdentifier: user.id, action: 'PASSWORD_RESET_REQUESTED', success: true } });
    return { email: user.email, url: `${origin}/reset-password#token=${token}`, expiresAt };
  });
  if (result) await schedule(async () => {
    try { await sendEmail({ to: result.email, subject: 'Reset your WorkPulse password', text: `Reset your password using this single-use link: ${result.url}\nIt expires in 15 minutes. Ignore this message if you did not request it.`, html: `<p>Reset your password using this single-use link:</p><p><a href="${result.url}">Reset password</a></p><p>It expires in 15 minutes. Ignore this message if you did not request it.</p>`, sensitive: true, requireConfiguredSender: true, senderName: 'WorkPulse Security' }); } catch { /* Public outcome stays generic; no bearer token is logged or returned. */ }
  });
  return RECOVERY_RESPONSE;
}

export async function resetStaffPassword(db: PrismaClient, organizationId: string, input: { token: unknown; password: unknown; confirmation: unknown }) {
  const invalid = () => new AccountSecurityError('INVALID_RESET', 'This password reset link is invalid, expired or already used. Request a new link.');
  if (typeof input.token !== 'string' || !/^[a-f0-9]{64}$/.test(input.token)) throw invalid();
  const tokenHash = staffTokenHash(input.token), password = platformPassword.safeParse(input.password);
  if (!password.success || input.password !== input.confirmation) throw new AccountSecurityError('INVALID_PASSWORD', 'Use matching passwords of 14–72 characters, at most 72 UTF-8 bytes.');
  if (!await db.$transaction(tx => consumeAuthenticationAttempt(tx, `staff-reset-tenant:${organizationId}`, 100))) throw invalid();
  const initial = await db.staffPasswordReset.findFirst({ where: { tokenHash, organizationId, consumedAt: null, expiresAt: { gt: new Date() } }, select: { userId: true } });
  if (!initial) throw invalid();
  const passwordHash = await hash(password.data, 12);
  await db.$transaction(async tx => {
    // Consistent User-first order serializes reset/change/login and parallel redemption.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${initial.userId} AND "organizationId"=${organizationId} FOR UPDATE`;
    const reset = await tx.staffPasswordReset.findFirst({ where: { tokenHash, organizationId, userId: initial.userId, consumedAt: null, expiresAt: { gt: new Date() } } });
    const user = await tx.user.findFirst({ where: { id: initial.userId, organizationId }, select: verifiedStaffSelection });
    if (!reset || !user || !['HR_ADMIN','ORGANIZATION_ADMIN','EMPLOYEE'].includes(user.role) || !hasVerifiedMailbox(user)) throw invalid();
    await tx.staffPasswordReset.updateMany({ where: { userId: user.id, organizationId, consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.user.update({ where: { id: user.id, organizationId }, data: { passwordHash } });
    await tx.staffSession.deleteMany({ where: { userId: user.id, organizationId } });
    await tx.platformAuthenticationAttempt.deleteMany({ where: { key: staffTokenHash(`staff-login-identity:${organizationId}:${user.email}`) } });
    await tx.accountSecurityEvent.create({ data: { organizationId, subjectIdentifier: user.id, actorIdentifier: user.id, action: 'PASSWORD_RESET_COMPLETED', success: true } });
  }, { timeout: 30000 });
}
