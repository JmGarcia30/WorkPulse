import {
  EmployeeStatus,
  LeaveAttendanceSyncStatus,
  LeaveLedgerEntryType,
  LeaveRequestAuditAction,
  LeaveRequestStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { Temporal } from '@js-temporal/polyfill';
import { prisma } from '@/lib/db/prisma';
import { attendanceDateToDb } from '@/features/attendance/domain';
import { materializeAttendanceDay } from '@/features/attendance/service';
import { applicableDocumentRules, parseLeavePolicy } from './policy';
import { chargedUnits, datesInclusive, decimalNumber, LeaveError, validateLeaveRange } from './domain';
import { notifyLeaveEmployee } from './notifications';

type Tx = Prisma.TransactionClient;

const DEFAULT_ENTITLEMENT_SOURCE = 'DEFAULT_CYCLE_ENTITLEMENT';
const SICK_PERSONAL_CODE = 'SICK_PERSONAL';
const SOLO_PARENT_CODE = 'SOLO_PARENT';

async function requireHr(tx: Tx, organizationId: string, actorUserId: string) {
  const actor = await tx.user.findFirst({
    where: { id: actorUserId, organizationId, role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] } },
    select: { id: true, name: true },
  });
  if (!actor) throw new LeaveError('FORBIDDEN', 'Unauthorized to manage leave.');
  return actor;
}

async function ledgerBalance(tx: Tx, employeeId: string, leaveTypeId: string, leaveCycleId: string | null) {
  const result = await tx.leaveLedgerEntry.aggregate({
    where: { employeeId, leaveTypeId, leaveCycleId },
    _sum: { amountUnits: true },
  });
  return decimalNumber(result._sum.amountUnits);
}

async function ensureDefaultCycleEntitlement(tx: Tx, input: {
  organizationId: string;
  employeeId: string;
  leaveTypeId: string;
  leaveCycleId: string;
  units: Prisma.Decimal;
  actorUserId: string;
  reason: string;
}) {
  const before = await ledgerBalance(tx, input.employeeId, input.leaveTypeId, input.leaveCycleId);
  return tx.leaveLedgerEntry.createMany({
    data: [{
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      leaveCycleId: input.leaveCycleId,
      entryType: LeaveLedgerEntryType.GRANT,
      amountUnits: input.units,
      reason: input.reason,
      actorUserId: input.actorUserId,
      grantSource: DEFAULT_ENTITLEMENT_SOURCE,
      beforeBalance: before,
      afterBalance: before + decimalNumber(input.units),
    }],
    skipDuplicates: true,
  });
}

async function resolveLeaveCycle(tx: Tx, input: {
  organizationId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
}) {
  const cycles = await tx.leaveCycle.findMany({
    where: {
      organizationId: input.organizationId,
      leaveTypeId: input.leaveTypeId,
      isClosed: false,
      startDate: { lte: input.startDate },
      endDate: { gte: input.endDate },
    },
    take: 2,
  });
  if (cycles.length !== 1) throw new LeaveError('INVALID_CYCLE', 'No single open leave cycle covers the complete request.');
  return cycles[0];
}

async function expectedReturnDate(tx: Tx, input: { organizationId: string; employeeId: string; after: Date }) {
  const assignments = await tx.employeeScheduleAssignment.findMany({
    where: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.after } }],
    },
    include: { scheduleVersion: { include: { days: true } } },
    orderBy: { effectiveFrom: 'asc' },
  });
  const employmentRecords = await tx.employmentRecord.findMany({
    where: { employeeId: input.employeeId, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.after } }] },
    orderBy: { effectiveFrom: 'asc' },
  });
  let cursor = Temporal.PlainDate.from(input.after.toISOString().slice(0, 10)).add({ days: 1 });
  for (let offset = 0; offset < 732; offset++, cursor = cursor.add({ days: 1 })) {
    const dbDate = attendanceDateToDb(cursor.toString());
    const employed = employmentRecords.some((record) => record.effectiveFrom <= dbDate && (!record.effectiveTo || record.effectiveTo > dbDate));
    const assignment = assignments.find((item) => item.effectiveFrom <= dbDate && (!item.effectiveTo || item.effectiveTo > dbDate));
    if (!employed || !assignment) continue;
    const day = assignment.scheduleVersion.days.find((item) => item.isoWeekday === cursor.dayOfWeek);
    if (day?.isWorkday) return dbDate;
  }
  return null;
}

