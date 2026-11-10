import 'server-only';

import { AttendanceDirection, AttendanceSource, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { attendanceDateForInstant, attendanceDateToDb, instantForLocalDateTime, instantForLocalSecond } from './domain';
import { AttendanceError, lockAttendanceEmployee, writeAttendanceEvent } from './service';

export const emergencyAttendanceReasons = [
  'POWER_OUTAGE', 'INTERNET_OUTAGE', 'RFID_DEVICE_FAILURE', 'OTHER',
] as const;
export type EmergencyAttendanceReason = typeof emergencyAttendanceReasons[number];

export type EmergencyAttendanceInput = {
  organizationId: string;
  actorUserId: string;
  employeeId: string;
  attendanceDate: string;
  timeIn: string;
  timeOut: string;
  reason: EmergencyAttendanceReason;
  evidenceReference: string;
  notes: string;
  submissionToken: string;
};

function checked(value: string, label: string, maximum: number): string {
  const text = value.trim();
  if (text.length < 3 || text.length > maximum) {
    throw new AttendanceError('INVALID_INPUT', `${label} must contain 3–${maximum} characters.`);
  }
  return text;
}

/**
 * Reconcile a signed offline attendance sheet after WorkPulse comes back online.
 * Never create fabricated RFID events or replace/correct existing raw events.
 * Both MANUAL events and their daily projection are committed as ONE transaction.
 */
export async function recoverEmergencyAttendance(input: EmergencyAttendanceInput) {
  if (!/^[-0-9a-f]{36}$/i.test(input.submissionToken)) {
    throw new AttendanceError('INVALID_INPUT', 'The submission token is invalid.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.attendanceDate) ||
      !/^\d{2}:\d{2}$/.test(input.timeIn) || !/^\d{2}:\d{2}$/.test(input.timeOut) ||
      !emergencyAttendanceReasons.includes(input.reason)) {
    throw new AttendanceError('INVALID_INPUT', 'Choose a valid date, time-in, time-out and incident reason.');
  }
  const evidenceReference = checked(input.evidenceReference, 'Paper attendance reference', 160);
  const notes = checked(input.notes, 'Incident notes', 800);
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId }, select: { timeZone: true },
  });
  if (!organization) throw new AttendanceError('NOT_FOUND', 'Organization unavailable.');

  let timeIn: Date;
  let timeOut: Date;
  let start: Date;
  let end: Date;
  try {
    timeIn = instantForLocalDateTime(`${input.attendanceDate}T${input.timeIn}`, organization.timeZone);
    timeOut = instantForLocalDateTime(`${input.attendanceDate}T${input.timeOut}`, organization.timeZone);
    start = instantForLocalSecond(input.attendanceDate, 0, organization.timeZone);
    end = instantForLocalSecond(input.attendanceDate, 86400, organization.timeZone);
  } catch {
    throw new AttendanceError('INVALID_INPUT', 'The incident date or time is invalid for the organization time zone.');
  }
  const now = new Date();
  if (timeOut <= timeIn || attendanceDateForInstant(timeIn, organization.timeZone) !== input.attendanceDate ||
      attendanceDateForInstant(timeOut, organization.timeZone) !== input.attendanceDate) {
    throw new AttendanceError('INVALID_INPUT', 'Enter time-in and time-out in order on the same local attendance date.');
  }
  if (timeOut > now || start.getTime() < now.getTime() - 90 * 86400_000) {
    throw new AttendanceError('INVALID_INPUT', 'Emergency attendance must be in the past 90 days. Older corrections require separate HR review.');
  }

  const metadata = {
    purpose: 'EMERGENCY_ATTENDANCE_RECOVERY',
    incident: input.reason,
    evidenceReference,
    notes,
    attendanceDate: input.attendanceDate,
  };
  const inRef = `emergency:${input.submissionToken}:in`;
  const outRef = `emergency:${input.submissionToken}:out`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const actor = await tx.user.findFirst({
          where: { id: input.actorUserId, organizationId: input.organizationId, role: { in: [Role.HR_ADMIN, Role.ORGANIZATION_ADMIN] } },
          select: { id: true },
        });
        if (!actor) throw new AttendanceError('UNAUTHORIZED', 'Only authorized HR administrators can reconcile outage attendance.');
        await lockAttendanceEmployee(tx, input.organizationId, input.employeeId);
        const employee = await tx.employee.findFirst({
          where: { id: input.employeeId, organizationId: input.organizationId },
          select: { id: true },
        });
        if (!employee) throw new AttendanceError('NOT_FOUND', 'Employee not found in your organization.');

        // Replay of the same saved request is safe, even after a lost response.
        const previous = await tx.attendanceEvent.findMany({
          where: { organizationId: input.organizationId, source: AttendanceSource.MANUAL, sourceReference: { in: [inRef, outRef] } },
        });
        if (previous.length) {
          const expected = [
            { reference: inRef, direction: AttendanceDirection.TIME_IN, at: timeIn },
            { reference: outRef, direction: AttendanceDirection.TIME_OUT, at: timeOut },
          ];
          const matches = previous.length === 2 && expected.every(value =>
            previous.some(event => event.sourceReference === value.reference &&
              event.employeeId === input.employeeId && event.direction === value.direction &&
              event.occurredAt.getTime() === value.at.getTime() &&
              JSON.stringify(event.metadata) === JSON.stringify(metadata)),
          );
          if (!matches) throw new AttendanceError('IDEMPOTENCY_CONFLICT', 'This request token was already used with different details.');
          return { idempotent: true as const };
        }

        const existingEvent = await tx.attendanceEvent.findFirst({
          where: { organizationId: input.organizationId, employeeId: input.employeeId, occurredAt: { gte: start, lt: end } },
          select: { id: true },
        });
        if (existingEvent) {
          throw new AttendanceError('INVALID_INPUT',
            'RFID or manual attendance already exists for this day. Review the DTR and use the versioned correction workflow instead.');
        }
        const daily = await tx.dailyAttendanceRecord.findUnique({
          where: { organizationId_employeeId_attendanceDate: {
            organizationId: input.organizationId, employeeId: input.employeeId,
            attendanceDate: attendanceDateToDb(input.attendanceDate),
          } },
          select: { correctionVersion: true, approvedLeaveRequestDayId: true, finalizedAt: true },
        });
        if (daily && (daily.correctionVersion > 0 || daily.approvedLeaveRequestDayId || daily.finalizedAt)) {
          throw new AttendanceError('INVALID_INPUT', 'This day has corrections, approved leave or finalized attendance. Review it before changing records.');
        }
        const finalized = await tx.payrollPeriod.findFirst({
          where: {
            organizationId: input.organizationId,
            periodStart: { lte: attendanceDateToDb(input.attendanceDate) },
            periodEnd: { gte: attendanceDateToDb(input.attendanceDate) },
            status: 'FINALIZED',
            payrollEntries: { some: { employeeId: input.employeeId } },
          },
          select: { id: true },
        });
        if (finalized) throw new AttendanceError('INVALID_INPUT', 'This date is in finalized payroll. Use the authorized payroll correction procedure.');

        await writeAttendanceEvent(tx, {
          organizationId: input.organizationId, actorUserId: actor.id, employeeId: input.employeeId,
          occurredAt: timeIn, direction: AttendanceDirection.TIME_IN,
          source: AttendanceSource.MANUAL, sourceReference: inRef, metadata,
        });
        await writeAttendanceEvent(tx, {
          organizationId: input.organizationId, actorUserId: actor.id, employeeId: input.employeeId,
          occurredAt: timeOut, direction: AttendanceDirection.TIME_OUT,
          source: AttendanceSource.MANUAL, sourceReference: outRef, metadata,
        });
        return { idempotent: false as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') continue;
      throw error;
    }
  }
  throw new AttendanceError('UNAVAILABLE', 'Attendance recovery could not be saved.');
}
