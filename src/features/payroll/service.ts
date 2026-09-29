import { AbsenceDeductionRule, AttendanceDisposition, AttendanceStatus, CompensationStatus, CompensationType, DailyPayBasis, LateDeductionRule, LeavePayrollTreatment, LeaveRequestStatus, PayrollPeriodStatus, Prisma, Role, UndertimeDeductionRule } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError, calculateMonthlyCompensationBase, inclusiveCalendarDays, parseCompensationType, parsePayFrequency, parsePayrollDate, validateCurrency } from './domain';
import { resolvePayrollPolicy, validateResolvedPolicyParameters } from './policy';

type PayrollDb = Prisma.TransactionClient | typeof prisma;

async function requirePayrollAdmin(db: PayrollDb, organizationId: string, actorUserId: string) {
  const actor = await db.user.findFirst({
    where: { id: actorUserId, organizationId, role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] } },
    select: { id: true },
  });
  if (!actor) throw new PayrollError('FORBIDDEN', 'Unauthorized to manage payroll.');
}

export interface CreateCompensationInput {
  organizationId: string;
  actorUserId: string;
  employeeId: string;
  compensationType: string;
  baseRate: string | number;
  payFrequency: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export async function createEmployeeCompensation(input: CreateCompensationInput, db: PayrollDb = prisma) {
  await requirePayrollAdmin(db, input.organizationId, input.actorUserId);
  const employee = await db.employee.findFirst({ where: { id: input.employeeId, organizationId: input.organizationId }, select: { id: true } });
  if (!employee) throw new PayrollError('EMPLOYEE_NOT_FOUND', 'Employee is unavailable in this organization.');

  let baseRate: Prisma.Decimal;
  try { baseRate = new Prisma.Decimal(input.baseRate); } catch { throw new PayrollError('INVALID_RATE', 'Base rate must be a valid amount.'); }
  if (!baseRate.isFinite() || baseRate.lte(0) || baseRate.decimalPlaces() > 2) throw new PayrollError('INVALID_RATE', 'Base rate must be greater than zero with at most two decimal places.');

  const effectiveFrom = parsePayrollDate(input.effectiveFrom, 'Effective from');
  const effectiveTo = input.effectiveTo ? parsePayrollDate(input.effectiveTo, 'Effective to') : null;
  if (effectiveTo && effectiveTo < effectiveFrom) throw new PayrollError('INVALID_DATE_RANGE', 'Effective to cannot be before effective from.');

  const overlap = await db.employeeCompensation.findFirst({
    where: {
      organizationId: input.organizationId,
      employeeId: employee.id,
      effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    select: { id: true },
  });
  if (overlap) throw new PayrollError('OVERLAPPING_COMPENSATION', 'This compensation range overlaps an existing record.');

  return db.employeeCompensation.create({
    data: {
      organizationId: input.organizationId,
      employeeId: employee.id,
      compensationType: parseCompensationType(input.compensationType),
      baseRate,
      payFrequency: parsePayFrequency(input.payFrequency),
      currency: validateCurrency(input.currency),
      effectiveFrom,
      effectiveTo,
      status: CompensationStatus.ACTIVE,
    },
  });
}

export interface CreatePayrollPeriodInput {
  organizationId: string;
  actorUserId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
}

export async function createPayrollPeriod(input: CreatePayrollPeriodInput, db: PayrollDb = prisma) {
  await requirePayrollAdmin(db, input.organizationId, input.actorUserId);
  const name = input.name.trim();
  if (!name || name.length > 120) throw new PayrollError('INVALID_NAME', 'Period name is required and must be at most 120 characters.');
  const periodStart = parsePayrollDate(input.periodStart, 'Period start');
  const periodEnd = parsePayrollDate(input.periodEnd, 'Period end');
  const payDate = parsePayrollDate(input.payDate, 'Pay date');
  if (periodEnd < periodStart) throw new PayrollError('INVALID_DATE_RANGE', 'Period end cannot be before period start.');
  if (payDate < periodStart) throw new PayrollError('INVALID_PAY_DATE', 'Pay date cannot be before the period starts.');

  const overlap = await db.payrollPeriod.findFirst({
    where: { organizationId: input.organizationId, periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } },
    select: { id: true },
  });
  if (overlap) throw new PayrollError('OVERLAPPING_PERIOD', 'This payroll period overlaps an existing period.');
  try {
    return await db.payrollPeriod.create({ data: { organizationId: input.organizationId, name, periodStart, periodEnd, payDate } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new PayrollError('DUPLICATE_PERIOD', 'A payroll period with this name already exists.');
    throw error;
  }
}

export async function getCompensationById(organizationId: string, compensationId: string, db: PayrollDb = prisma) {
  const record = await db.employeeCompensation.findFirst({ where: { id: compensationId, organizationId }, include: { employee: true } });
  if (!record) throw new PayrollError('NOT_FOUND', 'Compensation record not found.');
  return record;
}

export async function getPayrollPeriodById(organizationId: string, payrollPeriodId: string, db: PayrollDb = prisma) {
  const period = await db.payrollPeriod.findFirst({ where: { id: payrollPeriodId, organizationId } });
  if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period not found.');
  return period;
}

export interface GeneratePayrollInput {
  organizationId: string;
  actorUserId: string;
  payrollPeriodId: string;
}

export type PayrollSetupError = {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  code: 'SETUP_REQUIRED';
  message: string;
};

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export async function generatePayroll(input: GeneratePayrollInput, db: PayrollDb = prisma) {
  await requirePayrollAdmin(db, input.organizationId, input.actorUserId);
  const period = await db.payrollPeriod.findFirst({
    where: { id: input.payrollPeriodId, organizationId: input.organizationId },
  });
  if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period not found.');
  if (period.status === PayrollPeriodStatus.FINALIZED) {
    throw new PayrollError('FINALIZED', 'A finalized payroll period cannot be generated again.');
  }
  const policy = await resolvePayrollPolicy(input.organizationId, period.periodStart, period.periodEnd, db);
  validateResolvedPolicyParameters(policy);

  const employees = await db.employee.findMany({
    where: { organizationId: input.organizationId, employeeStatus: 'ACTIVE' },
    select: { id: true, employeeNumber: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
  const existing = await db.payrollEntry.findMany({
    where: { organizationId: input.organizationId, payrollPeriodId: period.id },
    select: { id: true, employeeId: true },
  });
  const existingEmployeeIds = new Set(existing.map((entry) => entry.employeeId));
  const errors: PayrollSetupError[] = [];
  let createdCount = 0;

  for (const employee of employees) {
    if (existingEmployeeIds.has(employee.id)) continue;
    const employeeName = `${employee.firstName} ${employee.lastName}`.trim();
    const setupError = (message: string) => errors.push({
      employeeId: employee.id, employeeNumber: employee.employeeNumber, employeeName,
      code: 'SETUP_REQUIRED', message,
    });
    const compensations = await db.employeeCompensation.findMany({
      where: {
        organizationId: input.organizationId,
        employeeId: employee.id,
        status: CompensationStatus.ACTIVE,
        effectiveFrom: { lte: period.periodStart },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.periodEnd } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
    if (compensations.length !== 1) {
      setupError(compensations.length === 0
        ? 'No active compensation covers the entire payroll period.'
        : 'Multiple active compensation records cover the payroll period.');
      continue;
    }

    const compensation = compensations[0];
    const attendance = await db.dailyAttendanceRecord.findMany({
      where: {
        organizationId: input.organizationId,
        employeeId: employee.id,
        attendanceDate: { gte: period.periodStart, lte: period.periodEnd },
      },
      orderBy: { attendanceDate: 'asc' },
    });
    const leaveDays = await db.leaveRequestDay.findMany({
      where: {
        organizationId: input.organizationId,
        employeeId: employee.id,
        attendanceDate: { gte: period.periodStart, lte: period.periodEnd },
        leaveRequest: { status: LeaveRequestStatus.APPROVED },
      },
      include: { leaveRequest: { select: { id: true, leaveTypeId: true, leaveTypeCodeSnapshot: true, leaveTypeNameSnapshot: true, leavePaidSnapshot: true } } },
      orderBy: { attendanceDate: 'asc' },
    });

    const expectedDays = inclusiveCalendarDays(period.periodStart, period.periodEnd);
    const attendanceRequired = compensation.compensationType === CompensationType.DAILY
      || policy.lateDeductionRule !== LateDeductionRule.NONE
      || policy.absenceDeductionRule !== AbsenceDeductionRule.NONE
      || policy.undertimeDeductionRule !== UndertimeDeductionRule.NONE;
    if (attendanceRequired && attendance.length !== expectedDays) {
      setupError(`Attendance must be materialized for all ${expectedDays} calendar days before this payroll policy can be calculated.`);
      continue;
    }
    const treatmentByLeaveType = new Map(policy.leaveTreatments.map(item => [item.leaveTypeId, item.treatment]));
    const resolvedLeaveDays = leaveDays.map(day => ({
      ...day,
      payrollTreatment: treatmentByLeaveType.get(day.leaveRequest.leaveTypeId)
        ?? (day.leaveRequest.leavePaidSnapshot ? LeavePayrollTreatment.PAID : LeavePayrollTreatment.UNPAID),
    }));
    const scheduledWorkdays = attendance.filter(day => day.attendanceStatus !== AttendanceStatus.REST_DAY && day.attendanceStatus !== AttendanceStatus.NO_SCHEDULE).length;
    const presentDates = new Set(attendance.filter(day => day.attendanceStatus === AttendanceStatus.PRESENT).map(day => dateKey(day.attendanceDate)));
    const paidLeaveDates = new Set(resolvedLeaveDays.filter(day => day.payrollTreatment === LeavePayrollTreatment.PAID).map(day => dateKey(day.attendanceDate)));
    let baseAmount: Prisma.Decimal;
    let payableWorkdays: number | null = null;
    if (compensation.compensationType === CompensationType.MONTHLY) {
      try {
        baseAmount = calculateMonthlyCompensationBase({
          baseRate: compensation.baseRate,
          payFrequency: compensation.payFrequency,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
        });
      } catch (error) {
        if (error instanceof PayrollError && error.code === 'SETUP_REQUIRED') {
          setupError(error.message);
          continue;
        }
        throw error;
      }
    } else {
      payableWorkdays = policy.dailyPayBasis === DailyPayBasis.SCHEDULED_PAYABLE_DAYS
        ? scheduledWorkdays
        : policy.dailyPayBasis === DailyPayBasis.ACTUAL_PRESENT_DAYS
          ? presentDates.size
          : new Set([...presentDates, ...paidLeaveDates]).size;
      baseAmount = compensation.baseRate.mul(payableWorkdays).toDecimalPlaces(2);
    }

    const attendanceSummary = {
      totalRecords: attendance.length,
      scheduledWorkdays,
      presentDays: attendance.filter((day) => day.attendanceStatus === AttendanceStatus.PRESENT).length,
      absentDays: attendance.filter((day) => day.attendanceStatus === AttendanceStatus.ABSENT && day.disposition !== AttendanceDisposition.APPROVED_LEAVE).length,
      approvedLeaveDays: attendance.filter((day) => day.disposition === AttendanceDisposition.APPROVED_LEAVE).length,
      lateOccurrences: attendance.filter((day) => (day.lateSeconds ?? 0) > 0).length,
      lateSeconds: attendance.reduce((sum, day) => sum + (day.lateSeconds ?? 0), 0),
      statusCounts: Object.fromEntries(Object.values(AttendanceStatus).map((status) => [status, attendance.filter((day) => day.attendanceStatus === status).length])),
    };
    const leaveSummary = {
      approvedDays: resolvedLeaveDays.length,
      approvedUnits: resolvedLeaveDays.reduce((sum, day) => sum.add(day.chargeUnits), new Prisma.Decimal(0)).toFixed(4),
      paidDays: resolvedLeaveDays.filter((day) => day.payrollTreatment === LeavePayrollTreatment.PAID).length,
      unpaidDays: resolvedLeaveDays.filter((day) => day.payrollTreatment === LeavePayrollTreatment.UNPAID).length,
      noPayrollEffectDays: resolvedLeaveDays.filter((day) => day.payrollTreatment === LeavePayrollTreatment.NO_PAYROLL_EFFECT).length,
      requests: [...new Map(resolvedLeaveDays.map((day) => [day.leaveRequest.id, {
        requestId: day.leaveRequest.id,
        typeCode: day.leaveRequest.leaveTypeCodeSnapshot,
        typeName: day.leaveRequest.leaveTypeNameSnapshot,
        payrollTreatment: day.payrollTreatment,
      }])).values()],
    };
    const absenceDays = attendanceSummary.absentDays;
    const lateDeduction = policy.lateDeductionRule === LateDeductionRule.NONE ? new Prisma.Decimal(0)
      : policy.lateDeductionRule === LateDeductionRule.PER_MINUTE
        ? new Prisma.Decimal(attendanceSummary.lateSeconds).div(60).mul(policy.lateDeductionParameter!)
        : new Prisma.Decimal(attendanceSummary.lateOccurrences).mul(policy.lateDeductionParameter!);
    const dailyRate = compensation.compensationType === CompensationType.DAILY
      ? compensation.baseRate
      : scheduledWorkdays > 0 ? baseAmount.div(scheduledWorkdays) : null;
    if (policy.absenceDeductionRule === AbsenceDeductionRule.DAILY_RATE_PER_ABSENT_DAY && !dailyRate) {
      setupError('A daily rate cannot be derived because the period has no scheduled payable days.');
      continue;
    }
    const absenceDeduction = policy.absenceDeductionRule === AbsenceDeductionRule.NONE ? new Prisma.Decimal(0)
      : policy.absenceDeductionRule === AbsenceDeductionRule.DAILY_RATE_PER_ABSENT_DAY
        ? dailyRate!.mul(absenceDays)
        : new Prisma.Decimal(absenceDays).mul(policy.absenceDeductionParameter!);
    const undertimeSeconds = attendance.reduce((sum, day) => sum + (day.undertimeSeconds ?? 0), 0);
    const undertimeOccurrences = attendance.filter(day => (day.undertimeSeconds ?? 0) > 0).length;
    const undertimeDeduction = policy.undertimeDeductionRule === UndertimeDeductionRule.NONE ? new Prisma.Decimal(0)
      : policy.undertimeDeductionRule === UndertimeDeductionRule.PER_MINUTE
        ? new Prisma.Decimal(undertimeSeconds).div(60).mul(policy.undertimeDeductionParameter!)
        : new Prisma.Decimal(undertimeOccurrences).mul(policy.undertimeDeductionParameter!);
    const totalDeductions = lateDeduction.add(absenceDeduction).add(undertimeDeduction).toDecimalPlaces(2);
    if (totalDeductions.gt(baseAmount)) {
      setupError('Configured deductions exceed gross pay for this employee.');
      continue;
    }
    const netAmount = baseAmount.sub(totalDeductions).toDecimalPlaces(2);
    const amount = baseAmount.toFixed(2);
    const policySnapshot = {
      id: policy.id, version: policy.version,
      effectiveFrom: policy.effectiveFrom ? dateKey(policy.effectiveFrom) : null,
      effectiveTo: policy.effectiveTo ? dateKey(policy.effectiveTo) : null,
      isDefault: policy.isDefault,
      dailyPayBasis: policy.dailyPayBasis,
      roundingRule: policy.roundingRule,
      deductionRules: {
        late: { rule: policy.lateDeductionRule, parameter: policy.lateDeductionParameter?.toFixed(4) ?? null, amount: lateDeduction.toDecimalPlaces(2).toFixed(2) },
        absence: { rule: policy.absenceDeductionRule, parameter: policy.absenceDeductionParameter?.toFixed(4) ?? null, amount: absenceDeduction.toDecimalPlaces(2).toFixed(2) },
        undertime: { rule: policy.undertimeDeductionRule, parameter: policy.undertimeDeductionParameter?.toFixed(4) ?? null, amount: undertimeDeduction.toDecimalPlaces(2).toFixed(2) },
      },
      leaveTreatmentsApplied: leaveSummary.requests,
    };
    const snapshot = {
      version: 'H6.2.5', calculatedAt: new Date().toISOString(),
      organizationId: input.organizationId,
      payrollPeriod: { id: period.id, name: period.name, start: dateKey(period.periodStart), end: dateKey(period.periodEnd), payDate: dateKey(period.payDate) },
      employee: { id: employee.id, employeeNumber: employee.employeeNumber, name: employeeName },
      compensation: { id: compensation.id, type: compensation.compensationType, rate: compensation.baseRate.toFixed(2), payFrequency: compensation.payFrequency, currency: compensation.currency },
      policy: policySnapshot,
      calculation: { baseAmount: amount, payableWorkdays, grossAmount: amount, totalDeductions: totalDeductions.toFixed(2), netAmount: netAmount.toFixed(2), attendanceAffectsPay: attendanceRequired && !policy.isDefault, leaveAffectsPay: policy.dailyPayBasis === DailyPayBasis.PRESENT_PLUS_PAID_LEAVE },
      attendanceSummary,
      leaveSummary,
    } satisfies Prisma.InputJsonObject;
    try {
      await db.payrollEntry.create({
        data: {
          organizationId: input.organizationId, payrollPeriodId: period.id, employeeId: employee.id,
          employeeCompensationId: compensation.id, baseAmount, grossAmount: baseAmount,
          totalDeductions, netAmount, calculationSnapshot: snapshot,
          status: period.status === PayrollPeriodStatus.REVIEW ? 'REVIEW' : 'DRAFT',
        },
      });
      createdCount++;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }

  return { createdCount, existingCount: existing.length, setupErrors: errors };
}
