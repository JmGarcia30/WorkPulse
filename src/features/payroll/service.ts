import { AbsenceDeductionRule, AttendanceDisposition, AttendanceStatus, CompensationStatus, CompensationType, DailyPayBasis, LateDeductionRule, LeavePayrollTreatment, PayrollPeriodStatus, Prisma, Role, UndertimeDeductionRule } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError, calculateMonthlyCompensationBase, inclusiveCalendarDays, parseCompensationType, parsePayFrequency, parsePayrollDate, validateCurrency } from './domain';
import { readPayrollGenerationInputs } from './generation-inputs';
import { resolvePayrollPolicy, validateResolvedPolicyParameters } from './policy';
import { lockPayrollEmployee, lockPayrollPeriod, payrollTransaction } from './transactions';
import { calculateIntegratedPayroll, persistIntegratedPayroll, STATUTORY_SNAPSHOT_VERSION } from './statutory-integration';
import { attendanceReadinessIssue, payrollAttendanceEvidence } from './attendance-evidence';
import { payrollLeaveEvidence } from './leave-evidence';
import { calculateAttendanceAdjustments, validateEmployeeAttendanceRates } from './attendance-rates';

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
  /** Optional employee scope; period-wide generation remains the default. */
  employeeId?: string;
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
  return payrollTransaction(db, async tx => {
    await lockPayrollPeriod(tx, input.organizationId, input.payrollPeriodId);
    return generateInTransaction(input, tx);
  });
}

