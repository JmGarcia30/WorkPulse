import 'server-only';

import { hash } from 'bcryptjs';
import {
  EmployeeAccountAuditAction,
  EmployeeAccountStatus,
  EmployeeStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { sendEmployeeActivationEmail } from '@/lib/email';
import {
  activateEmployeeAccountInTransaction,
  createEmployeeInvitation,
  isActivationTokenFormatValid,
} from './activation';

export class EmployeeAccountError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'EmployeeAccountError';
  }
}

function normalizeLoginEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new EmployeeAccountError('INVALID_EMAIL', 'The employee contact email is not a valid login email.');
  }
  return email;
}

async function appendAuditWithRetry(data: Prisma.EmployeeAccountAuditUncheckedCreateInput) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await prisma.employeeAccountAudit.create({ data });
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  console.error('Employee account audit persistence failed.', {
    action: data.action,
    organizationId: data.organizationId,
    employeeAccountId: data.employeeAccountId ?? null,
    errorName: lastError instanceof Error ? lastError.name : 'UnknownError',
  });
  return false;
}

async function assertProvisioningActor(organizationId: string, actorUserId: string) {
  const actor = await prisma.user.findFirst({
    where: {
      id: actorUserId,
      organizationId,
      role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] },
    },
    select: { id: true },
  });
  if (!actor) throw new EmployeeAccountError('UNAUTHORIZED', 'Unauthorized to manage employee accounts.');
}

async function deliverInvitation(input: {
  accountId: string;
  organizationId: string;
  actorUserId: string;
  email: string;
  employeeName: string;
  organizationName: string;
  token: string;
  expiresAt: Date;
  resent: boolean;
}) {
  const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const activationUrl = `${baseUrl}/activate/employee#token=${encodeURIComponent(input.token)}`;
  const delivery = await sendEmployeeActivationEmail({
    to: input.email,
    employeeName: input.employeeName,
    organizationName: input.organizationName,
    activationUrl,
    expiresAt: input.expiresAt,
  });
  const action = delivery.success
    ? input.resent
      ? EmployeeAccountAuditAction.INVITATION_RESENT
      : EmployeeAccountAuditAction.INVITATION_SENT
    : EmployeeAccountAuditAction.INVITATION_SEND_FAILED;
  const audited = await appendAuditWithRetry({
    organizationId: input.organizationId,
    employeeAccountId: input.accountId,
    actorUserId: input.actorUserId,
    action,
    details: {
      mode: delivery.mode,
      expiresAt: input.expiresAt.toISOString(),
      attempt: input.resent ? 'RESEND' : 'INITIAL',
    },
  });
  return {
    delivered: delivery.success,
    audited,
    warning: !audited
      ? 'The invitation outcome could not be audited. The account remains invited.'
      : !delivery.success
        ? 'The account was created, but email was not delivered. Resend after configuring SMTP.'
        : undefined,
  };
}

export async function provisionEmployeeAccount(input: {
  organizationId: string;
  employeeId: string;
  actorUserId: string;
}) {
  await assertProvisioningActor(input.organizationId, input.actorUserId);
  const invitation = createEmployeeInvitation();
  try {
    const provisioned = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: input.employeeId, organizationId: input.organizationId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeStatus: true,
          organization: { select: { name: true } },
          employmentRecords: {
            where: {
              effectiveFrom: { lte: new Date() },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
            },
            select: { id: true },
            take: 1,
          },
          employeeAccount: { select: { id: true } },
        },
      });
      if (!employee) throw new EmployeeAccountError('NOT_FOUND', 'Employee not found or access denied.');
      if (employee.employeeStatus !== EmployeeStatus.ACTIVE || employee.employmentRecords.length === 0) {
        throw new EmployeeAccountError('INACTIVE_EMPLOYEE', 'Only an active employee with a current employment record can receive an account.');
      }
      if (employee.employeeAccount) throw new EmployeeAccountError('DUPLICATE_ACCOUNT', 'This employee already has an account.');
      const email = normalizeLoginEmail(employee.email);
      const user = await tx.user.create({
        data: {
          organizationId: input.organizationId,
          name: `${employee.firstName} ${employee.lastName}`,
          email,
          passwordHash: null,
          role: Role.EMPLOYEE,
        },
      });
      const account = await tx.employeeAccount.create({
        data: {
          organizationId: input.organizationId,
          userId: user.id,
          employeeId: employee.id,
          status: EmployeeAccountStatus.INVITED,
          activationTokenHash: invitation.hash,
          activationTokenExpiresAt: invitation.expiresAt,
          invitedAt: new Date(),
          createdById: input.actorUserId,
        },
      });
      await tx.employeeAccountAudit.createMany({
        data: [
          { organizationId: input.organizationId, employeeAccountId: account.id, actorUserId: input.actorUserId, action: EmployeeAccountAuditAction.ACCOUNT_CREATED },
          { organizationId: input.organizationId, employeeAccountId: account.id, actorUserId: input.actorUserId, action: EmployeeAccountAuditAction.EMPLOYEE_LINKED },
        ],
      });
      return {
        accountId: account.id,
        email,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        organizationName: employee.organization.name,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const delivery = await deliverInvitation({
      ...provisioned,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      resent: false,
    });
    return { accountId: provisioned.accountId, email: provisioned.email, status: EmployeeAccountStatus.INVITED, ...delivery };
  } catch (error) {
    if (error instanceof EmployeeAccountError) {
      await appendAuditWithRetry({ organizationId: input.organizationId, actorUserId: input.actorUserId, action: EmployeeAccountAuditAction.LINK_REJECTED, details: { reason: error.code } });
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      await appendAuditWithRetry({ organizationId: input.organizationId, actorUserId: input.actorUserId, action: EmployeeAccountAuditAction.LINK_REJECTED, details: { reason: 'DUPLICATE_ACCOUNT_OR_EMAIL' } });
      throw new EmployeeAccountError('DUPLICATE_ACCOUNT_OR_EMAIL', 'An employee account or login email already exists.');
    }
    throw error;
  }
}

