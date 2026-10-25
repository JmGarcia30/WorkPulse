import { CompensationStatus, PayrollEntryStatus, PayrollPeriodStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError, inclusiveCalendarDays } from './domain';
import { resolvePayrollPolicy } from './policy';
import { lockPayrollPeriod, payrollTransaction } from './transactions';
import { statutoryEntryIssue } from './statutory-integration';
import { attendanceReadinessIssue, payrollAttendanceEvidence } from './attendance-evidence';

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
  leaveSummary?: { unpaidDays?: number };
  compensation?: { id?: string };
  policy?: { id?: string; version?: number };
  calculation?: { baseAmount?: string; grossAmount?: string; totalDeductions?: string; netAmount?: string; attendanceAffectsPay?: boolean };
  attendanceEvidence?: string | null;
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

export const payrollReviewEntryInclude = {
  employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
  employeeCompensation: true,
} as const;
type ReviewEmployee = { id: string; employeeNumber: string; firstName: string; lastName: string };
type ReviewEntry = Prisma.PayrollEntryGetPayload<{ include: typeof payrollReviewEntryInclude }>;
type ReviewReadInputs = { employees: ReviewEmployee[]; entries: ReviewEntry[] };

export async function assessPayrollPeriod(organizationId: string, payrollPeriodId: string, db: PayrollDb = prisma) {
  return assessPeriod(organizationId, payrollPeriodId, db);
}

// Server read-model reuse only. Finalization always calls the fresh wrapper above,
// inside its existing transaction; it cannot receive these preloaded read inputs.
export async function assessPayrollPeriodFromReadInputs(organizationId: string, payrollPeriodId: string, db: PayrollDb, inputs: ReviewReadInputs) {
  if (inputs.entries.some(entry => entry.organizationId !== organizationId || entry.payrollPeriodId !== payrollPeriodId)) throw new PayrollError('FORBIDDEN', 'Payroll review inputs are outside the requested period.');
  return assessPeriod(organizationId, payrollPeriodId, db, inputs);
}

