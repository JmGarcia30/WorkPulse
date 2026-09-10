import { randomUUID } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import {
  AttendanceDerivation,
  AttendanceDirection,
  AttendanceSource,
  AttendanceStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  attendanceDateForInstant,
  attendanceDateToDb,
  calculateAttendanceDurations,
  deriveAttendanceStatus,
  instantForLocalSecond,
  pairAttendanceEvents,
  parseAttendanceDate,
} from './domain';

export type AttendanceErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'
  | 'OVERLAPPING_ASSIGNMENT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CONCURRENT_UPDATE';

export class AttendanceError extends Error {
  constructor(public readonly code: AttendanceErrorCode, message: string) {
    super(message);
    this.name = 'AttendanceError';
  }
}

type DbClient = Prisma.TransactionClient;

async function assertActor(
  db: DbClient,
  organizationId: string,
  actorUserId: string
) {
  const actor = await db.user.findFirst({
    where: {
      id: actorUserId,
      organizationId,
      role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] },
    },
    select: { id: true },
  });
  if (!actor) throw new AttendanceError('UNAUTHORIZED', 'Attendance access denied.');
}

function cleanText(value: string, label: string, max = 2_000): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new AttendanceError('INVALID_INPUT', `${label} is required and must not exceed ${max} characters.`);
  }
  return cleaned;
}

function validateDays(days: CreateScheduleInput['days']) {
  if (days.length !== 7 || new Set(days.map((day) => day.isoWeekday)).size !== 7) {
    throw new AttendanceError('INVALID_INPUT', 'A schedule version must define each ISO weekday exactly once.');
  }
  for (const day of days) {
    if (day.isoWeekday < 1 || day.isoWeekday > 7) throw new AttendanceError('INVALID_INPUT', 'ISO weekday must be between 1 and 7.');
    if (day.isWorkday) {
      if (day.expectedStartSecond === null || day.expectedEndSecond === null || day.expectedEndSecond <= day.expectedStartSecond) {
        throw new AttendanceError('INVALID_INPUT', 'Workdays require a same-day start and end time. Overnight schedules are outside H3.');
      }
    } else if (day.expectedStartSecond !== null || day.expectedEndSecond !== null || day.breaks.length > 0) {
      throw new AttendanceError('INVALID_INPUT', 'Rest days cannot define working times or breaks.');
    }
    const sorted = [...day.breaks].sort((a, b) => a.startSecond - b.startSecond);
    for (let index = 0; index < sorted.length; index += 1) {
      const item = sorted[index];
      if (item.endSecond <= item.startSecond || item.startSecond < (day.expectedStartSecond ?? 0) || item.endSecond > (day.expectedEndSecond ?? 0)) {
        throw new AttendanceError('INVALID_INPUT', 'Breaks must be non-overlapping and within the workday.');
      }
      if (index > 0 && sorted[index - 1].endSecond > item.startSecond) {
        throw new AttendanceError('INVALID_INPUT', 'Schedule breaks cannot overlap.');
      }
    }
  }
}

export interface CreateScheduleInput {
  organizationId: string;
  actorUserId: string;
  scheduleKey?: string;
  name: string;
  description?: string | null;
  lateGraceSeconds?: number;
  days: Array<{
    isoWeekday: number;
    isWorkday: boolean;
    expectedStartSecond: number | null;
    expectedEndSecond: number | null;
    breaks: Array<{ startSecond: number; endSecond: number; isPaid: boolean }>;
  }>;
}

