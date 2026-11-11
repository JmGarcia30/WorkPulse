import { employeeAccessRoles } from '@/lib/auth/access-roles';
import { createHash } from 'node:crypto';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError } from './domain';
import { lockPayrollPeriod, payrollTransaction, type PayrollDb } from './transactions';

async function requireActor(db: PayrollDb, organizationId: string, actorUserId: string) {
  if (!await db.user.findFirst({ where: { id: actorUserId, organizationId, role: { in: [Role.HR_ADMIN, Role.ORGANIZATION_ADMIN] } } })) throw new PayrollError('FORBIDDEN', 'Unauthorized to notify employees.');
}

export async function previewPayrollNotifications(input: { organizationId: string; actorUserId: string; payrollPeriodId: string }, db: PayrollDb = prisma) {
  await requireActor(db, input.organizationId, input.actorUserId);
  const period = await db.payrollPeriod.findFirst({ where: { id: input.payrollPeriodId, organizationId: input.organizationId, status: 'FINALIZED', finalizedAt: { not: null } } });
  if (!period) throw new PayrollError('NOT_FINALIZED', 'Finalize this payroll period before notifying employees.');
  const entries = await db.payrollEntry.findMany({ where: { organizationId: input.organizationId, payrollPeriodId: period.id, status: 'FINALIZED' }, include: { employee: { select: { firstName: true, lastName: true } }, notification: true }, orderBy: { id: 'asc' } });
  const accounts = await db.employeeAccount.findMany({ where: { organizationId: input.organizationId, employeeId: { in: entries.map(entry => entry.employeeId) }, status: 'ACTIVE', employee: { organizationId: input.organizationId, employeeStatus: 'ACTIVE' }, user: { organizationId: input.organizationId, role: { in: employeeAccessRoles } } }, select: { employeeId: true, userId: true } });
  const recipients = entries.flatMap(entry => {
    const account = accounts.find(item => item.employeeId === entry.employeeId);
    return account ? [{ entryId: entry.id, employeeId: entry.employeeId, userId: account.userId, name: `${entry.employee.firstName} ${entry.employee.lastName}`, createdAt: entry.notification?.createdAt.toISOString() ?? null }] : [];
  });
  const token = createHash('sha256').update(JSON.stringify(recipients.map(row => [row.entryId, row.employeeId, row.userId]))).digest('hex');
  return { periodName: period.name, recipients, skipped: entries.length - recipients.length, token };
}

export async function notifyPayrollEmployees(input: { organizationId: string; actorUserId: string; payrollPeriodId: string; confirmation: string; recipientToken: string; employeeId?: string }, db: PayrollDb = prisma) {
  if (input.confirmation !== 'NOTIFY') throw new PayrollError('CONFIRMATION_REQUIRED', 'Review recipients and explicitly confirm notification.');
  return payrollTransaction(db, async tx => {
    await lockPayrollPeriod(tx, input.organizationId, input.payrollPeriodId);
    const preview = await previewPayrollNotifications(input, tx);
    if (input.recipientToken !== preview.token) throw new PayrollError('STALE_RECIPIENTS', 'Recipients changed. Refresh and review the recipient list again.');
    const recipients = input.employeeId ? preview.recipients.filter(row => row.employeeId === input.employeeId) : preview.recipients;
    if (input.employeeId && recipients.length === 0) throw new PayrollError('NOT_FOUND', 'The selected employee has no eligible finalized payslip recipient.');
    let created = 0;
    for (const row of recipients) {
      const result = await tx.payrollNotification.createMany({ data: [{ organizationId: input.organizationId, employeeId: row.employeeId, payrollEntryId: row.entryId, recipientUserId: row.userId, actorUserId: input.actorUserId, message: `Your payslip for ${preview.periodName} is now available. Visit My Payroll to review your earnings, deductions, attendance, and net pay.` }], skipDuplicates: true });
      created += result.count;
    }
    return { created, alreadyCreated: recipients.length - created };
  });
}

/** Apply the effective payroll policy after finalization; notification failures never roll back payslips. */
export async function notifyPayrollEmployeesIfConfigured(input: { organizationId: string; actorUserId: string; payrollPeriodId: string }, db: PayrollDb = prisma) {
  const period = await db.payrollPeriod.findFirst({ where: { id: input.payrollPeriodId, organizationId: input.organizationId, status: 'FINALIZED', finalizedAt: { not: null } } });
  if (!period) return { enabled: false, created: 0 };
  const policies = await db.organizationPayrollPolicy.findMany({ where: { organizationId: input.organizationId, status: 'ACTIVE', notifyEmployeesOnFinalization: true, effectiveFrom: { lte: period.periodStart }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.periodEnd } }] }, select: { id: true } });
  if (policies.length !== 1) return { enabled: false, created: 0 };
  const preview = await previewPayrollNotifications({ ...input }, db);
  const result = await notifyPayrollEmployees({ ...input, confirmation: 'NOTIFY', recipientToken: preview.token }, db);
  return { enabled: true, ...result };
}

export async function listPayrollNotifications(input: { organizationId: string; userId: string }, db: PayrollDb = prisma) {
  const account = await db.employeeAccount.findFirst({ where: { organizationId: input.organizationId, userId: input.userId, status: 'ACTIVE', employee: { organizationId: input.organizationId, employeeStatus: 'ACTIVE' }, user: { role: { in: employeeAccessRoles }, organizationId: input.organizationId } }, select: { employeeId: true } });
  if (!account) throw new PayrollError('FORBIDDEN', 'Employee payroll access is unavailable.');
  return db.payrollNotification.findMany({ where: { organizationId: input.organizationId, recipientUserId: input.userId, employeeId: account.employeeId, entry: { status: 'FINALIZED', payrollPeriod: { organizationId: input.organizationId, status: 'FINALIZED', finalizedAt: { not: null } } } }, select: { id: true, message: true, payrollEntryId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 30 });
}
