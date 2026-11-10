import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { organization, employee, period, setup } from './test-payroll-integration';
import { changePayrollEarning, earningsVersion } from '../src/features/payroll/earnings';
import { generatePayroll } from '../src/features/payroll/service';
import { movePayrollPeriodToReview, finalizePayrollPeriod } from '../src/features/payroll/review';
import { getFinalizedPayslipForAdmin } from '../src/features/payroll/payslip';
import { payrollAttendanceMoney } from '../src/features/payroll/attendance-money';

const db = new PrismaClient();
const rollback = new Error('PR25_INTEGRATION_ROLLBACK');

async function main() {
  try {
    await db.$transaction(async tx => {
      const scope = await organization(tx);
      const person = await employee(tx, scope);
      const payrollPeriod = await period(tx, scope);
      await setup(tx, scope, person, payrollPeriod.id);
      const inputs = await tx.payrollStatutoryInput.findUniqueOrThrow({
        where: { organizationId_employeeId_payrollPeriodId: {
          organizationId: scope.organizationId,
          employeeId: person.id,
          payrollPeriodId: payrollPeriod.id,
        } },
      });
      await changePayrollEarning({
        ...scope, employeeId: person.id, payrollPeriodId: payrollPeriod.id,
        expectedVersion: earningsVersion(inputs.payload), reason: 'Approved fixture incentive',
        confirmRecalculation: false, operation: 'SAVE',
        earning: {
          id: 'pr25-incentive', category: 'BONUS', kind: 'TAXABLE_BONUS',
          amount: '500.00', description: 'Approved incentive',
          supportingReference: 'PR25-APPROVED-INCENTIVE-1',
          qualificationReference: 'PR25-SIGNED-APPROVAL',
        },
        agencyReview: {
          monthlySssRemuneration: '35500.00',
          monthlyPagIbigFundSalary: '35500.00',
          agencyBasisReference: 'Verified inclusive monthly bases for incentive',
        },
      }, tx);
      const generated = await generatePayroll({ ...scope, payrollPeriodId: payrollPeriod.id, employeeId: person.id }, tx);
      assert.equal(generated.createdCount, 1, 'employee draft generated with incentive');
      assert.equal(generated.setupErrors.length, 0, 'no statutory setup errors');
      const entry = await tx.payrollEntry.findFirstOrThrow({ where: { organizationId: scope.organizationId, payrollPeriodId: payrollPeriod.id, employeeId: person.id } });
      assert.equal(entry.grossAmount.minus(entry.baseAmount).toFixed(2), '500.00', 'gross pay includes approved bonus once');
      assert.deepEqual(payrollAttendanceMoney(entry.calculationSnapshot).map(row => row.amount), ['0.00', '0.00', '0.00'], 'no invented attendance deductions');
      await movePayrollPeriodToReview({ ...scope, payrollPeriodId: payrollPeriod.id }, tx);
      await finalizePayrollPeriod({ ...scope, payrollPeriodId: payrollPeriod.id, confirmation: 'FINALIZE' }, tx);
      const payslip = await getFinalizedPayslipForAdmin({ ...scope, entryId: entry.id }, tx);
      assert.equal(payslip.calculation.additionalEarnings?.find(row => row.id === 'pr25-incentive')?.amount, '500.00');
      assert.equal(payslip.calculation.grossPay, entry.grossAmount.toFixed(2));
      assert.equal(payslip.calculation.netPay, entry.netAmount.toFixed(2));
      await assert.rejects(changePayrollEarning({
        ...scope, employeeId: person.id, payrollPeriodId: payrollPeriod.id,
        expectedVersion: earningsVersion(inputs.payload), reason: 'Attempt finalized edit',
        confirmRecalculation: true, operation: 'RECALCULATE',
      }, tx), /finalized/i);
      console.log('PASS: approved incentive, full calculation, finalization, immutable payslip and attendance display.');
      throw rollback;
    }, { timeout: 180000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(await db.organization.count({ where: { slug: { startsWith: 'payroll2b-' } } }), 0, 'fixture transaction rolled back');
  console.log('PASS: no synthetic payroll organizations or payments remain.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
