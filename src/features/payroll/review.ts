import { CompensationStatus, PayrollEntryStatus, PayrollPeriodStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError } from './domain';
import { resolvePayrollPolicy } from './policy';

type PayrollDb = Prisma.TransactionClient | typeof prisma;

async function requirePayrollReviewer(db: PayrollDb, organizationId: string, actorUserId: string) {
  const actor = await db.user.findFirst({
    where: { id: actorUserId, organizationId, role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] } },
    select: { id: true, name: true },
  });
  if (!actor) throw new PayrollError('FORBIDDEN', 'Unauthorized to review or finalize payroll.');
  return actor;
}

type SnapshotShape = {
  compensation?: { id?: string };
  policy?: { id?: string; version?: number };
  calculation?: { baseAmount?: string; grossAmount?: string; totalDeductions?: string; netAmount?: string };
};

function snapshotObject(value: Prisma.JsonValue | null): SnapshotShape | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SnapshotShape : null;
}

function amountsMatch(entry: { baseAmount: Prisma.Decimal; grossAmount: Prisma.Decimal; totalDeductions: Prisma.Decimal; netAmount: Prisma.Decimal }, snapshot: SnapshotShape) {
  try {
    const values = [entry.baseAmount, entry.grossAmount, entry.totalDeductions, entry.netAmount];
    if (values.some(value => !value.isFinite() || value.isNegative())) return false;
    if (!entry.netAmount.equals(entry.grossAmount.sub(entry.totalDeductions))) return false;
    return new Prisma.Decimal(snapshot.calculation?.baseAmount ?? '').equals(entry.baseAmount)
      && new Prisma.Decimal(snapshot.calculation?.grossAmount ?? '').equals(entry.grossAmount)
      && new Prisma.Decimal(snapshot.calculation?.totalDeductions ?? '').equals(entry.totalDeductions)
      && new Prisma.Decimal(snapshot.calculation?.netAmount ?? '').equals(entry.netAmount);
  } catch { return false; }
}

export type PayrollReviewIssue = {
  employeeId?: string;
  employeeNumber?: string;
  employeeName?: string;
  kind: 'SETUP_REQUIRED' | 'CALCULATION_ERROR';
  message: string;
};

export async function assessPayrollPeriod(organizationId: string, payrollPeriodId: string, db: PayrollDb = prisma) {
  const period = await db.payrollPeriod.findFirst({
    where: { id: payrollPeriodId, organizationId },
    include: { finalizedBy: { select: { name: true } } },
  });
  if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period not found.');
  const [employees, entries] = await Promise.all([
    db.employee.findMany({
      where: { organizationId, employeeStatus: 'ACTIVE' },
      select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    db.payrollEntry.findMany({
      where: { organizationId, payrollPeriodId },
      include: {
        employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
        employeeCompensation: true,
      },
      orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
    }),
  ]);
  const entriesByEmployee = new Map(entries.map(entry => [entry.employeeId, entry]));
  const issues: PayrollReviewIssue[] = [];
  let resolvedPolicy: Awaited<ReturnType<typeof resolvePayrollPolicy>> | null = null;
  try { resolvedPolicy = await resolvePayrollPolicy(organizationId, period.periodStart, period.periodEnd, db); }
  catch (error) {
    issues.push({ kind: 'SETUP_REQUIRED', message: error instanceof Error ? error.message : 'Payroll policy could not be resolved.' });
  }

  for (const employee of employees) {
    const identity = { employeeId: employee.id, employeeNumber: employee.employeeNumber, employeeName: `${employee.firstName} ${employee.lastName}`.trim() };
    const entry = entriesByEmployee.get(employee.id);
    if (!entry) {
      issues.push({ ...identity, kind: 'SETUP_REQUIRED', message: 'Generate a valid payroll entry for this eligible employee.' });
      continue;
    }
    const snapshot = snapshotObject(entry.calculationSnapshot);
    if (!snapshot || !snapshot.compensation?.id || !snapshot.policy?.id || typeof snapshot.policy.version !== 'number' || !snapshot.calculation) {
      issues.push({ ...identity, kind: 'CALCULATION_ERROR', message: 'The payroll entry has an incomplete calculation snapshot and must be regenerated before finalization.' });
      continue;
    }
    if (period.status === PayrollPeriodStatus.REVIEW && entry.status !== PayrollEntryStatus.REVIEW) {
      issues.push({ ...identity, kind: 'CALCULATION_ERROR', message: 'The payroll entry has not entered review status.' });
    }
    const compensation = entry.employeeCompensation;
    const applicableCompensationCount = await db.employeeCompensation.count({
      where: {
        organizationId, employeeId: employee.id, status: CompensationStatus.ACTIVE,
        effectiveFrom: { lte: period.periodStart }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.periodEnd } }],
      },
    });
    const compensationValid = compensation.organizationId === organizationId
      && compensation.employeeId === employee.id
      && compensation.status === CompensationStatus.ACTIVE
      && compensation.effectiveFrom <= period.periodStart
      && (!compensation.effectiveTo || compensation.effectiveTo >= period.periodEnd)
      && applicableCompensationCount === 1
      && snapshot.compensation.id === entry.employeeCompensationId;
    if (!compensationValid) {
      issues.push({ ...identity, kind: 'SETUP_REQUIRED', message: 'The snapshotted compensation is not the applicable active compensation for the full period.' });
    }
    if (resolvedPolicy && (snapshot.policy.id !== resolvedPolicy.id || snapshot.policy.version !== resolvedPolicy.version)) {
      issues.push({ ...identity, kind: 'SETUP_REQUIRED', message: 'The entry policy snapshot does not match the policy resolved for this payroll period.' });
    }
    if (!amountsMatch(entry, snapshot)) {
      issues.push({ ...identity, kind: 'CALCULATION_ERROR', message: 'Stored amounts do not match the immutable calculation snapshot or net-pay equation.' });
    }
  }
  for (const entry of entries.filter(item => !employees.some(employee => employee.id === item.employeeId))) {
    issues.push({
      employeeId: entry.employeeId, employeeNumber: entry.employee.employeeNumber,
      employeeName: `${entry.employee.firstName} ${entry.employee.lastName}`.trim(),
      kind: 'CALCULATION_ERROR', message: 'The payroll entry belongs to an employee who is not currently eligible for this period.',
    });
  }
  const totals = entries.reduce((sum, entry) => ({
    employeeCount: sum.employeeCount + 1,
    gross: sum.gross.add(entry.grossAmount), deductions: sum.deductions.add(entry.totalDeductions), net: sum.net.add(entry.netAmount),
  }), { employeeCount: 0, gross: new Prisma.Decimal(0), deductions: new Prisma.Decimal(0), net: new Prisma.Decimal(0) });
  const issueEmployeeIds = new Set(issues.map(issue => issue.employeeId).filter(Boolean));
  const setupSubjects = new Set(issues.filter(issue => issue.kind === 'SETUP_REQUIRED').map(issue => issue.employeeId ?? 'period'));
  const errorSubjects = new Set(issues.filter(issue => issue.kind === 'CALCULATION_ERROR').map(issue => issue.employeeId ?? 'period'));
  return {
    period, entries, issues,
    summary: {
      totalEmployees: employees.length,
      ready: employees.filter(employee => entriesByEmployee.has(employee.id) && !issueEmployeeIds.has(employee.id)).length,
      setupRequired: setupSubjects.size,
      errors: errorSubjects.size,
    },
    totals: { employeeCount: totals.employeeCount, gross: totals.gross.toFixed(2), deductions: totals.deductions.toFixed(2), net: totals.net.toFixed(2) },
    canFinalize: period.status === PayrollPeriodStatus.REVIEW && issues.length === 0 && entries.length === employees.length && employees.length > 0,
  };
}