async function generateInTransaction(input: GeneratePayrollInput, db: Prisma.TransactionClient) {
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
    where: { organizationId: input.organizationId, employeeStatus: 'ACTIVE', ...(input.employeeId ? { id: input.employeeId } : {}) },
    select: { id: true, employeeNumber: true, firstName: true, lastName: true },
    orderBy: { id: 'asc' },
  });
  if (input.employeeId && employees.length !== 1) {
    throw new PayrollError('NOT_FOUND', 'Selected active employee is not available in this organization.');
  }
  const existing = await db.payrollEntry.findMany({
    where: { organizationId: input.organizationId, payrollPeriodId: period.id, ...(input.employeeId ? { employeeId: input.employeeId } : {}) },
    select: { id: true, employeeId: true },
  });
  const existingEmployeeIds = new Set(existing.map((entry) => entry.employeeId));
  const errors: PayrollSetupError[] = [];
  let createdCount = 0;

  for (const employee of employees) {
    if (existingEmployeeIds.has(employee.id)) continue;
    await lockPayrollEmployee(db, input.organizationId, employee.id);
    const employeeName = `${employee.firstName} ${employee.lastName}`.trim();
    const setupError = (message: string) => errors.push({
      employeeId: employee.id, employeeNumber: employee.employeeNumber, employeeName,
      code: 'SETUP_REQUIRED', message,
    });
    const { compensations, attendance, leaveDays } = await readPayrollGenerationInputs(
      db, input.organizationId, employee.id, period.periodStart, period.periodEnd
    );
    if (compensations.length !== 1) {
      setupError(compensations.length === 0
        ? 'No active compensation covers the entire payroll period.'
        : 'Multiple active compensation records cover the payroll period.');
      continue;
    }

    const compensation = compensations[0];
    const expectedDays = inclusiveCalendarDays(period.periodStart, period.periodEnd);
    const personalRateFields = [
      compensation.overtimePayPerHour, compensation.undertimeDeductionPerHour,
      compensation.lateDeductionPerMinute, compensation.absenceDeductionPerDay,
    ];
    const personalRatesPresent = personalRateFields.some(value => value !== null);
    const personalRatesComplete = personalRateFields.every(value => value !== null);
    if (personalRatesPresent && !personalRatesComplete) {
      setupError('The employee has incomplete peso-based attendance configuration. Complete all four rates in Payroll Configuration.');
      continue;
    }
    const attendanceRequired = compensation.compensationType === CompensationType.DAILY
      || personalRatesPresent
      || policy.lateDeductionRule !== LateDeductionRule.NONE
      || policy.absenceDeductionRule !== AbsenceDeductionRule.NONE
      || policy.undertimeDeductionRule !== UndertimeDeductionRule.NONE;
    const attendanceIssue = attendanceRequired ? attendanceReadinessIssue(attendance, expectedDays) : null;
    if (attendanceIssue) {
      setupError(attendanceIssue);
      continue;
    }
    const treatmentByLeaveType = new Map(policy.leaveTreatments.map(item => [item.leaveTypeId, item.treatment]));
    const resolvedLeaveDays = leaveDays.map(day => ({
      ...day,
      payrollTreatment: treatmentByLeaveType.get(day.leaveRequest.leaveTypeId)
        ?? (day.leaveRequest.leavePaidSnapshot ? LeavePayrollTreatment.PAID : LeavePayrollTreatment.UNPAID),
    }));
    if (compensation.compensationType === CompensationType.MONTHLY
      && resolvedLeaveDays.some(day => day.payrollTreatment === LeavePayrollTreatment.UNPAID && day.chargeUnits.gt(0))) {
      setupError('Monthly unpaid leave requires a reviewed salary-reduction method. Resolve unpaid leave before generation; full monthly pay cannot be assumed.');
      continue;
    }
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
      overtimeSeconds: attendance.reduce((sum, day) => sum + (day.overtimeSeconds ?? 0), 0),
      overtimeOccurrences: attendance.filter(day => (day.overtimeSeconds ?? 0) > 0).length,
      undertimeSeconds: attendance.reduce((sum, day) => sum + (day.undertimeSeconds ?? 0), 0),
      undertimeOccurrences: attendance.filter(day => (day.undertimeSeconds ?? 0) > 0).length,
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
    const personalRates = personalRatesComplete ? {
      overtimePayPerHour: compensation.overtimePayPerHour!,
      undertimeDeductionPerHour: compensation.undertimeDeductionPerHour!,
      lateDeductionPerMinute: compensation.lateDeductionPerMinute!,
      absenceDeductionPerDay: compensation.absenceDeductionPerDay!,
    } : null;
    if (attendanceSummary.overtimeSeconds > 0 && !personalRates) {
      setupError('Recorded overtime requires an approved employee overtime rate in Payroll Configuration.');
      continue;
    }
    if (attendance.some(day => (day.overtimeSeconds ?? 0) > 0 && day.attendanceStatus === AttendanceStatus.REST_DAY)) {
      setupError('Rest-day overtime requires separate statutory classification; the standard hourly overtime rate cannot be used.');
      continue;
    }
    if (personalRates) {
      try { validateEmployeeAttendanceRates(compensation.baseRate, personalRates); }
      catch (error) { setupError(error instanceof Error ? error.message : 'Employee attendance rates require review.'); continue; }
    }
    const personalAmounts = personalRates ? calculateAttendanceAdjustments({
      overtimeSeconds: attendanceSummary.overtimeSeconds,
      undertimeSeconds: attendanceSummary.undertimeSeconds,
      lateSeconds: attendanceSummary.lateSeconds,
      absentDays: attendanceSummary.absentDays,
      rates: personalRates,
    }) : null;
    const absenceDays = attendanceSummary.absentDays;
    const lateDeduction = personalAmounts ? personalAmounts.lateDeduction : policy.lateDeductionRule === LateDeductionRule.NONE ? new Prisma.Decimal(0)
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
    const absenceDeduction = personalAmounts ? personalAmounts.absenceDeduction : policy.absenceDeductionRule === AbsenceDeductionRule.NONE ? new Prisma.Decimal(0)
      : policy.absenceDeductionRule === AbsenceDeductionRule.DAILY_RATE_PER_ABSENT_DAY
        ? dailyRate!.mul(absenceDays)
        : new Prisma.Decimal(absenceDays).mul(policy.absenceDeductionParameter!);
    const undertimeSeconds = attendance.reduce((sum, day) => sum + (day.undertimeSeconds ?? 0), 0);
    const undertimeOccurrences = attendance.filter(day => (day.undertimeSeconds ?? 0) > 0).length;
    const undertimeDeduction = personalAmounts ? personalAmounts.undertimeDeduction : policy.undertimeDeductionRule === UndertimeDeductionRule.NONE ? new Prisma.Decimal(0)
      : policy.undertimeDeductionRule === UndertimeDeductionRule.PER_MINUTE
        ? new Prisma.Decimal(undertimeSeconds).div(60).mul(policy.undertimeDeductionParameter!)
        : new Prisma.Decimal(undertimeOccurrences).mul(policy.undertimeDeductionParameter!);
    // Round cumulative components so centavo amounts reconcile to the existing rounded total.
    const companyTotal = lateDeduction.add(absenceDeduction).add(undertimeDeduction).toDecimalPlaces(2);
    const companyDeductions = {
      late: lateDeduction.toDecimalPlaces(2),
      absence: lateDeduction.add(absenceDeduction).toDecimalPlaces(2).sub(lateDeduction.toDecimalPlaces(2)),
      undertime: companyTotal.sub(lateDeduction.add(absenceDeduction).toDecimalPlaces(2)),
    };
    if (companyTotal.gt(baseAmount)) {
      setupError('Configured deductions exceed gross pay for this employee.');
      continue;
    }
    let integrated: Awaited<ReturnType<typeof calculateIntegratedPayroll>>;
    try {
      integrated = await calculateIntegratedPayroll(db, {
        organizationId: input.organizationId, employeeId: employee.id, period, compensation, baseAmount,
        companyDeductions, overtimePay: personalAmounts?.overtimePay ?? new Prisma.Decimal(0),
      });
    } catch (error) {
      if (error instanceof PayrollError && error.code === 'SETUP_REQUIRED') { setupError(error.message); continue; }
      throw error;
    }
    const { totalDeductions, netAmount, grossAmount } = integrated;
    const amount = baseAmount.toFixed(2);
    const policySnapshot = {
      id: policy.id, version: policy.version,
      effectiveFrom: policy.effectiveFrom ? dateKey(policy.effectiveFrom) : null,
      effectiveTo: policy.effectiveTo ? dateKey(policy.effectiveTo) : null,
      isDefault: policy.isDefault,
      dailyPayBasis: policy.dailyPayBasis,
      roundingRule: policy.roundingRule,
      deductionRules: {
        late: { rule: personalRates ? 'PER_MINUTE' : policy.lateDeductionRule, parameter: personalRates ? personalRates.lateDeductionPerMinute.toFixed(2) : policy.lateDeductionParameter?.toFixed(4) ?? null, amount: companyDeductions.late.toFixed(2) },
        absence: { rule: personalRates ? 'FIXED_PER_ABSENCE' : policy.absenceDeductionRule, parameter: personalRates ? personalRates.absenceDeductionPerDay.toFixed(2) : policy.absenceDeductionParameter?.toFixed(4) ?? null, amount: companyDeductions.absence.toFixed(2) },
        undertime: { rule: personalRates ? 'PER_HOUR' : policy.undertimeDeductionRule, parameter: personalRates ? personalRates.undertimeDeductionPerHour.toFixed(2) : policy.undertimeDeductionParameter?.toFixed(4) ?? null, amount: companyDeductions.undertime.toFixed(2) },
      },
      leaveTreatmentsApplied: leaveSummary.requests,
    };
    const snapshot = {
      version: STATUTORY_SNAPSHOT_VERSION, calculatedAt: new Date().toISOString(),
      organizationId: input.organizationId,
      payrollPeriod: { id: period.id, name: period.name, start: dateKey(period.periodStart), end: dateKey(period.periodEnd), payDate: dateKey(period.payDate) },
      employee: { id: employee.id, employeeNumber: employee.employeeNumber, name: employeeName },
      compensation: { id: compensation.id, type: compensation.compensationType, rate: compensation.baseRate.toFixed(2), payFrequency: compensation.payFrequency, currency: compensation.currency },
      policy: policySnapshot,
      calculation: { baseAmount: amount, payableWorkdays, grossAmount: grossAmount.toFixed(2), totalDeductions: totalDeductions.toFixed(2), netAmount: netAmount.toFixed(2), attendanceAffectsPay: attendanceRequired && (personalRatesPresent || !policy.isDefault), leaveAffectsPay: policy.dailyPayBasis === DailyPayBasis.PRESENT_PLUS_PAID_LEAVE },
      statutory: integrated.snapshot,
      attendanceSummary,
      // Snapshot the actual attendance facts used by this calculation. Do not
      // derive an official historical report from later-edited live attendance.
      attendanceDailyRecords: attendance.map(day => ({
        date: dateKey(day.attendanceDate), status: day.attendanceStatus,
        disposition: day.disposition, lateSeconds: day.lateSeconds ?? 0,
        undertimeSeconds: day.undertimeSeconds ?? 0, overtimeSeconds: day.overtimeSeconds ?? 0,
      })),
      // Additional display evidence: actual payroll monetary amounts remain authoritative.
      attendanceRateBasis: { absenceDailyRate: dailyRate?.toFixed(6) ?? null, overtimeHourlyRate: personalRates?.overtimePayPerHour.toFixed(2) ?? null, overtimeAmount: personalAmounts?.overtimePay.toFixed(2) ?? null },
      attendanceEvidence: attendanceRequired ? payrollAttendanceEvidence(attendance, personalRates ? 'v2' : 'v1') : null,
      leaveSummary,
      leaveEvidence: payrollLeaveEvidence(leaveDays),
    } satisfies Prisma.InputJsonObject;
    const entry = await db.payrollEntry.create({
      data: {
        organizationId: input.organizationId, payrollPeriodId: period.id, employeeId: employee.id,
        employeeCompensationId: compensation.id, baseAmount, grossAmount,
        totalDeductions, netAmount, calculationSnapshot: snapshot,
        status: period.status === PayrollPeriodStatus.REVIEW ? 'REVIEW' : 'DRAFT',
      },
    });
    await persistIntegratedPayroll(db, entry, period, integrated);
    createdCount++;
  }

  return { createdCount, existingCount: existing.length, setupErrors: errors };
}

