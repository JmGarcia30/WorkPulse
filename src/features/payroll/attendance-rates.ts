import { Prisma } from '@prisma/client';
import { PayrollError } from './domain';

export type EmployeeAttendanceRates = {
  overtimePayPerHour: Prisma.Decimal;
  undertimeDeductionPerHour: Prisma.Decimal;
  lateDeductionPerMinute: Prisma.Decimal;
  absenceDeductionPerDay: Prisma.Decimal;
};

export type AttendanceAdjustmentAmounts = {
  overtimePay: Prisma.Decimal;
  undertimeDeduction: Prisma.Decimal;
  lateDeduction: Prisma.Decimal;
  absenceDeduction: Prisma.Decimal;
};

/**
 * Validates flat PHP attendance rates for monthly-paid employees.
 * Verification branch: exercise new peso-rate integration and regression checks.
 * The statutory reference is the monthly-paid daily equivalent (12/365),
 * divided by eight hours; ordinary-workday overtime must be at least 125%.
 * Rest-day/holiday overtime is not covered by a single flat rate and must be
 * separately classified before it can be calculated.
 */
export function validateEmployeeAttendanceRates(
  monthlySalary: Prisma.Decimal,
  rates: EmployeeAttendanceRates
) {
  if (!monthlySalary.isFinite() || monthlySalary.lte(0)) {
    throw new PayrollError('INVALID_RATE', 'Monthly base salary must be greater than zero.');
  }
  const dailyEquivalent = monthlySalary.mul(12).div(365);
  const hourlyEquivalent = dailyEquivalent.div(8);
  const minimumOrdinaryOvertime = hourlyEquivalent.mul('1.25').toDecimalPlaces(2, Prisma.Decimal.ROUND_UP);
  const maximumAbsence = dailyEquivalent.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  const maximumUndertime = hourlyEquivalent.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  const maximumLate = hourlyEquivalent.div(60).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);

  if (rates.overtimePayPerHour.lt(minimumOrdinaryOvertime)) {
    throw new PayrollError('INVALID_OVERTIME_RATE', `Overtime pay must be at least ₱${minimumOrdinaryOvertime.toFixed(2)} per hour for ordinary workday overtime based on this monthly salary.`);
  }
  if (rates.absenceDeductionPerDay.gt(maximumAbsence)) {
    throw new PayrollError('INVALID_ABSENCE_RATE', `Absence deduction cannot exceed the monthly-paid daily equivalent of ₱${maximumAbsence.toFixed(2)}.`);
  }
  if (rates.undertimeDeductionPerHour.gt(maximumUndertime)) {
    throw new PayrollError('INVALID_UNDERTIME_RATE', `Undertime deduction cannot exceed the hourly equivalent of ₱${maximumUndertime.toFixed(2)}.`);
  }
  if (rates.lateDeductionPerMinute.gt(maximumLate)) {
    throw new PayrollError('INVALID_LATE_RATE', `Late deduction cannot exceed the hourly equivalent per minute of ₱${maximumLate.toFixed(2)}.`);
  }
}

export function calculateAttendanceAdjustments(input: {
  overtimeSeconds: number;
  undertimeSeconds: number;
  lateSeconds: number;
  absentDays: number;
  rates: EmployeeAttendanceRates;
}): AttendanceAdjustmentAmounts {
  const { rates } = input;
  return {
    overtimePay: new Prisma.Decimal(input.overtimeSeconds).div(3600).mul(rates.overtimePayPerHour).toDecimalPlaces(2),
    undertimeDeduction: new Prisma.Decimal(input.undertimeSeconds).div(3600).mul(rates.undertimeDeductionPerHour).toDecimalPlaces(2),
    lateDeduction: new Prisma.Decimal(input.lateSeconds).div(60).mul(rates.lateDeductionPerMinute).toDecimalPlaces(2),
    absenceDeduction: new Prisma.Decimal(input.absentDays).mul(rates.absenceDeductionPerDay).toDecimalPlaces(2),
  };
}
