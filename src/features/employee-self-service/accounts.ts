import 'server-only';
import { EmployeeAccountError } from './errors';
export { EmployeeAccountError } from './errors';
import { assertEmployeeAccountManager, provisionEmployeeAccountInTransaction } from './provisioning';

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
import { workspaceActivationOrigin } from '@/features/platform-admin/onboarding';
import { disableEmployeeAccountInTransaction } from './account-state';



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

export async function deliverEmployeeInvitation(input: {
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
  let delivery: { success:boolean; mode:string };
  try {
    const organization = await prisma.organization.findUniqueOrThrow({ where:{ id:input.organizationId },select:{ slug:true } });
    const baseUrl = workspaceActivationOrigin(organization.slug).replace(/\/$/, '');
    const activationUrl = `${baseUrl}/activate/employee#token=${encodeURIComponent(input.token)}`;
    delivery = await sendEmployeeActivationEmail({
    to: input.email,
    employeeName: input.employeeName,
    organizationName: input.organizationName,
    activationUrl,
    expiresAt: input.expiresAt,
    });
  } catch { delivery = { success:false,mode:'UNAVAILABLE' }; }
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
      return provisionEmployeeAccountInTransaction(tx, { ...input, role: Role.EMPLOYEE, invitation });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const delivery = await deliverEmployeeInvitation({
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
  const account = await prisma.$transaction(async tx => {
    await assertEmployeeAccountManager(tx,input);
    return tx.employeeAccount.update({
    where: { id: input.accountId, organizationId: input.organizationId, status: EmployeeAccountStatus.INVITED },
    data: { activationTokenHash: invitation.hash, activationTokenExpiresAt: invitation.expiresAt, invitedAt: new Date() },
    select: {
      id: true,
      user: { select: { email: true } },
      employee: { select: { firstName: true, lastName: true } },
      organization: { select: { name: true } },
    },
    });
  });
  return deliverEmployeeInvitation({
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

export async function activateEmployeeAccount(input: { token: string; password: string; passwordConfirmation: string; organizationId?: string }) {
  const raw = input.token.trim();
  const byteLength = Buffer.byteLength(input.password, 'utf8');
  if (!isActivationTokenFormatValid(raw)) throw new EmployeeAccountError('INVALID_ACTIVATION', 'This activation link is invalid or expired.');
  if (input.password !== input.passwordConfirmation) throw new EmployeeAccountError('PASSWORD_MISMATCH', 'Passwords do not match.');
  if (byteLength < 12 || byteLength > 72) throw new EmployeeAccountError('INVALID_PASSWORD', 'Password must be between 12 and 72 bytes.');
  const passwordHash = await hash(input.password, 12);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const activated = await activateEmployeeAccountInTransaction(tx, { token: raw, passwordHash, now, organizationId:input.organizationId });
    if (!activated) throw new EmployeeAccountError('INVALID_ACTIVATION', 'This activation link is invalid or expired.');
    return { success: true as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function disableEmployeeAccount(input: { organizationId: string; accountId: string; actorUserId: string; reason: string }) {
  await assertProvisioningActor(input.organizationId, input.actorUserId);
  const reason = input.reason.trim();
  if (!reason || reason.length > 2000) throw new EmployeeAccountError('INVALID_REASON', 'A disable reason is required.');
  return prisma.$transaction(async (tx) => {
    await assertEmployeeAccountManager(tx,input);
    return disableEmployeeAccountInTransaction(tx, { ...input, reason, now: new Date() });
  });
}

export async function enableEmployeeAccount(input: { organizationId: string; accountId: string; actorUserId: string }) {
  await assertProvisioningActor(input.organizationId, input.actorUserId);
  const invitation = createEmployeeInvitation();
  const result = await prisma.$transaction(async (tx) => {
    await assertEmployeeAccountManager(tx,input);
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
  const delivery = await deliverEmployeeInvitation({
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
