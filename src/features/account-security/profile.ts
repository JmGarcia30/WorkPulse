import 'server-only';
import { compare, hash } from 'bcryptjs';
import { Prisma, type PrismaClient } from '@prisma/client';
import { platformName, platformPassword } from '@/features/platform-admin/credentials';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';
import { staffTokenHash } from '@/lib/auth/staff-security';

export class AccountSecurityError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export async function requireSelfAdministrator(tx: Prisma.TransactionClient, input: { organizationId: string; userId: string; token: string }) {
  const session = await tx.staffSession.findFirst({ where: { tokenHash: staffTokenHash(input.token), organizationId: input.organizationId, userId: input.userId, expiresAt: { gt: new Date() } }, select: { user: { select: { id: true, organizationId: true, name: true, email: true, role: true } } } });
  if (!session || session.user.organizationId !== input.organizationId || !['HR_ADMIN','ORGANIZATION_ADMIN'].includes(session.user.role)) throw new AccountSecurityError('FORBIDDEN', 'Administrator self-service access is required.');
  return session.user;
}

export async function updateOwnName(db: PrismaClient, context: { organizationId: string; userId: string; token: string }, nameInput: unknown) {
  const name = platformName.safeParse(nameInput);
  if (!name.success) throw new AccountSecurityError('INVALID_NAME', 'Enter your full name (2–100 characters).');
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${context.userId} AND "organizationId"=${context.organizationId} FOR UPDATE`;
    const user = await requireSelfAdministrator(tx, context);
    if (user.name === name.data) return;
    await tx.user.update({ where: { id: user.id, organizationId: context.organizationId }, data: { name: name.data } });
    await tx.accountSecurityEvent.create({ data: { organizationId: context.organizationId, actorIdentifier: user.id, subjectIdentifier: user.id, action: 'PROFILE_UPDATED', success: true } });
  });
}

export async function changeOwnPassword(db: PrismaClient, context: { organizationId: string; userId: string; token: string }, input: { currentPassword: unknown; password: unknown; confirmation: unknown }) {
  const password = platformPassword.safeParse(input.password);
  if (!password.success || input.password !== input.confirmation) throw new AccountSecurityError('INVALID_PASSWORD', 'Use matching passwords of 14–72 characters, at most 72 UTF-8 bytes.');
  if (typeof input.currentPassword !== 'string' || !input.currentPassword || Buffer.byteLength(input.currentPassword) > 72) throw new AccountSecurityError('INVALID_CURRENT_PASSWORD', 'Enter your current password.');
  // Failed reauthentication attempts must commit their throttle independently.
  if (!await db.$transaction(tx => consumeAuthenticationAttempt(tx, `staff-password-change:${context.organizationId}:${context.userId}`, 5))) throw new AccountSecurityError('THROTTLED', 'Too many attempts. Try again in 15 minutes.');
  const passwordHash = await hash(password.data, 12);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${context.userId} AND "organizationId"=${context.organizationId} FOR UPDATE`;
    const user = await requireSelfAdministrator(tx, context);
    const credential = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (!credential.passwordHash || !await compare(input.currentPassword as string, credential.passwordHash)) throw new AccountSecurityError('INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
    await tx.user.update({ where: { id: user.id, organizationId: context.organizationId }, data: { passwordHash } });
    await tx.staffSession.deleteMany({ where: { userId: user.id, organizationId: context.organizationId } });
    await tx.staffPasswordReset.updateMany({ where: { userId: user.id, organizationId: context.organizationId, consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.accountSecurityEvent.create({ data: { organizationId: context.organizationId, actorIdentifier: user.id, subjectIdentifier: user.id, action: 'PASSWORD_CHANGED', success: true } });
  }, { timeout: 30000 });
}