async function assessPeriod(organizationId: string, payrollPeriodId: string, db: PayrollDb, inputs?: ReviewReadInputs) {
  const period = await db.payrollPeriod.findFirst({
    where: { id: payrollPeriodId, organizationId },
    include: { finalizedBy: { select: { name: true } } },
  });
  if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period not found.');
  const [employees, entries] = inputs ? [inputs.employees, inputs.entries] : await Promise.all([
    db.employee.findMany({
      where: { organizationId, employeeStatus: 'ACTIVE' },
      select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    db.payrollEntry.findMany({
      where: { organizationId, payrollPeriodId },
      include: payrollReviewEntryInclude,
      orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
    }),
  ]);
  const entriesByEmployee = new Map(entries.map(entry => [entry.employeeId, entry]));
  const issues: PayrollReviewIssue[] = [];
  const compensationEmployeeIds = employees.filter(employee => {
    const snapshot = snapshotObject(entriesByEmployee.get(employee.id)?.calculationSnapshot ?? null);
    return snapshot?.compensation?.id && snapshot.policy?.id && typeof snapshot.policy.version === 'number' && snapshot.calculation;
  }).map(employee => employee.id);
  const [compensationGroups, policyResult] = await Promise.all([
    compensationEmployeeIds.length ? db.employeeCompensation.groupBy({
      by: ['employeeId'], where: {
        organizationId, employeeId: { in: compensationEmployeeIds }, status: CompensationStatus.ACTIVE,
        effectiveFrom: { lte: period.periodStart }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.periodEnd } }],
      }, _count: { _all: true },
    }) : [],
    resolvePayrollPolicy(organizationId, period.periodStart, period.periodEnd, db)
      .then(policy => ({ policy, error: null }))
      .catch((error: unknown) => ({ policy: null, error: error instanceof Error ? error.message : 'Payroll policy could not be resolved.' })),
  ]);
  const applicableCounts = new Map(compensationGroups.map(group => [group.employeeId, group._count._all]));
  const resolvedPolicy = policyResult.policy;
  if (policyResult.error !== null) issues.push({ kind: 'SETUP_REQUIRED', message: policyResult.error });

  for (const employee of employees) {
    const identity = { employeeId: employee.id, employeeNumber: employee.employeeNumber, employeeName: `${employee.firstName} ${employee.lastName}`.trim() };
    const entry = entriesByEmployee.get(employee.id);
    if (!entry) {
      issues.push({ ...identity, kind: 'SETUP_REQUIRED', message: 'Generate a valid payroll entry for this eligible employee.' });
      continue;
    }
    const snapshot = snapshotObject(entry.calculationSnapshot);
    if (period.status !== PayrollPeriodStatus.FINALIZED && entry.employeeCompensation.compensationType === 'MONTHLY'
      && (snapshot?.leaveSummary?.unpaidDays ?? 0) > 0) {
      issues.push({ ...identity, kind: 'SETUP_REQUIRED', message: 'Monthly unpaid leave requires a reviewed salary-reduction method before finalization.' });
    }
    if (period.status !== PayrollPeriodStatus.FINALIZED) {
      const statutoryIssue = await statutoryEntryIssue(db, entry);
      if (statutoryIssue) issues.push({ ...identity, kind: 'SETUP_REQUIRED', message: statutoryIssue });
    }
    if (!snapshot || !snapshot.compensation?.id || !snapshot.policy?.id || typeof snapshot.policy.version !== 'number' || !snapshot.calculation) {
      issues.push({ ...identity, kind: 'CALCULATION_ERROR', message: 'The payroll entry has an incomplete calculation snapshot and must be regenerated before finalization.' });
      continue;
    }
    if (period.status === PayrollPeriodStatus.REVIEW && entry.status !== PayrollEntryStatus.REVIEW) {
      issues.push({ ...identity, kind: 'CALCULATION_ERROR', message: 'The payroll entry has not entered review status.' });
    }
    if (period.status !== PayrollPeriodStatus.FINALIZED && snapshot.calculation?.attendanceAffectsPay) {
      const attendance = await db.dailyAttendanceRecord.findMany({
        where: { organizationId, employeeId: employee.id, attendanceDate: { gte: period.periodStart, lte: period.periodEnd } },
        select: { attendanceDate: true, attendanceStatus: true, disposition: true, lateSeconds: true, undertimeSeconds: true },
        orderBy: { attendanceDate: 'asc' },
      });
      const issue = attendanceReadinessIssue(attendance, inclusiveCalendarDays(period.periodStart, period.periodEnd));
      if (issue || snapshot.attendanceEvidence !== payrollAttendanceEvidence(attendance)) {
        issues.push({ ...identity, kind: 'SETUP_REQUIRED', message: issue ?? 'Attendance calculation inputs changed or the snapshot lacks attendance evidence. Review and explicitly recalculate payroll before finalization.' });
      }
    }
    const compensation = entry.employeeCompensation;
    const applicableCompensationCount = applicableCounts.get(employee.id) ?? 0;
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
  const eligibleEmployeeIds = new Set(employees.map(employee => employee.id));
  for (const entry of entries.filter(item => !eligibleEmployeeIds.has(item.employeeId))) {
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
  return payrollTransaction(db, async tx => {
    await lockPayrollPeriod(tx, input.organizationId, input.payrollPeriodId);
    return moveToReviewInTransaction(input, tx);
  });
}

async function moveToReviewInTransaction(input: { organizationId: string; actorUserId: string; payrollPeriodId: string }, db: Prisma.TransactionClient) {
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
  await lockPayrollPeriod(db, input.organizationId, input.payrollPeriodId);
  const actor = await requirePayrollReviewer(db, input.organizationId, input.actorUserId);
  // Hold the consumed daily rows stable through the final review and commit.
  // RFID/corrections can proceed afterward; finalized snapshots remain immutable.
  await db.$queryRaw`SELECT d.id FROM "DailyAttendanceRecord" d
    JOIN "PayrollPeriod" p ON p.id = ${input.payrollPeriodId} AND p."organizationId" = d."organizationId"
    WHERE d."organizationId" = ${input.organizationId}
      AND d."attendanceDate" BETWEEN p."periodStart" AND p."periodEnd"
    ORDER BY d."employeeId", d."attendanceDate" FOR SHARE OF d`;
  const review = await assessPayrollPeriod(input.organizationId, input.payrollPeriodId, db);
  if (review.period.status === PayrollPeriodStatus.FINALIZED) throw new PayrollError('FINALIZED', 'Payroll is already finalized.');
  if (review.period.status !== PayrollPeriodStatus.REVIEW) throw new PayrollError('NOT_IN_REVIEW', 'Move the payroll period to review before finalizing.');
  if (!review.canFinalize) {
    const details = review.issues.map(issue => `${issue.employeeNumber ? `${issue.employeeNumber}: ` : ''}${issue.message}`).join(' ');
    throw new PayrollError(review.issues.some(issue => issue.kind === 'SETUP_REQUIRED') ? 'SETUP_REQUIRED' : 'FINALIZATION_BLOCKED', details || 'Payroll finalization requirements are not complete.');
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
  return payrollTransaction(db ?? prisma, tx => finalizeInTransaction(input, tx));
}