async function buildRequestDays(tx: Tx, input: {
  organizationId: string;
  employeeId: string;
  from: string;
  to: string;
  countingMode: 'SCHEDULED_WORK_DAYS' | 'CALENDAR_DAYS';
  requiredEmploymentStatus: 'PROBATIONARY' | 'REGULAR' | null;
}) {
  const range = validateLeaveRange(input.from, input.to);
  const employmentRecords = await tx.employmentRecord.findMany({
    where: { employeeId: input.employeeId },
    orderBy: { effectiveFrom: 'asc' },
  });
  const assignments = await tx.employeeScheduleAssignment.findMany({
    where: { organizationId: input.organizationId, employeeId: input.employeeId },
    include: { scheduleVersion: { include: { days: { include: { breaks: true } } } } },
    orderBy: { effectiveFrom: 'asc' },
  });
  const result = [];
  for (const date of datesInclusive(range.start, range.end)) {
    const dateDb = attendanceDateToDb(date);
    const employment = employmentRecords.find((record) =>
      record.effectiveFrom <= dateDb && (!record.effectiveTo || record.effectiveTo > dateDb)
    );
    const assignment = assignments.find((item) =>
      item.effectiveFrom <= dateDb && (!item.effectiveTo || item.effectiveTo > dateDb)
    );
    const scheduleDay = assignment?.scheduleVersion.days.find((day) =>
      day.isoWeekday === new Date(`${date}T00:00:00Z`).getUTCDay() ||
      (day.isoWeekday === 7 && new Date(`${date}T00:00:00Z`).getUTCDay() === 0)
    );
    const isWorkday = Boolean(scheduleDay?.isWorkday);
    const charge = chargedUnits(input.countingMode, isWorkday);
    if (charge > 0 && !employment) throw new LeaveError('EMPLOYMENT_GAP', 'Continuous employment coverage is required for every charged leave date.');
    if (charge > 0 && input.requiredEmploymentStatus && employment?.employmentStatus !== input.requiredEmploymentStatus) {
      throw new LeaveError('INELIGIBLE_EMPLOYMENT', 'The current employment classification is not eligible for this leave type.');
    }
    if (input.countingMode === 'SCHEDULED_WORK_DAYS' && !assignment) {
      throw new LeaveError('NO_SCHEDULE', 'This employee has no active work schedule covering the requested leave dates. Assign a work schedule before approving this request.');
    }
    const unpaidBreak = scheduleDay?.breaks.filter((item) => !item.isPaid)
      .reduce((sum, item) => sum + item.endSecond - item.startSecond, 0) ?? 0;
    const gross = scheduleDay?.expectedStartSecond != null && scheduleDay.expectedEndSecond != null
      ? scheduleDay.expectedEndSecond - scheduleDay.expectedStartSecond : null;
    result.push({
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      attendanceDate: dateDb,
      employmentRecordId: employment?.id,
      scheduleAssignmentId: assignment?.id ?? null,
      isScheduledWorkday: isWorkday,
      scheduledStartSecond: scheduleDay?.expectedStartSecond ?? null,
      scheduledEndSecond: scheduleDay?.expectedEndSecond ?? null,
      scheduledUnpaidBreakSeconds: unpaidBreak,
      scheduledNetSeconds: gross == null ? null : Math.max(0, gross - unpaidBreak),
      chargeUnits: new Prisma.Decimal(charge),
      leaveSeconds: isWorkday && gross != null ? Math.max(0, gross - unpaidBreak) : null,
      employmentSnapshot: employment ? { id: employment.id, status: employment.employmentStatus, category: employment.employmentCategory, effectiveFrom: employment.effectiveFrom, effectiveTo: employment.effectiveTo } : {},
      scheduleSnapshot: assignment ? { assignmentId: assignment.id, versionId: assignment.scheduleVersionId, displayName: assignment.scheduleVersion.displayName } : Prisma.JsonNull,
    });
  }
  const units = result.reduce((sum, day) => sum + decimalNumber(day.chargeUnits), 0);
  if (units <= 0) throw new LeaveError('NO_CHARGED_DAYS', 'The request must include at least one leave day.');
  return { days: result, units, range };
}

