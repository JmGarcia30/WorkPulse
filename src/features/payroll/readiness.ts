import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getPayrollStatutorySetup } from './setup-queries';
import { inclusiveCalendarDays } from './domain';
import { resolvePayrollPolicy } from './policy';
import { attendanceReadinessIssue } from './attendance-evidence';
import { validateTableContext } from './bir/validation';
import { calculateSss, calculatePhilHealth, calculatePagIbig } from './statutory';

export async function getPayrollReadiness(input: { organizationId: string; actorUserId: string; payrollPeriodId: string }, db: Prisma.TransactionClient = prisma) {
  // The setup query checks the reviewer role and tenant before returning employee data.
  const rows = await getPayrollStatutorySetup(input, db);
  const period = await db.payrollPeriod.findFirstOrThrow({ where: { id: input.payrollPeriodId, organizationId: input.organizationId } });
  const [compensations, attendance, policyResult] = await Promise.all([
    db.employeeCompensation.findMany({ where: { organizationId: input.organizationId, status: 'ACTIVE', effectiveFrom: { lte: period.periodStart }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.periodEnd } }] } }),
    db.dailyAttendanceRecord.findMany({ where: { organizationId: input.organizationId, attendanceDate: { gte: period.periodStart, lte: period.periodEnd } }, select: { employeeId: true, attendanceDate: true, attendanceStatus: true, disposition: true, lateSeconds: true, undertimeSeconds: true } }),
    resolvePayrollPolicy(input.organizationId, period.periodStart, period.periodEnd, db).then(policy => ({ policy, error: null as string | null })).catch((e: unknown) => ({ policy: null, error: e instanceof Error ? e.message : 'Review payroll policy.' })),
  ]);
  const readiness = rows.map(row => {
    const records = compensations.filter(c => c.employeeId === row.id), compensation = records.length === 1 ? records[0] : null;
    const salary = records.length === 0 ? 'Salary effective date does not cover this payroll period.' : records.length > 1 ? 'Resolve overlapping salary records.' : null;
    let government: string | null = row.input ? null : row.reusable ? 'Review and reuse verified setup below.' : 'Verify government coverage, agency bases and tax classification in Advanced Payroll Setup.';
    try {
      validateTableContext(period.payDate.toISOString().slice(0, 10), compensation?.payFrequency as 'MONTHLY' | 'SEMI_MONTHLY');
      if (compensation && (compensation.compensationType !== 'MONTHLY' || compensation.currency !== 'PHP')) government = 'This compensation arrangement needs a supported statutory calculation method before generation.';
      if (row.input) {
        const context = { currency: 'PHP' as const, contributionMonth: period.periodStart.toISOString().slice(0, 7), arrangement: row.input.arrangement };
        calculateSss({ ...context, coverage: row.input.coverage.SSS, monthlyCompensation: row.input.monthlySssRemuneration });
        calculatePhilHealth({ ...context, coverage: row.input.coverage.PHILHEALTH, monthlyBasicSalary: row.input.monthlyPhilHealthBasic });
        calculatePagIbig({ ...context, coverage: row.input.coverage.PAGIBIG, monthlyFundSalary: row.input.monthlyPagIbigFundSalary });
        if (compensation && !compensation.baseRate.eq(row.input.monthlyPhilHealthBasic)) government = 'Review PhilHealth basic salary after the compensation change.';
      }
    } catch (e) { government = e instanceof Error ? e.message : 'No verified statutory rules cover this period.'; }
    const history = !row.opening ? 'Verify opening tax and benefit history; do not assume zero balances.' : row.opening.payDate > period.payDate.toISOString().slice(0, 10) ? 'Opening history starts after this payment date.' : null;
    const policy = policyResult.policy;
    const attendanceRequired = compensation?.compensationType === 'DAILY' || !!policy && [policy.lateDeductionRule, policy.absenceDeductionRule, policy.undertimeDeductionRule].some(rule => rule !== 'NONE');
    const attendanceIssue = policyResult.error ?? (attendanceRequired ? attendanceReadinessIssue(attendance.filter(d => d.employeeId === row.id), inclusiveCalendarDays(period.periodStart, period.periodEnd)) : null);
    const issues = [salary, government, history, attendanceIssue].filter((v): v is string => !!v);
    return { employeeId: row.id, employeeName: `${row.firstName} ${row.lastName}`, salary: salary ?? `${compensation?.currency} ${compensation?.baseRate.toFixed(2)} · ${compensation?.payFrequency.replaceAll('_', ' ').toLowerCase()}`, government: government ?? 'Verified period setup', history: history ?? 'Verified opening history saved', attendance: attendanceIssue ?? (attendanceRequired ? 'Attendance resolved' : 'No attendance deduction under current policy'), ready: issues.length === 0, action: issues.join(' ') || 'Generate payroll; calculation and ledger checks follow.' };
  });
  return { setup: rows, readiness };
}
export type PayrollReadinessRow = Awaited<ReturnType<typeof getPayrollReadiness>>['readiness'][number];
