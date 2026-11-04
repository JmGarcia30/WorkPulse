import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';
import { organization, employee, period, setup, payload } from './test-payroll-integration';
import { createPayrollPolicy } from '../src/features/payroll/policy';
import { generatePayroll } from '../src/features/payroll/service';
import { assessPayrollPeriod, movePayrollPeriodToReview, finalizePayrollPeriod } from '../src/features/payroll/review';
import { changePayrollEarning, earningsVersion } from '../src/features/payroll/earnings';
import { payrollEarningsBreakdown } from '../src/features/payroll/earnings-breakdown';
const db = new PrismaClient({ log: [] });
const checks: string[] = [], amounts: unknown[] = [];
const check = (value: unknown, label: string) => { assert(value, label); checks.push(label); console.log('PASS', label); };
const rollback = Error('V2_EDGE_ROLLBACK');
const date = (s: string) => new Date(s + 'T00:00:00Z');
async function main() {
  const [identity] = await db.$queryRaw<Array<{ branch: string }>>`SELECT current_setting('neon.branch_id',true) AS branch`;
  assert.equal(identity.branch, 'br-green-king-azcpyvmo');
  check(payrollEarningsBreakdown({ version: 'legacy' }) === null, 'Missing historical earnings are unavailable');
  try { await db.$transaction(async tx => {
    const scope = await organization(tx), person = await employee(tx, scope), p = await period(tx, scope);
    const context = { ...scope, payrollPeriodId: p.id };
    await createPayrollPolicy({ ...scope, effectiveFrom: '2026-01-01', dailyPayBasis: 'SCHEDULED_PAYABLE_DAYS', lateDeductionRule: 'PER_MINUTE', lateDeductionParameter: '1', absenceDeductionRule: 'FIXED_PER_ABSENCE', absenceDeductionParameter: '100', undertimeDeductionRule: 'PER_MINUTE', undertimeDeductionParameter: '10', roundingRule: 'STANDARD_2_DECIMAL' }, tx);
    const reviewed = payload(); reviewed.companyDeductionTreatment = { late: 'SALARY_REDUCTION', absence: 'SALARY_REDUCTION', undertime: 'NET_DEDUCTION' };
    reviewed.monthlySssRemuneration = '34790';
    await setup(tx, scope, person, p.id, reviewed);
    check((await generatePayroll(context, tx)).createdCount === 0, 'Missing attendance evidence blocks payroll');
    await tx.dailyAttendanceRecord.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ organizationId: scope.organizationId, employeeId: person.id, employmentRecordId: person.employment.id, attendanceDate: date(`2026-09-${String(i + 1).padStart(2, '0')}`), timeZoneSnapshot: 'UTC', attendanceStatus: i < 2 ? 'ABSENT' as const : 'PRESENT' as const, disposition: 'NORMAL' as const, lateSeconds: i === 2 ? 600 : 0, undertimeSeconds: i === 2 ? 120 : 0, lastCalculatedAt: new Date() })) });
    check((await generatePayroll(context, tx)).createdCount === 1, 'Resolved attendance permits calculation');
    const entry = await tx.payrollEntry.findFirstOrThrow({ where: { payrollPeriodId: p.id, organizationId: scope.organizationId } });
    // Manually: 2*100 absence + 10*1 late = 210 salary reduction; 2*10 undertime=20 net-only.
    // Taxable 35000-210-2825=31965. BIR (31965-20833)*15%=1669.80.
    // Deductions 210+20+2825+1669.80=4724.80; net=30275.20.
    const actual = { gross: entry.grossAmount.toFixed(2), deductions: entry.totalDeductions.toFixed(2), net: entry.netAmount.toFixed(2), tax: ((entry.calculationSnapshot as Prisma.JsonObject).statutory as Prisma.JsonObject).birWithholding };
    const expected = { gross: '35000.00', deductions: '4724.80', net: '30275.20', tax: '1669.80' };
    assert.deepEqual(actual, expected); amounts.push({ label: 'Two absences + lateness + undertime', expected, actual }); check(true, 'Independent attendance deduction totals match');
    await movePayrollPeriodToReview(context, tx);
    await tx.dailyAttendanceRecord.updateMany({ where: { organizationId: scope.organizationId, employeeId: person.id, attendanceDate: date('2026-09-03') }, data: { lateSeconds: 0 } });
    check(!(await assessPayrollPeriod(scope.organizationId, p.id, tx)).canFinalize, 'Attendance correction invalidates unfinished calculation');
    await assert.rejects(() => finalizePayrollPeriod({ ...context, confirmation: 'FINALIZE' }, tx)); check(true, 'Unresolved attendance changes block finalization');
    const stored = await tx.payrollStatutoryInput.findFirstOrThrow({ where: { payrollPeriodId: p.id, employeeId: person.id } });
    await changePayrollEarning({ ...context, employeeId: person.id, expectedVersion: earningsVersion(stored.payload), operation: 'RECALCULATE', reason: 'Approved attendance correction', confirmRecalculation: true }, tx);
    check((await generatePayroll(context, tx)).createdCount === 1, 'Explicit recalculation consumes corrected attendance');
    const leaveType = await tx.leaveType.create({ data: { organizationId: scope.organizationId, code: 'V2-UNPAID', name: 'Unpaid fixture', isPaid: false, countingMode: 'SCHEDULED_WORK_DAYS', policyReference: 'Synthetic reviewed leave policy' } });
    const request = await tx.leaveRequest.create({ data: { organizationId: scope.organizationId, employeeId: person.id, leaveTypeId: leaveType.id, requestedStartDate: date('2026-09-04'), requestedEndDate: date('2026-09-04'), requestedUnits: 1, calculationFinalizedAt: new Date(), reason: 'Synthetic unpaid leave', status: 'APPROVED', policySnapshot: {}, leaveTypeCodeSnapshot: leaveType.code, leaveTypeNameSnapshot: leaveType.name, leavePaidSnapshot: false, countingModeSnapshot: 'SCHEDULED_WORK_DAYS' } });
    await tx.leaveRequestDay.create({ data: { organizationId: scope.organizationId, leaveRequestId: request.id, employeeId: person.id, attendanceDate: date('2026-09-04'), employmentRecordId: person.employment.id, isScheduledWorkday: true, scheduledStartSecond: 28800, scheduledEndSecond: 61200, scheduledNetSeconds: 32400, chargeUnits: 1, employmentSnapshot: { employmentRecordId: person.employment.id } } });
    check((await assessPayrollPeriod(scope.organizationId, p.id, tx)).issues.some(i => i.message.includes('Approved leave changed')), 'Newly approved leave invalidates the draft snapshot');
    await changePayrollEarning({ ...context, employeeId: person.id, expectedVersion: earningsVersion(stored.payload), operation: 'RECALCULATE', reason: 'Review unpaid leave', confirmRecalculation: true }, tx);
    check((await generatePayroll(context, tx)).setupErrors.some(e => e.message.includes('Monthly unpaid leave requires')), 'Unreviewed monthly unpaid leave method blocks generation');
    const daily = await organization(tx), dailyPerson = await employee(tx, daily), dailyPeriod = await period(tx, daily);
    await tx.employeeCompensation.update({ where: { id: dailyPerson.compensation.id }, data: { compensationType: 'DAILY', baseRate: '1000' } });
    await setup(tx, daily, dailyPerson, dailyPeriod.id);
    await tx.dailyAttendanceRecord.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ organizationId: daily.organizationId, employeeId: dailyPerson.id, employmentRecordId: dailyPerson.employment.id, attendanceDate: date(`2026-09-${String(i + 1).padStart(2, '0')}`), timeZoneSnapshot: 'UTC', attendanceStatus: i < 22 ? 'PRESENT' as const : 'REST_DAY' as const, disposition: 'NORMAL' as const, lastCalculatedAt: new Date() })) });
    check((await generatePayroll({ ...daily, payrollPeriodId: dailyPeriod.id }, tx)).setupErrors.some(e => e.message.includes('daily/partial/special')), 'Daily compensation remains blocked by unsupported statutory method');
    throw rollback;
  }, { timeout: 180_000 }); } catch (error) { if (error !== rollback) throw error; }
}
main().then(() => { fs.mkdirSync('docs/payroll-v2', { recursive: true }); fs.writeFileSync('docs/payroll-v2/edges.json', JSON.stringify({ passed: true, checks, amounts, fixturesRolledBack: true }, null, 2)); }).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