export async function previewLeaveCalculation(input: {
  organizationId: string;
  employeeId: string;
  from: string;
  to: string;
  countingMode: 'SCHEDULED_WORK_DAYS' | 'CALENDAR_DAYS';
  requiredEmploymentStatus: 'PROBATIONARY' | 'REGULAR' | null;
}) {
  try {
    const built = await buildRequestDays(prisma, input);
    const workdays = built.days.filter((day) => day.isScheduledWorkday);
    return {
      status: 'READY' as const,
      units: built.units,
      scheduledWorkdays: workdays.length,
      scheduleNames: [...new Set(workdays.map((day) => {
        const snapshot = day.scheduleSnapshot as { displayName?: string } | null;
        return snapshot?.displayName;
      }).filter((name): name is string => Boolean(name)))],
      expectedReturnDate: (await expectedReturnDate(prisma, { organizationId: input.organizationId, employeeId: input.employeeId, after: built.range.endDb }))?.toISOString().slice(0, 10) ?? null,
    };
  } catch (error) {
    if (error instanceof LeaveError) return { status: 'BLOCKED' as const, code: error.code, message: error.message, units: 0, scheduledWorkdays: 0, scheduleNames: [] as string[], expectedReturnDate: null };
    throw error;
  }
}

async function validateSubmissionEmployment(tx: Tx, input: {
  employeeId: string;
  from: string;
  to: string;
  requiredEmploymentStatus: 'PROBATIONARY' | 'REGULAR' | null;
}) {
  const range = validateLeaveRange(input.from, input.to);
  const records = await tx.employmentRecord.findMany({
    where: { employeeId: input.employeeId },
    orderBy: { effectiveFrom: 'asc' },
  });
  for (const date of datesInclusive(range.start, range.end)) {
    const dateDb = attendanceDateToDb(date);
    const employment = records.find((record) =>
      record.effectiveFrom <= dateDb && (!record.effectiveTo || record.effectiveTo > dateDb)
    );
    if (!employment) throw new LeaveError('EMPLOYMENT_GAP', 'Current or effective employment must cover the requested leave period.');
    if (input.requiredEmploymentStatus && employment.employmentStatus !== input.requiredEmploymentStatus) {
      throw new LeaveError('INELIGIBLE_EMPLOYMENT', 'The employment classification is not eligible for this leave type.');
    }
  }
  return range;
}

async function assertMinimumContinuousService(tx: Tx, employeeId: string, months: number | null, referenceDate: Date) {
  if (!months) return;
  const records = await tx.employmentRecord.findMany({ where: { employeeId, effectiveFrom: { lte: referenceDate } }, orderBy: { effectiveFrom: 'desc' } });
  let coverageStart: Date | null = null;
  let boundary = referenceDate;
  for (const record of records) {
    if (record.effectiveFrom <= boundary && (!record.effectiveTo || record.effectiveTo >= boundary)) {
      coverageStart = record.effectiveFrom;
      boundary = record.effectiveFrom;
    }
  }
  const threshold = new Date(referenceDate);
  threshold.setUTCMonth(threshold.getUTCMonth() - months);
  if (!coverageStart || coverageStart > threshold) throw new LeaveError('INSUFFICIENT_SERVICE', `At least ${months} months of continuous service is required.`);
}

