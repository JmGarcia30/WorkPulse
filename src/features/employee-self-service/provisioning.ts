import { Prisma, type Role } from '@prisma/client';
import { hasEmployeeSelfRole } from '@/lib/auth/access-roles';
import { EmployeeAccountError } from './errors';
import type { createEmployeeInvitation } from './activation';

export async function assertEmployeeAccountManager(tx: Prisma.TransactionClient, input: {
  organizationId: string; actorUserId: string; accountId?: string; targetRole?: Role;
}) {
  const account = input.accountId ? await tx.employeeAccount.findFirst({ where: { id: input.accountId, organizationId: input.organizationId }, select: { userId: true } }) : null;
  if (input.accountId && !account) throw new EmployeeAccountError('NOT_FOUND','Employee account not found.');
  const ids = [input.actorUserId, ...(account ? [account.userId] : [])].sort();
  await tx.$queryRaw`SELECT id FROM "User" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  const actor = await tx.user.findFirst({ where: { id: input.actorUserId, organizationId: input.organizationId } });
  const target = account ? await tx.user.findUniqueOrThrow({ where: { id: account.userId } }) : null;
  if (!actor || !['HR_ADMIN','ORGANIZATION_ADMIN'].includes(actor.role) ||
      (actor.role !== 'ORGANIZATION_ADMIN' && ((target && target.role !== 'EMPLOYEE') || (input.targetRole && input.targetRole !== 'EMPLOYEE')))) {
    throw new EmployeeAccountError('UNAUTHORIZED','Only an Organization Administrator can assign or manage management-role accounts.');
  }
  return actor;
}

export async function provisionEmployeeAccountInTransaction(tx: Prisma.TransactionClient, input: {
  organizationId: string; employeeId: string; actorUserId: string; role: Role;
  invitation: ReturnType<typeof createEmployeeInvitation>; existingUserId?: string; allowInactive?: boolean;
}) {
  const actor = await assertEmployeeAccountManager(tx,input);
  if (!hasEmployeeSelfRole(input.role) || (actor.role !== 'ORGANIZATION_ADMIN' && input.role !== 'EMPLOYEE')) {
    throw new EmployeeAccountError('UNAUTHORIZED','Only an Organization Administrator can assign management roles.');
  }
  const employee = await tx.employee.findFirst({ where: { id: input.employeeId, organizationId: input.organizationId }, include: {
    organization: { select: { name: true } }, employeeAccount: { select: { id: true } },
    employmentRecords: { where: { effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, select: { id: true }, take: 1 },
  } });
  if (!employee) throw new EmployeeAccountError('NOT_FOUND','Employee not found or access denied.');
  const active = employee.employeeStatus === 'ACTIVE';
  if ((!active && !input.allowInactive) || employee.employeeStatus === 'SEPARATED' || !employee.employmentRecords.length) {
    throw new EmployeeAccountError('INACTIVE_EMPLOYEE','An eligible employee with a current employment record is required.');
  }
  if (employee.employeeAccount) throw new EmployeeAccountError('DUPLICATE_ACCOUNT','This employee already has an account.');
  const email = employee.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new EmployeeAccountError('INVALID_EMAIL','Enter a valid account email.');
  let user;
  if (input.existingUserId) {
    if (actor.role !== 'ORGANIZATION_ADMIN' || !active) throw new EmployeeAccountError('UNAUTHORIZED','An Organization Administrator must explicitly link an active employee to an existing account.');
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${input.existingUserId} FOR UPDATE`;
    user = await tx.user.findFirst({ where: { id: input.existingUserId, organizationId: input.organizationId }, include: { employeeAccount: { select: { id: true } } } });
    if (!user || user.email.toLowerCase() !== email || user.role !== input.role || !user.passwordHash || user.employeeAccount) {
      throw new EmployeeAccountError('INVALID_ACCOUNT_LINK','Select an activated, unlinked account in this organization with matching email and role.');
    }
  } else {
    if (await tx.user.findFirst({ where:{ email:{ equals:email,mode:'insensitive' } },select:{ id:true } })) {
      throw new EmployeeAccountError('DUPLICATE_ACCOUNT_OR_EMAIL','An account already uses this email. An Organization Administrator must explicitly review and link an eligible existing account.');
    }
    user = await tx.user.create({ data: { organizationId: input.organizationId, name: `${employee.firstName} ${employee.lastName}`, email, role: input.role, passwordHash: null } });
  }
  const linked = !!input.existingUserId;
  const account = await tx.employeeAccount.create({ data: {
    organizationId: input.organizationId, userId: user.id, employeeId: employee.id, createdById: actor.id,
    status: linked ? 'ACTIVE' : active ? 'INVITED' : 'DISABLED', activatedAt: linked ? new Date() : null,
    activationTokenHash: !linked && active ? input.invitation.hash : null,
    activationTokenExpiresAt: !linked && active ? input.invitation.expiresAt : null,
    disabledAt: active ? null : new Date(), disabledReason: active ? null : 'Employee registered as inactive.',
  } });
  await tx.employeeAccountAudit.createMany({ data: [
    { organizationId: input.organizationId, employeeAccountId: account.id, actorUserId: actor.id, action: 'ACCOUNT_CREATED', details: { role: user.role, existingAccount: linked } },
    { organizationId: input.organizationId, employeeAccountId: account.id, actorUserId: actor.id, action: 'EMPLOYEE_LINKED', details: { employeeId: employee.id, userId: user.id } },
  ] });
  return { accountId: account.id, email, employeeName: `${employee.firstName} ${employee.lastName}`, organizationName: employee.organization.name, status: account.status, existingAccount: linked };
}