export interface DeletePayrollPeriodInput {
  organizationId: string;
  actorUserId: string;
  payrollPeriodId: string;
}

export async function deletePayrollPeriod(
  input: DeletePayrollPeriodInput,
  db: PayrollDb = prisma
) {
  return payrollTransaction(db, async (tx) => {
    await requirePayrollAdmin(tx, input.organizationId, input.actorUserId);
    await lockPayrollPeriod(tx, input.organizationId, input.payrollPeriodId);

    const period = await tx.payrollPeriod.findFirst({
      where: {
        id: input.payrollPeriodId,
        organizationId: input.organizationId,
      },
      include: {
        _count: {
          select: {
            payrollEntries: true,
            statutoryInputs: true,
          },
        },
      },
    });

    if (!period) {
      throw new PayrollError('NOT_FOUND', 'Payroll period not found or does not belong to this organization.');
    }

    if (period.status !== PayrollPeriodStatus.DRAFT) {
      throw new PayrollError(
        'NOT_ELIGIBLE_FOR_DELETION',
        `Cannot delete payroll period "${period.name}" because it is in ${period.status} status. Only DRAFT periods can be deleted.`
      );
    }

    if (period._count.payrollEntries > 0) {
      throw new PayrollError(
        'HAS_ENTRIES',
        `Cannot delete payroll period "${period.name}" because it has ${period._count.payrollEntries} generated payroll ${
          period._count.payrollEntries === 1 ? 'entry' : 'entries'
        }. Finalized or calculated payroll periods cannot be deleted.`
      );
    }

    if (period._count.statutoryInputs > 0) {
      throw new PayrollError(
        'HAS_STATUTORY_INPUTS',
        `Cannot delete payroll period "${period.name}" because it has ${period._count.statutoryInputs} statutory ${
          period._count.statutoryInputs === 1 ? 'record' : 'records'
        } attached to it.`
      );
    }

    await tx.payrollPeriod.delete({
      where: { id: period.id },
    });

    return {
      id: period.id,
      name: period.name,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    };
  });
}