export async function movePayrollPeriodToReview(input: { organizationId: string; actorUserId: string; payrollPeriodId: string }, db: PayrollDb = prisma) {
  await requirePayrollReviewer(db, input.organizationId, input.actorUserId);
  const period = await db.payrollPeriod.findFirst({ where: { id: input.payrollPeriodId, organizationId: input.organizationId } });
  if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period not found.');
  if (period.status === PayrollPeriodStatus.FINALIZED) throw new PayrollError('FINALIZED', 'Finalized payroll cannot return to review.');
  if (period.status === PayrollPeriodStatus.REVIEW) return period;
  await db.payrollEntry.updateMany({
    where: { organizationId: input.organizationId, payrollPeriodId: period.id, status: PayrollEntryStatus.DRAFT },
    data: { status: PayrollEntryStatus.REVIEW },
  });
  return db.payrollPeriod.update({ where: { id: period.id }, data: { status: PayrollPeriodStatus.REVIEW } });
}

async function finalizeInTransaction(input: { organizationId: string; actorUserId: string; payrollPeriodId: string }, db: Prisma.TransactionClient) {
  const actor = await requirePayrollReviewer(db, input.organizationId, input.actorUserId);
  const review = await assessPayrollPeriod(input.organizationId, input.payrollPeriodId, db);
  if (review.period.status === PayrollPeriodStatus.FINALIZED) throw new PayrollError('FINALIZED', 'Payroll is already finalized.');
  if (review.period.status !== PayrollPeriodStatus.REVIEW) throw new PayrollError('NOT_IN_REVIEW', 'Move the payroll period to review before finalizing.');
  if (!review.canFinalize) {
    const details = review.issues.map(issue => `${issue.employeeNumber ? `${issue.employeeNumber}: ` : ''}${issue.message}`).join(' ');
    throw new PayrollError('FINALIZATION_BLOCKED', details || 'Payroll finalization requirements are not complete.');
  }
  const finalizedAt = new Date();
  await db.payrollEntry.updateMany({
    where: { organizationId: input.organizationId, payrollPeriodId: input.payrollPeriodId },
    data: { status: PayrollEntryStatus.FINALIZED },
  });
  return db.payrollPeriod.update({
    where: { id: input.payrollPeriodId },
    data: { status: PayrollPeriodStatus.FINALIZED, finalizedById: actor.id, finalizedAt },
    include: { finalizedBy: { select: { name: true } } },
  });
}

export async function finalizePayrollPeriod(input: { organizationId: string; actorUserId: string; payrollPeriodId: string; confirmation: string }, db?: PayrollDb) {
  if (input.confirmation !== 'FINALIZE') throw new PayrollError('CONFIRMATION_REQUIRED', 'Explicit finalization confirmation is required.');
  if (db && '$transaction' in db === false) return finalizeInTransaction(input, db as Prisma.TransactionClient);
  return prisma.$transaction(tx => finalizeInTransaction(input, tx), { timeout: 120_000 });
}
