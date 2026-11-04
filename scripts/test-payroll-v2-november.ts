import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';
import { organization, employee, period, setup } from './test-payroll-integration';
import { generatePayroll } from '../src/features/payroll/service';
import { changePayrollEarning, earningsVersion } from '../src/features/payroll/earnings';
import { movePayrollPeriodToReview, finalizePayrollPeriod } from '../src/features/payroll/review';
import { getFinalizedPayslipForEmployee } from '../src/features/payroll/payslip';
const db = new PrismaClient({ log: [] });
const checks: string[] = [], amounts: unknown[] = [];
const check = (value: unknown, label: string) => { assert(value, label); checks.push(label); console.log('PASS', label); };
const rollback = Error('NOVEMBER_REVIEW_ROLLBACK');
async function main() {
  const [identity] = await db.$queryRaw<Array<{ branch: string }>>`SELECT current_setting('neon.branch_id',true) AS branch`;
  assert.equal(identity.branch, 'br-lingering-dawn-azrdk13o');
  try { await db.$transaction(async tx => {
    const monthly = await organization(tx), me = await employee(tx, monthly), mp = await period(tx, monthly, '2026-11-01', '2026-11-30');
    await setup(tx, monthly, me, mp.id, undefined, '2026-11-01');
    const input = { ...monthly, payrollPeriodId: mp.id };
    async function generate(scope: typeof input, label: string, expected: { gross: string; deductions: string; net: string }) {
      const result = await generatePayroll(scope, tx);
      check(result.createdCount === 1 && result.setupErrors.length === 0, `${label}: actual generator succeeds without bypassing readiness`);
      const entry = await tx.payrollEntry.findFirstOrThrow({ where: { organizationId: scope.organizationId, payrollPeriodId: scope.payrollPeriodId } });
      const actual = { gross: entry.grossAmount.toFixed(2), deductions: entry.totalDeductions.toFixed(2), net: entry.netAmount.toFixed(2) };
      assert.deepEqual(actual, expected); amounts.push({ label, expected, actual }); check(true, `${label}: manual expected amounts match persisted entry`);
      return entry;
    }
    const basic = await generate(input, 'November monthly basic', { gross: '35000.00', deductions: '4526.30', net: '30473.70' });
    const stored = await tx.payrollStatutoryInput.findFirstOrThrow({ where: { payrollPeriodId: mp.id, employeeId: me.id } });
    await changePayrollEarning({ ...input, employeeId: me.id, operation: 'SAVE', expectedVersion: earningsVersion(stored.payload), confirmRecalculation: true, reason: 'November taxable bonus approved fixture', earning: { id: 'november-bonus', category: 'BONUS', kind: 'TAXABLE_BONUS', amount: '2000', description: 'November verified taxable bonus', supportingReference: 'NOV-APPROVAL-001', qualificationReference: 'Reviewed taxable supplementary payment' }, agencyReview: { monthlySssRemuneration: '37000', monthlyPagIbigFundSalary: '37000', agencyBasisReference: 'Verified November aggregate agency bases' } }, tx);
    const bonus = await generate(input, 'November bonus regeneration', { gross: '37000.00', deductions: '4826.30', net: '32173.70' });
    await movePayrollPeriodToReview(input, tx); await finalizePayrollPeriod({ ...input, confirmation: 'FINALIZE' }, tx);
    const user = await tx.user.create({ data: { organizationId: monthly.organizationId, role: 'EMPLOYEE', name: 'November synthetic ESS', email: `nov-${me.id}@example.test` } });
    await tx.employeeAccount.create({ data: { organizationId: monthly.organizationId, employeeId: me.id, userId: user.id, status: 'ACTIVE', activatedAt: new Date(), createdById: monthly.actorUserId } });
    const ess = await getFinalizedPayslipForEmployee({ organizationId: monthly.organizationId, userId: user.id, entryId: bonus.id }, tx);
    check(ess.calculation.netPay === '32173.70' && ess.calculation.additionalEarnings?.[0].description === 'November verified taxable bonus', 'November ESS reads the finalized bonus snapshot without recalculation');
    const statutory = (bonus.calculationSnapshot as Prisma.JsonObject).statutory as Prisma.JsonObject;
    check(((statutory.bir as Prisma.JsonObject).assessment as Prisma.JsonObject).verifiedOn === '2026-11-05', 'New snapshot records the November rule review date');
    const semi = await organization(tx), se = await employee(tx, semi, 'SEMI_MONTHLY');
    const first = await period(tx, semi, '2026-11-01', '2026-11-15'), second = await period(tx, semi, '2026-11-16', '2026-11-30');
    await setup(tx, semi, se, first.id, undefined, '2026-11-01'); await setup(tx, semi, se, second.id, undefined, '2026-11-01');
    const firstInput = { ...semi, payrollPeriodId: first.id }, secondInput = { ...semi, payrollPeriodId: second.id };
    const a = await generate(firstInput, 'November first cutoff', { gross: '17500.00', deductions: '2263.08', net: '15236.92' });
    await movePayrollPeriodToReview(firstInput, tx); await finalizePayrollPeriod({ ...firstInput, confirmation: 'FINALIZE' }, tx);
    const b = await generate(secondInput, 'November second cutoff', { gross: '17500.00', deductions: '2263.08', net: '15236.92' });
    check(basic.totalDeductions.sub(a.totalDeductions.add(b.totalDeductions)).eq('0.14'), 'Actual stored monthly versus two-cutoff deductions differ by exactly 0.14');
    const allocations = await tx.payrollContributionAllocation.findMany({ where: { posting: { organizationId: semi.organizationId } } });
    for (const [agency, expected] of [['SSS', '1750'], ['PHILHEALTH', '875'], ['PAGIBIG', '200']]) check(allocations.filter(row => row.agency === agency).reduce((sum, row) => sum.add((row.allocation as Prisma.JsonObject).employee as string), new Prisma.Decimal(0)).eq(expected), `${agency}: two cutoff employee allocations equal one November monthly liability`);
    throw rollback;
  }, { timeout: 180000 }); } catch (error) { if (error !== rollback) throw error; }
  fs.writeFileSync('docs/payroll-v2/review/november-integration.json', JSON.stringify({ passed: true, branch: identity.branch, checks, amounts, syntheticFixturesRolledBack: true, productionEmployeesSelectedForGeneration: false }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
