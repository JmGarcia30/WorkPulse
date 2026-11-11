import { CompensationType, CompensationStatus, PayFrequency, PayrollPeriodStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError } from './domain';
import { lockPayrollEmployee, lockPayrollPeriod, payrollTransaction } from './transactions';
import { validateEmployeeAttendanceRates, type EmployeeAttendanceRates } from './attendance-rates';

export type SaveEmployeePayrollConfigurationInput = {
  organizationId: string;
  actorUserId: string;
  employeeId: string;
  payrollPeriodId: string;
  monthlyBaseSalary: string;
  overtimePayPerHour: string;
  undertimeDeductionPerHour: string;
  lateDeductionPerMinute: string;
  absenceDeductionPerDay: string;
  notifyOnPayslipReady: boolean;
};

function parsePesos(value: string, label: string): Prisma.Decimal {
  if (!/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(value.trim())) {
    throw new PayrollError('INVALID_RATE', `${label} must be a positive PHP amount with up to two decimal places.`);
  }
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || amount.lte(0) || amount.gt('9999999999.99')) {
    throw new PayrollError('INVALID_RATE', `${label} must be greater than zero and within the supported amount range.`);
  }
  return amount;
}

export async function saveEmployeePayrollConfiguration(input: SaveEmployeePayrollConfigurationInput) {
  return payrollTransaction(prisma, async tx => {
    const actor = await tx.user.findFirst({
      where: { id: input.actorUserId, organizationId: input.organizationId, role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] } },
      select: { id: true },
    });
    if (!actor) throw new PayrollError('FORBIDDEN', 'Only authorized HR administrators may save payroll configuration.');

    await lockPayrollPeriod(tx, input.organizationId, input.payrollPeriodId);
    await lockPayrollEmployee(tx, input.organizationId, input.employeeId);

    const [employee, period] = await Promise.all([
      tx.employee.findFirst({ where: { id: input.employeeId, organizationId: input.organizationId, employeeStatus: 'ACTIVE' }, select: { id: true } }),
      tx.payrollPeriod.findFirst({ where: { id: input.payrollPeriodId, organizationId: input.organizationId } }),
    ]);
    if (!employee) throw new PayrollError('EMPLOYEE_NOT_FOUND', 'Select an active employee from your organization.');
    if (!period) throw new PayrollError('NOT_FOUND', 'Select an existing payroll period.');
    if (period.status === PayrollPeriodStatus.FINALIZED) {
      throw new PayrollError('FINALIZED', 'This cutoff is finalized. Choose an open future cutoff to change salary or attendance rates.');
    }
    const start = period.periodStart;
    const end = period.periodEnd;
    const firstDay = start.getUTCDate() === 1;
    const lastOfMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
    const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
    const semi = sameMonth && ((firstDay && end.getUTCDate() === 15) || (start.getUTCDate() === 16 && end.getUTCDate() === lastOfMonth));
    const monthly = sameMonth && firstDay && end.getUTCDate() === lastOfMonth;
    if (!semi && !monthly) {
      throw new PayrollError('SETUP_REQUIRED', 'This simple configuration supports full monthly or standard 1–15 / 16–month-end cutoffs. Use the existing advanced workflow for other schedules.');
    }
    const monthlySalary = parsePesos(input.monthlyBaseSalary, 'Monthly base salary');
    const rates: EmployeeAttendanceRates = {
      overtimePayPerHour: parsePesos(input.overtimePayPerHour, 'Overtime pay per hour'),
      undertimeDeductionPerHour: parsePesos(input.undertimeDeductionPerHour, 'Undertime deduction per hour'),
      lateDeductionPerMinute: parsePesos(input.lateDeductionPerMinute, 'Late deduction per minute'),
      absenceDeductionPerDay: parsePesos(input.absenceDeductionPerDay, 'Absence deduction per day'),
    };
    validateEmployeeAttendanceRates(monthlySalary, rates);

    const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    const applicable = await tx.employeeCompensation.findMany({
      where: {
        organizationId: input.organizationId, employeeId: employee.id, status: CompensationStatus.ACTIVE,
        effectiveFrom: { lte: start }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: end } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (applicable.length > 1) throw new PayrollError('SETUP_REQUIRED', 'Multiple employee salary records cover this cutoff. Resolve the overlap before saving.');
    const current = applicable[0];
    if (current && (current.compensationType !== CompensationType.MONTHLY || current.currency !== 'PHP' || current.payFrequency !== (semi ? PayFrequency.SEMI_MONTHLY : PayFrequency.MONTHLY))) {
      throw new PayrollError('SETUP_REQUIRED', 'The employee has a different compensation arrangement. Use the existing verified compensation workflow for that arrangement.');
    }
    const data = {
      baseRate: monthlySalary,
      overtimePayPerHour: rates.overtimePayPerHour,
      undertimeDeductionPerHour: rates.undertimeDeductionPerHour,
      lateDeductionPerMinute: rates.lateDeductionPerMinute,
      absenceDeductionPerDay: rates.absenceDeductionPerDay,
      notifyOnPayslipReady: input.notifyOnPayslipReady,
    };
    if (current) {
      const same = current.baseRate.eq(monthlySalary)
        && current.overtimePayPerHour?.eq(rates.overtimePayPerHour)
        && current.undertimeDeductionPerHour?.eq(rates.undertimeDeductionPerHour)
        && current.lateDeductionPerMinute?.eq(rates.lateDeductionPerMinute)
        && current.absenceDeductionPerDay?.eq(rates.absenceDeductionPerDay)
        && current.notifyOnPayslipReady === input.notifyOnPayslipReady;
      if (same) return { id: current.id, saved: false };
      const used = await tx.payrollEntry.findMany({
        where: { organizationId: input.organizationId, employeeId: employee.id, employeeCompensationId: current.id },
        select: { payrollPeriod: { select: { periodStart: true, periodEnd: true } } },
      });
      if (used.length === 0) {
        await tx.employeeCompensation.update({ where: { id: current.id }, data });
        return { id: current.id, saved: true };
      }
      if (current.effectiveFrom >= monthStart || used.some(row => row.payrollPeriod.periodEnd >= monthStart)) {
        throw new PayrollError('SETUP_REQUIRED', 'This salary record already has payroll calculations for the selected month. To preserve history, configure a future month after the existing entries.');
      }
      if (current.effectiveTo && current.effectiveTo < monthEnd) {
        throw new PayrollError('SETUP_REQUIRED', 'Compensation does not cover the full contribution month.');
      }
      const previousDay = new Date(monthStart.getTime() - 86_400_000);
      await tx.employeeCompensation.update({ where: { id: current.id }, data: { effectiveTo: previousDay } });
      const created = await tx.employeeCompensation.create({
        data: {
          organizationId: input.organizationId, employeeId: employee.id,
          compensationType: CompensationType.MONTHLY, currency: 'PHP',
          payFrequency: current.payFrequency, effectiveFrom: monthStart,
          effectiveTo: current.effectiveTo, status: CompensationStatus.ACTIVE, ...data,
        },
      });
      return { id: created.id, saved: true };
    }
    const overlap = await tx.employeeCompensation.findFirst({
      where: {
        organizationId: input.organizationId, employeeId: employee.id,
        effectiveFrom: { lte: monthEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }],
      },
      select: { id: true },
    });
    if (overlap) throw new PayrollError('SETUP_REQUIRED', 'An existing compensation record overlaps this month. Resolve it in employee compensation records.');
    const created = await tx.employeeCompensation.create({
      data: {
        organizationId: input.organizationId, employeeId: employee.id,
        compensationType: CompensationType.MONTHLY, currency: 'PHP',
        payFrequency: semi ? PayFrequency.SEMI_MONTHLY : PayFrequency.MONTHLY,
        effectiveFrom: monthStart, status: CompensationStatus.ACTIVE, ...data,
      },
    });
    return { id: created.id, saved: true };
  });
}
