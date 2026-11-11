import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { calculateAttendanceAdjustments, validateEmployeeAttendanceRates } from '../src/features/payroll/attendance-rates';

const D = (amount: string) => new Prisma.Decimal(amount);
const rates = {
  overtimePayPerHour: D('200'),
  undertimeDeductionPerHour: D('100'),
  lateDeductionPerMinute: D('2'),
  absenceDeductionPerDay: D('900'),
};

validateEmployeeAttendanceRates(D('30000'), rates);
const sample = calculateAttendanceAdjustments({
  overtimeSeconds: 7200, undertimeSeconds: 0, lateSeconds: 1800, absentDays: 1, rates,
});
assert.equal(sample.overtimePay.toFixed(2), '400.00', 'overtime is paid as earnings');
assert.equal(sample.lateDeduction.toFixed(2), '60.00', '30 minutes late at PHP2/min');
assert.equal(sample.absenceDeduction.toFixed(2), '900.00', 'one absence at PHP900/day');
assert.equal(sample.undertimeDeduction.toFixed(2), '0.00', 'no undertime is not deducted');

const halfHour = calculateAttendanceAdjustments({
  overtimeSeconds: 5400, undertimeSeconds: 1800, lateSeconds: 90, absentDays: 0, rates,
});
assert.equal(halfHour.overtimePay.toFixed(2), '300.00', '1.5 hours of overtime');
assert.equal(halfHour.undertimeDeduction.toFixed(2), '50.00', '30 minutes undertime at PHP100/hour');
assert.equal(halfHour.lateDeduction.toFixed(2), '3.00', '90 seconds late is 1.5 minutes');

const unsafe = { ...rates, overtimePayPerHour: D('1') };
assert.throws(() => validateEmployeeAttendanceRates(D('30000'), unsafe), /Overtime pay must be at least/);
assert.throws(() => validateEmployeeAttendanceRates(D('30000'), { ...rates, absenceDeductionPerDay: D('9000') }), /Absence deduction cannot exceed/);
assert.throws(() => validateEmployeeAttendanceRates(D('30000'), { ...rates, lateDeductionPerMinute: D('900') }), /Late deduction cannot exceed/);
assert.throws(() => validateEmployeeAttendanceRates(D('0'), rates), /Monthly base salary/);

console.log('Payroll attendance-rate tests passed: peso amounts, rates, overtime, no undertime, and validation.');