export async function resendEmployeeInvitation(input: { organizationId: string; accountId: string; actorUserId: string }) {
  await assertProvisioningActor(input.organizationId, input.actorUserId);
  const invitation = createEmployeeInvitation();
  const account = await prisma.employeeAccount.update({
    where: { id: input.accountId, organizationId: input.organizationId, status: EmployeeAccountStatus.INVITED },
    data: { activationTokenHash: invitation.hash, activationTokenExpiresAt: invitation.expiresAt, invitedAt: new Date() },
    select: {
      id: true,
      user: { select: { email: true } },
      employee: { select: { firstName: true, lastName: true } },
      organization: { select: { name: true } },
    },
  }).catch(() => { throw new EmployeeAccountError('NOT_INVITED', 'The invited account was not found.'); });
  return deliverInvitation({
    accountId: account.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    email: account.user.email,
    employeeName: `${account.employee.firstName} ${account.employee.lastName}`,
    organizationName: account.organization.name,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
    resent: true,
  });
}

export async function activateEmployeeAccount(input: { token: string; password: string; passwordConfirmation: string }) {
  const raw = input.token.trim();
  const byteLength = Buffer.byteLength(input.password, 'utf8');
  if (!isActivationTokenFormatValid(raw)) throw new EmployeeAccountError('INVALID_ACTIVATION', 'This activation link is invalid or expired.');
  if (input.password !== input.passwordConfirmation) throw new EmployeeAccountError('PASSWORD_MISMATCH', 'Passwords do not match.');
  if (byteLength < 12 || byteLength > 72) throw new EmployeeAccountError('INVALID_PASSWORD', 'Password must be between 12 and 72 bytes.');
  const passwordHash = await hash(input.password, 12);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const activated = await activateEmployeeAccountInTransaction(tx, { token: raw, passwordHash, now });
    if (!activated) throw new EmployeeAccountError('INVALID_ACTIVATION', 'This activation link is invalid or expired.');
    return { success: true as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function disableEmployeeAccount(input: { organizationId: string; accountId: string; actorUserId: string; reason: string }) {
  await assertProvisioningActor(input.organizationId, input.actorUserId);
  const reason = input.reason.trim();
  if (!reason || reason.length > 2000) throw new EmployeeAccountError('INVALID_REASON', 'A disable reason is required.');
  return prisma.$transaction(async (tx) => {
    const account = await tx.employeeAccount.update({
      where: { id: input.accountId, organizationId: input.organizationId, status: { in: [EmployeeAccountStatus.INVITED, EmployeeAccountStatus.ACTIVE] } },
      data: { status: EmployeeAccountStatus.DISABLED, activationTokenHash: null, activationTokenExpiresAt: null, disabledAt: new Date(), disabledReason: reason },
    });
    await tx.employeeAccountAudit.create({ data: { organizationId: input.organizationId, employeeAccountId: account.id, actorUserId: input.actorUserId, action: EmployeeAccountAuditAction.DISABLED, details: { reason } } });
    return account;
  });
}

export async function enableEmployeeAccount(input: { organizationId: string; accountId: string; actorUserId: string }) {
  await assertProvisioningActor(input.organizationId, input.actorUserId);
  const invitation = createEmployeeInvitation();
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.employeeAccount.findFirst({
      where: { id: input.accountId, organizationId: input.organizationId, status: EmployeeAccountStatus.DISABLED, employee: { employeeStatus: EmployeeStatus.ACTIVE } },
      include: { user: true, employee: true, organization: true },
    });
    if (!existing) throw new EmployeeAccountError('NOT_DISABLED', 'A disabled account for an active employee was not found.');
    const activated = Boolean(existing.user.passwordHash && existing.activatedAt);
    const account = await tx.employeeAccount.update({
      where: { id: existing.id },
      data: activated
        ? { status: EmployeeAccountStatus.ACTIVE, disabledAt: null, disabledReason: null }
        : { status: EmployeeAccountStatus.INVITED, activationTokenHash: invitation.hash, activationTokenExpiresAt: invitation.expiresAt, invitedAt: new Date(), disabledAt: null, disabledReason: null },
    });
    await tx.employeeAccountAudit.create({ data: { organizationId: input.organizationId, employeeAccountId: account.id, actorUserId: input.actorUserId, action: EmployeeAccountAuditAction.ENABLED } });
    return { existing, activated };
  });
  if (result.activated) return { active: true, delivered: false, audited: true };
  const delivery = await deliverInvitation({
    accountId: result.existing.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    email: result.existing.user.email,
    employeeName: `${result.existing.employee.firstName} ${result.existing.employee.lastName}`,
    organizationName: result.existing.organization.name,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
    resent: true,
  });
  return { active: false, ...delivery };
}
