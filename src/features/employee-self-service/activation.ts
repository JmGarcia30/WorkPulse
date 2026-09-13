import { createHash, randomBytes } from 'node:crypto';
import {
  EmployeeAccountAuditAction,
  EmployeeAccountStatus,
  Prisma,
  Role,
} from '@prisma/client';

export const INVITATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function hashActivationToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createEmployeeInvitation(now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    hash: hashActivationToken(token),
    expiresAt: new Date(now + INVITATION_LIFETIME_MS),
  };
}

export function isActivationTokenFormatValid(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function activateEmployeeAccountInTransaction(
  tx: Prisma.TransactionClient,
  input: { token: string; passwordHash: string; now: Date },
) {
  const account = await tx.employeeAccount.findUnique({
    where: { activationTokenHash: hashActivationToken(input.token) },
    include: { user: true, employee: true },
  });
  if (
    !account ||
    account.status !== EmployeeAccountStatus.INVITED ||
    !account.activationTokenExpiresAt ||
    account.activationTokenExpiresAt <= input.now ||
    account.user.role !== Role.EMPLOYEE ||
    account.user.organizationId !== account.organizationId ||
    account.employee.organizationId !== account.organizationId
  ) {
    return false;
  }

  await tx.user.update({ where: { id: account.userId }, data: { passwordHash: input.passwordHash } });
  await tx.employeeAccount.update({
    where: { id: account.id },
    data: {
      status: EmployeeAccountStatus.ACTIVE,
      activationTokenHash: null,
      activationTokenExpiresAt: null,
      activatedAt: input.now,
      disabledAt: null,
      disabledReason: null,
    },
  });
  await tx.employeeAccountAudit.create({
    data: {
      organizationId: account.organizationId,
      employeeAccountId: account.id,
      actorUserId: account.userId,
      action: EmployeeAccountAuditAction.ACTIVATED,
    },
  });
  return true;
}
