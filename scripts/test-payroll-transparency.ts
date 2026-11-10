import assert from 'node:assert/strict';
import { payrollAttendanceMoney } from '../src/features/payroll/attendance-money';
import { payrollSnapshotBreakdown } from '../src/features/payroll/snapshot-breakdown';

const recorded = {
  version: 'WORKPULSE-PAYROLL-2B-1',
  statutory: { version: 'WORKPULSE-PAYROLL-2B-1', employeeStatutoryDeductions: { SSS:'750.00',PHILHEALTH:'375.00',PAGIBIG:'100.00' }, birWithholding:'240.00' },
  attendanceSummary: { absentDays:1, lateOccurrences:1, lateSeconds:3600, undertimeSeconds:1800, undertimeOccurrences:1 },
  attendanceRateBasis: { absenceDailyRate:'1200.000000' },
  policy: { deductionRules: {
    late: { rule:'PER_MINUTE', parameter:'2.5000', amount:'150.00' },
    undertime: { rule:'PER_MINUTE', parameter:'2.5000', amount:'75.00' },
    absence: { rule:'DAILY_RATE_PER_ABSENT_DAY', parameter:null, amount:'1200.00' },
  } },
};
const rows = payrollAttendanceMoney(recorded);
assert.deepEqual(rows.map(row=>row.amount),['150.00','75.00','1200.00']);
assert.deepEqual(rows.map(row=>row.quantity),['60','30','1']);
assert.deepEqual(rows.map(row=>row.rate),['2.5000','2.5000','1200.000000']);
assert.equal(rows[0]?.rateUnit,'per minute');
assert.equal(rows[2]?.rateUnit,'per day');
assert.equal(payrollSnapshotBreakdown(recorded).employee.sss,'750.00');

const historical = payrollAttendanceMoney({policy:{deductionRules:{late:{rule:'PER_MINUTE',parameter:'2.5000',amount:'150.00'},undertime:{rule:'PER_MINUTE',parameter:'2.5000',amount:'75.00'},absence:{rule:'DAILY_RATE_PER_ABSENT_DAY',amount:'1200.00'}}}});
assert.equal(historical[0]?.amount,'150.00');
assert.equal(historical[0]?.quantity,null);
assert.equal(historical[2]?.rate,null);
assert.equal(payrollAttendanceMoney({})[0]?.amount,null);
console.log('PASS: attendance evidence shows stored pesos; incomplete historical rates are not invented.');