export async function createScheduleVersion(input: CreateScheduleInput) {
  validateDays(input.days);
  const name = cleanText(input.name, 'Schedule name', 120);
  const grace = input.lateGraceSeconds ?? 0;
  if (!Number.isInteger(grace) || grace < 0) {
    throw new AttendanceError('INVALID_INPUT', 'Late grace seconds must be zero or greater.');
  }
  return prisma.$transaction(async (tx) => {
    await assertActor(tx, input.organizationId, input.actorUserId);
    let group;
    if (input.scheduleKey) {
      group = await tx.workScheduleGroup.findFirst({
        where: { organizationId: input.organizationId, scheduleKey: input.scheduleKey },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
      if (!group) throw new AttendanceError('NOT_FOUND', 'Schedule not found or access denied.');
    } else {
      group = await tx.workScheduleGroup.create({
        data: {
          organizationId: input.organizationId,
          scheduleKey: `schedule-${randomUUID()}`,
          name,
          description: input.description?.trim() || null,
          createdById: input.actorUserId,
        },
        include: { versions: true },
      });
    }
    const versionNumber = (group.versions[0]?.version ?? 0) + 1;
    const version = await tx.workScheduleVersion.create({
      data: {
        scheduleGroupId: group.id,
        version: versionNumber,
        displayName: name,
        lateGraceSeconds: grace,
        createdById: input.actorUserId,
        days: {
          create: input.days.map((day) => ({
            isoWeekday: day.isoWeekday,
            isWorkday: day.isWorkday,
            expectedStartSecond: day.expectedStartSecond,
            expectedEndSecond: day.expectedEndSecond,
            breaks: { create: day.breaks },
          })),
        },
      },
    });
    if (input.scheduleKey && group.name !== name) {
      await tx.workScheduleGroup.update({ where: { id: group.id }, data: { name } });
    }
    return { scheduleKey: group.scheduleKey, scheduleVersionId: version.id, version: version.version };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function assignSchedule(input: {
  organizationId: string;
  actorUserId: string;
  employeeId: string;
  scheduleVersionId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}) {
  const from = attendanceDateToDb(input.effectiveFrom);
  const to = input.effectiveTo ? attendanceDateToDb(input.effectiveTo) : null;
  if (to && to <= from) throw new AttendanceError('INVALID_INPUT', 'Assignment end must be after its start.');
  return prisma.$transaction(async (tx) => {
    await assertActor(tx, input.organizationId, input.actorUserId);
    const [employee, version] = await Promise.all([
      tx.employee.findFirst({ where: { id: input.employeeId, organizationId: input.organizationId }, select: { id: true } }),
      tx.workScheduleVersion.findFirst({ where: { id: input.scheduleVersionId, scheduleGroup: { organizationId: input.organizationId } }, select: { id: true } }),
    ]);
    if (!employee || !version) throw new AttendanceError('NOT_FOUND', 'Employee or schedule not found or access denied.');
    const overlap = await tx.employeeScheduleAssignment.findFirst({
      where: {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        effectiveFrom: { lt: to ?? new Date('9999-12-31T00:00:00.000Z') },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }],
      },
      select: { id: true },
    });
    if (overlap) throw new AttendanceError('OVERLAPPING_ASSIGNMENT', 'The employee already has a schedule in that date range.');
    return tx.employeeScheduleAssignment.create({
      data: {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        scheduleVersionId: input.scheduleVersionId,
        effectiveFrom: from,
        effectiveTo: to,
        createdById: input.actorUserId,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

const scheduleInclude = {
  scheduleVersion: {
    include: {
      scheduleGroup: true,
      days: { include: { breaks: true } },
    },
  },
} satisfies Prisma.EmployeeScheduleAssignmentInclude;

export async function materializeAttendanceDay(
  db: DbClient,
  input: { organizationId: string; employeeId: string; attendanceDate: string; asOf?: Date }
) {
  const date = attendanceDateToDb(input.attendanceDate);
  const organization = await db.organization.findUnique({ where: { id: input.organizationId }, select: { timeZone: true } });
  if (!organization) throw new AttendanceError('NOT_FOUND', 'Organization not found.');
  const dayStart = instantForLocalSecond(input.attendanceDate, 0, organization.timeZone);
  const dayEnd = instantForLocalSecond(input.attendanceDate, 86_400, organization.timeZone);
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, organizationId: input.organizationId },
    include: {
      employmentRecords: {
        where: { effectiveFrom: { lt: dayEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: dayStart } }] },
        orderBy: { effectiveFrom: 'desc' }, take: 1,
      },
    },
  });
  const employment = employee?.employmentRecords[0];
  if (!employee || !employment) throw new AttendanceError('NOT_FOUND', 'Employee was not employed on the requested date.');
  const assignment = await db.employeeScheduleAssignment.findFirst({
    where: {
      organizationId: input.organizationId, employeeId: input.employeeId,
      effectiveFrom: { lte: date }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: date } }],
    },
    include: scheduleInclude,
    orderBy: { effectiveFrom: 'desc' },
  });
  const scheduleDay = assignment?.scheduleVersion.days.find(
    (item) => item.isoWeekday === parseAttendanceDate(input.attendanceDate).dayOfWeek
  ) ?? null;
  const events = await db.attendanceEvent.findMany({
    where: { organizationId: input.organizationId, employeeId: input.employeeId, occurredAt: { gte: dayStart, lt: dayEnd } },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  });
  const pairing = pairAttendanceEvents(events);
  const scheduledStartAt = scheduleDay?.isWorkday && scheduleDay.expectedStartSecond !== null
    ? instantForLocalSecond(input.attendanceDate, scheduleDay.expectedStartSecond, organization.timeZone) : null;
  const scheduledEndAt = scheduleDay?.isWorkday && scheduleDay.expectedEndSecond !== null
    ? instantForLocalSecond(input.attendanceDate, scheduleDay.expectedEndSecond, organization.timeZone) : null;
  const latestCorrection = await db.attendanceCorrection.findFirst({
    where: { organizationId: input.organizationId, dailyAttendanceRecord: { employeeId: input.employeeId, attendanceDate: date } },
    orderBy: { revision: 'desc' },
  });
  const firstTimeIn = latestCorrection ? latestCorrection.correctedTimeIn : pairing.firstTimeIn;
  const lastTimeOut = latestCorrection ? latestCorrection.correctedTimeOut : pairing.lastTimeOut;
  const effectivePairing = { ...pairing, firstTimeIn, lastTimeOut };
  const derived = deriveAttendanceStatus({
    isWorkday: scheduleDay ? scheduleDay.isWorkday : null,
    scheduledEndAt,
    asOf: input.asOf ?? new Date(),
    pairing: effectivePairing,
    eventCount: events.length,
  });
  const status = latestCorrection?.correctedStatus ?? derived.status;
  const durations = scheduledStartAt && scheduledEndAt && scheduleDay?.isWorkday
    ? calculateAttendanceDurations({
        attendanceDate: input.attendanceDate, timeZone: organization.timeZone,
        scheduledStartAt, scheduledEndAt,
        lateGraceSeconds: assignment?.scheduleVersion.lateGraceSeconds ?? 0,
        breaks: scheduleDay.breaks, firstTimeIn, lastTimeOut,
      })
    : { workedSeconds: null, lateSeconds: null, undertimeSeconds: null, overtimeSeconds: null };
  const scheduledUnpaidBreakSeconds = scheduleDay?.breaks
    .filter((item) => !item.isPaid)
    .reduce((sum, item) => sum + item.endSecond - item.startSecond, 0) ?? 0;
  return db.dailyAttendanceRecord.upsert({
    where: { organizationId_employeeId_attendanceDate: { organizationId: input.organizationId, employeeId: input.employeeId, attendanceDate: date } },
    update: {
      employmentRecordId: employment.id, scheduleAssignmentId: assignment?.id ?? null,
      timeZoneSnapshot: organization.timeZone, scheduledStartAt, scheduledEndAt,
      lateGraceSeconds: assignment?.scheduleVersion.lateGraceSeconds ?? 0,
      scheduledUnpaidBreakSeconds, firstTimeIn, lastTimeOut, ...durations,
      attendanceStatus: status,
      derivation: latestCorrection ? AttendanceDerivation.CORRECTED : AttendanceDerivation.RAW_EVENTS,
      hasUnclassifiedEvents: pairing.hasUnclassifiedEvents, hasOutBeforeIn: pairing.hasOutBeforeIn,
      correctionVersion: latestCorrection?.revision ?? 0,
      finalizedAt: status === AttendanceStatus.OPEN ? null : derived.finalizedAt,
      lastCalculatedAt: input.asOf ?? new Date(),
    },
    create: {
      organizationId: input.organizationId, employeeId: input.employeeId,
      employmentRecordId: employment.id, scheduleAssignmentId: assignment?.id ?? null,
      attendanceDate: date, timeZoneSnapshot: organization.timeZone,
      scheduledStartAt, scheduledEndAt,
      lateGraceSeconds: assignment?.scheduleVersion.lateGraceSeconds ?? 0,
      scheduledUnpaidBreakSeconds, firstTimeIn, lastTimeOut, ...durations,
      attendanceStatus: status,
      derivation: latestCorrection ? AttendanceDerivation.CORRECTED : AttendanceDerivation.RAW_EVENTS,
      hasUnclassifiedEvents: pairing.hasUnclassifiedEvents, hasOutBeforeIn: pairing.hasOutBeforeIn,
      correctionVersion: latestCorrection?.revision ?? 0,
      finalizedAt: status === AttendanceStatus.OPEN ? null : derived.finalizedAt,
      lastCalculatedAt: input.asOf ?? new Date(),
    },
  });
}

export async function materializeAttendancePeriod(input: {
  organizationId: string; actorUserId: string; employeeIds?: string[]; from: string; to: string; asOf?: Date;
}) {
  const from = parseAttendanceDate(input.from);
  const to = parseAttendanceDate(input.to);
  if (Temporal.PlainDate.compare(to, from) < 0 || from.until(to).days > 62) {
    throw new AttendanceError('INVALID_INPUT', 'Attendance evaluation range must be between 1 and 63 days.');
  }
  const employees = await prisma.$transaction(async (tx) => {
    await assertActor(tx, input.organizationId, input.actorUserId);
    const selectedEmployees = await tx.employee.findMany({
      where: { organizationId: input.organizationId, id: input.employeeIds ? { in: input.employeeIds } : undefined },
      select: { id: true },
    });
    if (input.employeeIds && selectedEmployees.length !== new Set(input.employeeIds).size) {
      throw new AttendanceError('NOT_FOUND', 'Employee not found or access denied.');
    }
    return selectedEmployees;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  let count = 0;
  for (let cursor = from; Temporal.PlainDate.compare(cursor, to) <= 0; cursor = cursor.add({ days: 1 })) {
    for (const employee of employees) {
      try {
        await prisma.$transaction(
          async (tx) => {
            await materializeAttendanceDay(tx, { organizationId: input.organizationId, employeeId: employee.id, attendanceDate: cursor.toString(), asOf: input.asOf });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
        count += 1;
      } catch (error) {
        if (!(error instanceof AttendanceError) || error.code !== 'NOT_FOUND') throw error;
      }
    }
  }
  return { materializedCount: count };
}

export function createManualSubmissionToken(): string {
  return randomUUID();
}

export async function recordAttendanceEvent(input: {
  organizationId: string; actorUserId?: string; employeeId: string; occurredAt: Date;
  direction?: AttendanceDirection | null; source: AttendanceSource; sourceReference: string; metadata?: Prisma.InputJsonValue;
}) {
  if (input.source === AttendanceSource.RFID) throw new AttendanceError('UNAUTHORIZED', 'RFID ingestion is reserved for a future authenticated adapter.');
  if (!input.actorUserId) throw new AttendanceError('UNAUTHORIZED', 'An authenticated attendance actor is required.');
  if (!input.direction) throw new AttendanceError('INVALID_INPUT', 'Manual and import events require a direction.');
  if (input.metadata && (typeof input.metadata !== 'object' || Array.isArray(input.metadata) || Buffer.byteLength(JSON.stringify(input.metadata), 'utf8') > 4096)) {
    throw new AttendanceError('INVALID_INPUT', 'Attendance metadata must be a JSON object no larger than 4 KiB.');
  }
  return prisma.$transaction(async (tx) => {
    await assertActor(tx, input.organizationId, input.actorUserId!);
    const employee = await tx.employee.findFirst({ where: { id: input.employeeId, organizationId: input.organizationId }, select: { id: true } });
    if (!employee) throw new AttendanceError('NOT_FOUND', 'Employee not found or access denied.');
    const inserted = await tx.attendanceEvent.createMany({
      skipDuplicates: true,
      data: [{
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        occurredAt: input.occurredAt,
        direction: input.direction,
        source: input.source,
        sourceReference: input.sourceReference,
        metadata: input.metadata,
        createdById: input.actorUserId,
      }],
    });
    const event = await tx.attendanceEvent.findUniqueOrThrow({
      where: { organizationId_source_sourceReference: { organizationId: input.organizationId, source: input.source, sourceReference: input.sourceReference } },
    });
    if (
      event.employeeId !== input.employeeId ||
      event.occurredAt.getTime() !== input.occurredAt.getTime() ||
      event.direction !== input.direction ||
      JSON.stringify(event.metadata) !== JSON.stringify(input.metadata ?? null)
    ) {
      throw new AttendanceError('IDEMPOTENCY_CONFLICT', 'The attendance reference was already used for different event data.');
    }
    const organization = await tx.organization.findUniqueOrThrow({ where: { id: input.organizationId }, select: { timeZone: true } });
    await materializeAttendanceDay(tx, {
      organizationId: input.organizationId, employeeId: input.employeeId,
      attendanceDate: attendanceDateForInstant(input.occurredAt, organization.timeZone),
    });
    return { eventId: event.id, idempotent: inserted.count === 0 };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function correctAttendance(input: {
  organizationId: string; actorUserId: string; dailyAttendanceRecordId: string;
  expectedRevision: number; correctedTimeIn: Date | null; correctedTimeOut: Date | null;
  correctedStatus: AttendanceStatus; reason: string;
}) {
  const correctableStatuses: AttendanceStatus[] = [AttendanceStatus.PRESENT, AttendanceStatus.ABSENT, AttendanceStatus.INCOMPLETE];
  if (!correctableStatuses.includes(input.correctedStatus)) {
    throw new AttendanceError('INVALID_INPUT', 'Corrections may set Present, Absent, or Incomplete only.');
  }
  if (input.correctedStatus === AttendanceStatus.PRESENT && (!input.correctedTimeIn || !input.correctedTimeOut || input.correctedTimeOut <= input.correctedTimeIn)) {
    throw new AttendanceError('INVALID_INPUT', 'A Present correction requires a valid time-in and time-out pair.');
  }
  const reason = cleanText(input.reason, 'Correction reason');
  return prisma.$transaction(async (tx) => {
    await assertActor(tx, input.organizationId, input.actorUserId);
    const record = await tx.dailyAttendanceRecord.findFirst({ where: { id: input.dailyAttendanceRecordId, organizationId: input.organizationId } });
    if (!record) throw new AttendanceError('NOT_FOUND', 'Attendance record not found or access denied.');
    if (record.correctionVersion !== input.expectedRevision) throw new AttendanceError('CONCURRENT_UPDATE', 'Attendance was changed; refresh before correcting it.');
    const revision = record.correctionVersion + 1;
    const previousState = { firstTimeIn: record.firstTimeIn?.toISOString() ?? null, lastTimeOut: record.lastTimeOut?.toISOString() ?? null, attendanceStatus: record.attendanceStatus, correctionVersion: record.correctionVersion };
    const correctedState = { firstTimeIn: input.correctedTimeIn?.toISOString() ?? null, lastTimeOut: input.correctedTimeOut?.toISOString() ?? null, attendanceStatus: input.correctedStatus, correctionVersion: revision };
    await tx.attendanceCorrection.create({
      data: {
        organizationId: input.organizationId, dailyAttendanceRecordId: record.id, revision,
        correctedTimeIn: input.correctedTimeIn, correctedTimeOut: input.correctedTimeOut,
        correctedStatus: input.correctedStatus, reason, previousState, correctedState,
        createdById: input.actorUserId,
      },
    });
    await materializeAttendanceDay(tx, {
      organizationId: input.organizationId, employeeId: record.employeeId,
      attendanceDate: record.attendanceDate.toISOString().slice(0, 10),
    });
    return { dailyAttendanceRecordId: record.id, revision };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