export async function submitLeaveRequest(input: {
  organizationId: string;
  employeeId: string;
  actorUserId: string;
  leaveTypeId: string;
  leaveCycleId?: string | null;
  from: string;
  to: string;
  categoryCode?: string | null;
  reason: string;
  attestations?: Record<string, string | boolean>;
}, testTransaction?: Tx) {
  const reason = input.reason.trim();
  if (!reason || reason.length > 2000) throw new LeaveError('INVALID_REASON', 'A leave reason is required.');
  const operation = async (tx: Tx) => {
    const actor = await tx.user.findFirst({ where: { id: input.actorUserId, organizationId: input.organizationId }, select: { role: true, employeeAccount: { select: { employeeId: true, status: true } } } });
    const employeeSelf = actor?.role === Role.EMPLOYEE && actor.employeeAccount?.status === 'ACTIVE' && actor.employeeAccount.employeeId === input.employeeId;
    const backOffice = actor?.role === Role.ORGANIZATION_ADMIN || actor?.role === Role.HR_ADMIN;
    if (!employeeSelf && !backOffice) throw new LeaveError('FORBIDDEN', 'Unauthorized to submit this leave request.');
    const [employee, type, organization] = await Promise.all([
      tx.employee.findFirst({ where: { id: input.employeeId, organizationId: input.organizationId, employeeStatus: EmployeeStatus.ACTIVE }, select: { id: true, firstName: true, lastName: true } }),
      tx.leaveType.findFirst({ where: { id: input.leaveTypeId, organizationId: input.organizationId, isActive: true } }),
      tx.organization.findUnique({ where: { id: input.organizationId }, select: { name: true, timeZone: true } }),
    ]);
    if (!employee || !type || !organization) throw new LeaveError('NOT_FOUND', 'Leave type or employee is unavailable.');
    const policy = parseLeavePolicy(type);
    const category = input.categoryCode?.trim().toUpperCase() || null;
    if (policy.categories.length && !policy.categories.some((item) => item.code === category)) {
      throw new LeaveError('INVALID_CATEGORY', 'Select a supported leave category.');
    }
    for (const rule of policy.attestations.filter((item) => item.required)) {
      const value = input.attestations?.[rule.code];
      if (value === undefined || value === false || value === '') throw new LeaveError('ATTESTATION_REQUIRED', `Required confirmation: ${rule.label}`);
      if (rule.options && !rule.options.includes(String(value))) throw new LeaveError('INVALID_ATTESTATION', 'A leave attestation value is invalid.');
    }
    const range = await validateSubmissionEmployment(tx, {
      employeeId: input.employeeId, from: input.from, to: input.to,
      requiredEmploymentStatus: type.requiredEmploymentStatus,
    });
    const built = type.countingMode === 'CALENDAR_DAYS' ? await buildRequestDays(tx, {
      organizationId: input.organizationId, employeeId: input.employeeId,
      from: input.from, to: input.to, countingMode: type.countingMode,
      requiredEmploymentStatus: type.requiredEmploymentStatus,
    }) : null;
    let serviceReference = range.startDb;
    if (type.code === 'MATERNITY') {
      const expected = String(input.attestations?.EXPECTED_DELIVERY_DATE ?? '');
      serviceReference = validateLeaveRange(expected, expected).startDb;
    }
    if (!type.requiresEligibilityVerification) {
      await assertMinimumContinuousService(tx, employee.id, type.minimumServiceMonths, serviceReference);
    }
    if (built && type.maximumRequestUnits && built.units > decimalNumber(type.maximumRequestUnits)) throw new LeaveError('POLICY_LIMIT', 'The request exceeds the configured leave limit.');
    if (!type.allowsRetrospectiveFiling && range.startDb < attendanceDateToDb(new Date().toISOString().slice(0, 10))) {
      throw new LeaveError('RETROSPECTIVE_NOT_ALLOWED', 'This leave type does not allow retrospective filing.');
    }
    let cycle = null;
    if (type.balanceTracked) {
      cycle = await resolveLeaveCycle(tx, { organizationId: input.organizationId, leaveTypeId: type.id, startDate: range.startDb, endDate: range.endDb });
      if (type.code === SICK_PERSONAL_CODE && !type.defaultGrantUnits) throw new LeaveError('ENTITLEMENT_UNAVAILABLE', 'The default Sick/Personal entitlement is not configured.');
    }
    const overlap = await tx.leaveRequest.findFirst({ where: {
      organizationId: input.organizationId, employeeId: employee.id,
      status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
      requestedStartDate: { lte: range.endDb }, requestedEndDate: { gte: range.startDb },
    }, select: { id: true } });
    if (overlap) throw new LeaveError('OVERLAP', 'This request overlaps another pending or approved leave request.');
    const request = await tx.leaveRequest.create({ data: {
      organizationId: input.organizationId, employeeId: employee.id, leaveTypeId: type.id,
      leaveCycleId: cycle?.id ?? null, requestedStartDate: range.startDb, requestedEndDate: range.endDb,
      requestedUnits: built ? new Prisma.Decimal(built.units) : null,
      calculationFinalizedAt: built ? new Date() : null,
      requestCategoryCode: category, reason,
      eligibilityAttestation: input.attestations ?? Prisma.JsonNull,
      policySnapshot: { ...policy, minimumServiceMonths: type.minimumServiceMonths, maximumRequestUnits: type.maximumRequestUnits?.toString() ?? null, maximumApprovedOccurrences: type.maximumApprovedOccurrences, occurrenceLimitScope: type.occurrenceLimitScope, requiresEligibilityVerification: type.requiresEligibilityVerification, policyReference: type.policyReference },
      leaveTypeCodeSnapshot: type.code, leaveTypeNameSnapshot: type.name, leavePaidSnapshot: type.isPaid,
      countingModeSnapshot: type.countingMode,
      employeeNameSnapshot: `${employee.firstName} ${employee.lastName}`.trim(),
      organizationNameSnapshot: organization.name,
      organizationTimeZoneSnapshot: organization.timeZone,
      expectedReturnDateSnapshot: null,
      ...(built ? { days: { create: built.days.map((day) => ({ ...day, employmentRecordId: day.employmentRecordId! })) } } : {}),
      audits: { create: { organizationId: input.organizationId, actorUserId: input.actorUserId, action: LeaveRequestAuditAction.SUBMITTED, details: { category, units: built?.units ?? null, calculationStatus: built ? 'FINALIZED' : 'PENDING_SCHEDULE' } } },
    } });
    return { id: request.id };
  };
  let result!: Awaited<ReturnType<typeof operation>>;
  if (testTransaction) result = await operation(testTransaction);
  else {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
      }
    }
    if (lastError) throw lastError;
  }
  if (!testTransaction) await notifyLeaveEmployee(result.id, input.actorUserId, 'SUBMITTED');
  return result;
}

export async function grantCycleEntitlements(input: { organizationId: string; actorUserId: string; leaveTypeId: string; leaveCycleId: string; employeeIds: string[]; reason: string; eligibilityConfirmed?: boolean }) {
  const uniqueIds = [...new Set(input.employeeIds)];
  const outcomes = [];
  for (const employeeId of uniqueIds) {
    try {
      await prisma.$transaction(async (tx) => {
        await requireHr(tx, input.organizationId, input.actorUserId);
        const type = await tx.leaveType.findFirst({ where: { id: input.leaveTypeId, organizationId: input.organizationId, balanceTracked: true, defaultGrantUnits: { not: null } } });
        const cycle = await tx.leaveCycle.findFirst({ where: { id: input.leaveCycleId, organizationId: input.organizationId, leaveTypeId: input.leaveTypeId, isClosed: false } });
        const employee = await tx.employee.findFirst({ where: { id: employeeId, organizationId: input.organizationId, employeeStatus: EmployeeStatus.ACTIVE } });
        if (!type || !cycle || !employee) throw new LeaveError('NOT_ELIGIBLE', 'Employee, leave type, or cycle is not eligible.');
        if (type.requiresEligibilityVerification && !input.eligibilityConfirmed) throw new LeaveError('ELIGIBILITY_REQUIRED', 'Explicit policy eligibility verification is required before granting this entitlement.');
        const before = await ledgerBalance(tx, employee.id, type.id, cycle.id);
        await tx.leaveLedgerEntry.create({ data: {
          organizationId: input.organizationId, employeeId, leaveTypeId: type.id, leaveCycleId: cycle.id,
          entryType: LeaveLedgerEntryType.GRANT, amountUnits: type.defaultGrantUnits!, reason: input.reason.trim(), actorUserId: input.actorUserId,
          grantSource: 'DEFAULT_CYCLE_ENTITLEMENT', beforeBalance: before, afterBalance: before + decimalNumber(type.defaultGrantUnits),
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      outcomes.push({ employeeId, status: 'GRANTED' as const });
    } catch (error) {
      outcomes.push({ employeeId, status: error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' ? 'SKIPPED_DUPLICATE' as const : 'FAILED' as const });
    }
  }
  return outcomes;
}

async function syncAttendance(requestId: string, actorUserId: string, retry = false) {
  const request = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: requestId }, include: { days: true } });
  try {
    for (const day of request.days.filter((item) => item.isScheduledWorkday)) {
      await prisma.$transaction((tx) => materializeAttendanceDay(tx, {
        organizationId: request.organizationId, employeeId: request.employeeId,
        attendanceDate: day.attendanceDate.toISOString().slice(0, 10),
      }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    await prisma.$transaction([
      prisma.leaveRequest.update({ where: { id: request.id }, data: { attendanceSyncStatus: LeaveAttendanceSyncStatus.SUCCEEDED, attendanceSyncedAt: new Date(), attendanceSyncError: null } }),
      prisma.leaveRequestAudit.create({ data: { organizationId: request.organizationId, leaveRequestId: request.id, actorUserId, action: retry ? LeaveRequestAuditAction.ATTENDANCE_SYNC_RETRIED : LeaveRequestAuditAction.ATTENDANCE_SYNC_SUCCEEDED } }),
    ]);
  } catch (error) {
    await prisma.$transaction([
      prisma.leaveRequest.update({ where: { id: request.id }, data: { attendanceSyncStatus: LeaveAttendanceSyncStatus.FAILED, attendanceSyncError: 'Attendance synchronization requires retry.' } }),
      prisma.leaveRequestAudit.create({ data: { organizationId: request.organizationId, leaveRequestId: request.id, actorUserId, action: LeaveRequestAuditAction.ATTENDANCE_SYNC_FAILED } }),
    ]);
    throw error;
  }
}

export async function reviewLeaveRequest(input: { organizationId: string; actorUserId: string; requestId: string; decision: 'APPROVE' | 'REJECT'; remarks: string; eligibilityChecks?: Record<string, boolean> }, testTransaction?: Tx) {
  const remarks = input.remarks.trim();
  if (!remarks) throw new LeaveError('REMARKS_REQUIRED', 'Reviewer remarks are required.');
  const operation = async (tx: Tx) => {
    const reviewer = await requireHr(tx, input.organizationId, input.actorUserId);
    const request = await tx.leaveRequest.findFirst({ where: { id: input.requestId, organizationId: input.organizationId, status: LeaveRequestStatus.PENDING }, include: { leaveType: true, documents: { where: { removedAt: null } } } });
    if (!request) throw new LeaveError('ALREADY_REVIEWED', 'The pending leave request was not found.');
    if (input.decision === 'REJECT') {
      await tx.leaveRequest.update({ where: { id: request.id }, data: { status: LeaveRequestStatus.REJECTED, reviewedAt: new Date(), reviewedById: input.actorUserId, reviewerNameSnapshot: reviewer.name, reviewerRemarks: remarks } });
      await tx.leaveRequestAudit.create({ data: { organizationId: input.organizationId, leaveRequestId: request.id, actorUserId: input.actorUserId, action: LeaveRequestAuditAction.REJECTED, details: { remarks } } });
      return { approved: false, rejected: true, requestId: request.id };
    }
    const policy = parseLeavePolicy(request.leaveType);
    const checks = input.eligibilityChecks ?? {};
    if (request.leaveType.requiresEligibilityVerification && !checks.ELIGIBILITY_CONFIRMED) throw new LeaveError('ELIGIBILITY_REQUIRED', 'Explicit policy eligibility verification is required.');
    if (request.leaveType.code === 'MATERNITY' && !checks.SSS_SUPPORT_CONFIRMED) throw new LeaveError('SSS_REQUIRED', 'SSS approval/support must be explicitly verified for maternity leave.');
    const built = await buildRequestDays(tx, {
      organizationId: input.organizationId,
      employeeId: request.employeeId,
      from: request.requestedStartDate.toISOString().slice(0, 10),
      to: request.requestedEndDate.toISOString().slice(0, 10),
      countingMode: request.countingModeSnapshot,
      requiredEmploymentStatus: request.leaveType.requiredEmploymentStatus,
    });
    if (request.leaveType.maximumRequestUnits && built.units > decimalNumber(request.leaveType.maximumRequestUnits)) {
      throw new LeaveError('POLICY_LIMIT', 'The request exceeds the configured leave limit.');
    }
    const needed = applicableDocumentRules(policy.documents, request.requestCategoryCode, built.units);
    for (const rule of needed) {
      const hasDocument = request.documents.some((document) => document.kindCode === rule.kindCode);
      const verifiedAlternative = rule.satisfaction === 'DOCUMENT_OR_HR_VERIFICATION' && checks[`DOCUMENT_${rule.kindCode}_VERIFIED`];
      if (!hasDocument && !verifiedAlternative) throw new LeaveError('DOCUMENT_REQUIRED', `${rule.label} is required.`);
    }
    let serviceReference = request.requestedStartDate;
    if (request.leaveType.code === 'MATERNITY') {
      const expected = String((request.eligibilityAttestation as Record<string, unknown> | null)?.EXPECTED_DELIVERY_DATE ?? '');
      serviceReference = validateLeaveRange(expected, expected).startDb;
    }
    await assertMinimumContinuousService(tx, request.employeeId, request.leaveType.minimumServiceMonths, serviceReference);
    if (request.leaveType.maximumApprovedOccurrences) {
      // Conservative SAGA rule: every historically approved delivery remains consumed after cancellation.
      // Administrative-error occurrence restoration requires an explicit future SAGA HR policy decision.
      const priorApprovals = await tx.leaveRequest.findMany({ where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, id: { not: request.id }, audits: { some: { action: LeaveRequestAuditAction.APPROVED } } }, select: { eligibilityAttestation: true } });
      if (priorApprovals.length >= request.leaveType.maximumApprovedOccurrences) throw new LeaveError('OCCURRENCE_LIMIT', 'The approved occurrence limit has been reached.');
      if (request.leaveType.code === 'PATERNITY') {
        const currentSequence = (request.eligibilityAttestation as Record<string, unknown> | null)?.DELIVERY_SEQUENCE;
        if (priorApprovals.some((prior) => (prior.eligibilityAttestation as Record<string, unknown> | null)?.DELIVERY_SEQUENCE === currentSequence)) throw new LeaveError('DUPLICATE_OCCURRENCE', 'This delivery occurrence has already been used for an approved paternity request.');
      }
    }
    if (request.leaveType.balanceTracked) {
      if (!request.leaveCycleId) throw new LeaveError('INVALID_CYCLE', 'The request has no applicable leave cycle.');
      if (request.leaveType.code === SOLO_PARENT_CODE) {
        if (!request.leaveType.defaultGrantUnits) throw new LeaveError('ENTITLEMENT_UNAVAILABLE', 'The Solo Parent entitlement is not configured.');
        await ensureDefaultCycleEntitlement(tx, {
          organizationId: input.organizationId, employeeId: request.employeeId, leaveTypeId: request.leaveTypeId,
          leaveCycleId: request.leaveCycleId, units: request.leaveType.defaultGrantUnits,
          actorUserId: input.actorUserId, reason: 'Automatic verified Solo Parent cycle entitlement',
        });
      } else if (request.leaveType.code === SICK_PERSONAL_CODE && request.leaveType.defaultGrantUnits) {
        await ensureDefaultCycleEntitlement(tx, {
          organizationId: input.organizationId, employeeId: request.employeeId, leaveTypeId: request.leaveTypeId,
          leaveCycleId: request.leaveCycleId, units: request.leaveType.defaultGrantUnits,
          actorUserId: input.actorUserId, reason: 'Automatic Sick/Personal cycle entitlement',
        });
      }
      const balance = await ledgerBalance(tx, request.employeeId, request.leaveTypeId, request.leaveCycleId);
      const units = built.units;
      if (balance < units) throw new LeaveError('INSUFFICIENT_BALANCE', 'Insufficient leave balance at approval.');
      await tx.leaveLedgerEntry.create({ data: {
        organizationId: input.organizationId, employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, leaveCycleId: request.leaveCycleId,
        leaveRequestId: request.id, entryType: LeaveLedgerEntryType.APPROVED_LEAVE, amountUnits: new Prisma.Decimal(units).negated(),
        reason: `Approved leave: ${remarks}`, actorUserId: input.actorUserId, beforeBalance: balance, afterBalance: balance - units,
      } });
    }
    const returnDate = await expectedReturnDate(tx, { organizationId: input.organizationId, employeeId: request.employeeId, after: request.requestedEndDate });
    const existingDayCount = await tx.leaveRequestDay.count({ where: { leaveRequestId: request.id } });
    if (existingDayCount === 0) {
      await tx.leaveRequestDay.createMany({ data: built.days.map((day) => ({
        ...day,
        leaveRequestId: request.id,
        employmentRecordId: day.employmentRecordId!,
      })) });
    }
    await tx.leaveRequest.update({ where: { id: request.id }, data: {
      status: LeaveRequestStatus.APPROVED, reviewedAt: new Date(), reviewedById: input.actorUserId, reviewerRemarks: remarks,
      reviewerNameSnapshot: reviewer.name,
      requestedUnits: new Prisma.Decimal(built.units), calculationFinalizedAt: new Date(), expectedReturnDateSnapshot: returnDate,
      eligibilityVerifiedAt: new Date(), eligibilityVerifiedById: input.actorUserId, eligibilityVerification: checks,
      attendanceSyncStatus: LeaveAttendanceSyncStatus.PENDING,
    } });
    await tx.leaveRequestAudit.createMany({ data: [
      { organizationId: input.organizationId, leaveRequestId: request.id, actorUserId: input.actorUserId, action: LeaveRequestAuditAction.ELIGIBILITY_VERIFIED, details: checks },
      { organizationId: input.organizationId, leaveRequestId: request.id, actorUserId: input.actorUserId, action: LeaveRequestAuditAction.APPROVED, details: { remarks, finalUnits: built.units } },
    ] });
    return { approved: true, rejected: false, requestId: request.id };
  };
  const result = testTransaction ? await operation(testTransaction) : await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!testTransaction && result.approved) await syncAttendance(result.requestId, input.actorUserId).catch(() => undefined);
  if (!testTransaction) await notifyLeaveEmployee(result.requestId, input.actorUserId, result.approved ? 'APPROVED' : 'REJECTED');
  return result;
}

export async function withdrawLeaveRequest(input: { organizationId: string; employeeId: string; actorUserId: string; requestId: string }, testTransaction?: Tx) {
  const operation = async (tx: Tx) => {
    const request = await tx.leaveRequest.update({ where: { id: input.requestId, organizationId: input.organizationId, employeeId: input.employeeId, status: LeaveRequestStatus.PENDING }, data: { status: LeaveRequestStatus.WITHDRAWN } }).catch(() => null);
    if (!request) throw new LeaveError('NOT_PENDING', 'The pending request was not found.');
    await tx.leaveRequestAudit.create({ data: { organizationId: input.organizationId, leaveRequestId: request.id, actorUserId: input.actorUserId, action: LeaveRequestAuditAction.WITHDRAWN } });
    return request;
  };
  return testTransaction ? operation(testTransaction) : prisma.$transaction(operation);
}

export async function removePendingLeaveDocument(input: { organizationId: string; employeeId: string; actorUserId: string; requestId: string; documentId: string }, testTransaction?: Tx) {
  const operation = async (tx: Tx) => {
    const document = await tx.leaveDocument.findFirst({ where: {
      id: input.documentId, organizationId: input.organizationId, employeeId: input.employeeId,
      leaveRequestId: input.requestId, removedAt: null,
      leaveRequest: { status: LeaveRequestStatus.PENDING, employeeId: input.employeeId, organizationId: input.organizationId },
    }, select: { id: true, leaveRequestId: true, kindCode: true } });
    if (!document) throw new LeaveError('DOCUMENT_UNAVAILABLE', 'Only a document on your own pending request can be removed.');
    await tx.leaveDocument.update({ where: { id: document.id }, data: { removedAt: new Date(), removedById: input.actorUserId } });
    await tx.leaveRequestAudit.create({ data: { organizationId: input.organizationId, leaveRequestId: document.leaveRequestId, actorUserId: input.actorUserId, action: LeaveRequestAuditAction.DOCUMENT_REMOVED, details: { documentId: document.id, kindCode: document.kindCode } } });
    return document;
  };
  return testTransaction ? operation(testTransaction) : prisma.$transaction(operation);
}

export async function cancelApprovedLeave(input: { organizationId: string; actorUserId: string; requestId: string; reason: string }, testTransaction?: Tx) {
  const operation = async (tx: Tx) => {
    await requireHr(tx, input.organizationId, input.actorUserId);
    const found = await tx.leaveRequest.findFirst({ where: { id: input.requestId, organizationId: input.organizationId, status: LeaveRequestStatus.APPROVED }, include: { ledgerEntries: true } });
    if (!found) throw new LeaveError('NOT_APPROVED', 'The approved request was not found.');
    const debit = found.ledgerEntries.find((entry) => entry.entryType === LeaveLedgerEntryType.APPROVED_LEAVE);
    if (debit) {
      const before = await ledgerBalance(tx, found.employeeId, found.leaveTypeId, found.leaveCycleId);
      await tx.leaveLedgerEntry.create({ data: { organizationId: input.organizationId, employeeId: found.employeeId, leaveTypeId: found.leaveTypeId, leaveCycleId: found.leaveCycleId, leaveRequestId: found.id, entryType: LeaveLedgerEntryType.REVERSAL, amountUnits: debit.amountUnits.negated(), reason: input.reason.trim(), actorUserId: input.actorUserId, reversesEntryId: debit.id, beforeBalance: before, afterBalance: before + Math.abs(decimalNumber(debit.amountUnits)) } });
    }
    await tx.leaveRequest.update({ where: { id: found.id }, data: { status: LeaveRequestStatus.CANCELLED, attendanceSyncStatus: LeaveAttendanceSyncStatus.PENDING } });
    await tx.leaveRequestAudit.create({ data: { organizationId: input.organizationId, leaveRequestId: found.id, actorUserId: input.actorUserId, action: LeaveRequestAuditAction.CANCELLED, details: { reason: input.reason.trim() } } });
    return found;
  };
  const request = testTransaction ? await operation(testTransaction) : await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!testTransaction) await syncAttendance(request.id, input.actorUserId).catch(() => undefined);
  if (!testTransaction) await notifyLeaveEmployee(request.id, input.actorUserId, 'CANCELLED');
}

export async function retryLeaveAttendanceSync(input: { organizationId: string; actorUserId: string; requestId: string }) {
  await prisma.$transaction(async (tx) => { await requireHr(tx, input.organizationId, input.actorUserId); const found = await tx.leaveRequest.findFirst({ where: { id: input.requestId, organizationId: input.organizationId, status: { in: [LeaveRequestStatus.APPROVED, LeaveRequestStatus.CANCELLED] } } }); if (!found) throw new LeaveError('NOT_FOUND', 'Leave request not found.'); });
  return syncAttendance(input.requestId, input.actorUserId, true);
}
