import { Temporal } from '@js-temporal/polyfill';
import { AttendanceDirection, AttendanceStatus } from '@prisma/client';

export interface AttendanceEventFact {
  id: string;
  occurredAt: Date;
  direction: AttendanceDirection | null;
}

export interface ScheduleBreakRule {
  startSecond: number;
  endSecond: number;
  isPaid: boolean;
}

export interface AttendancePairing {
  firstTimeIn: Date | null;
  lastTimeOut: Date | null;
  hasUnclassifiedEvents: boolean;
  hasOutBeforeIn: boolean;
}

export interface AttendanceDurations {
  workedSeconds: number | null;
  lateSeconds: number | null;
  undertimeSeconds: number | null;
  overtimeSeconds: number | null;
}

export interface AttendanceIndicatorSummary {
  tardinessCount: number;
  absenceDays: number;
  longestConsecutiveAbsenceDays: number;
  habitualTardinessReview: boolean;
  absenceFrequencyReview: boolean;
  possibleAwolPatternReview: boolean;
  unauthorizedAbsenceDays: null;
}

export function assertTimeZone(timeZone: string): string {
  const value = timeZone.trim();
  try {
    Temporal.Now.zonedDateTimeISO(value);
  } catch {
    throw new Error('A valid IANA organization timezone is required.');
  }
  return value;
}

export function attendanceDateForInstant(instant: Date, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(instant.getTime())
    .toZonedDateTimeISO(assertTimeZone(timeZone))
    .toPlainDate()
    .toString();
}

export function parseAttendanceDate(value: string): Temporal.PlainDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Attendance date must use YYYY-MM-DD format.');
  }
  try {
    return Temporal.PlainDate.from(value);
  } catch {
    throw new Error('Attendance date is invalid.');
  }
}

export function attendanceDateToDb(value: string): Date {
  parseAttendanceDate(value);
  return new Date(`${value}T00:00:00.000Z`);
}

export function instantForLocalSecond(
  attendanceDate: string,
  secondOfDay: number,
  timeZone: string
): Date {
  const day = parseAttendanceDate(attendanceDate);
  if (!Number.isInteger(secondOfDay) || secondOfDay < 0 || secondOfDay > 86_400) {
    throw new Error('Schedule time must be a whole second within the local day.');
  }
  const date = secondOfDay === 86_400 ? day.add({ days: 1 }) : day;
  const normalized = secondOfDay === 86_400 ? 0 : secondOfDay;
  const hour = Math.floor(normalized / 3600);
  const minute = Math.floor((normalized % 3600) / 60);
  const second = normalized % 60;
  const zoned = Temporal.ZonedDateTime.from(
    { year: date.year, month: date.month, day: date.day, hour, minute, second, timeZone: assertTimeZone(timeZone) },
    { disambiguation: 'compatible' }
  );
  return new Date(Number(zoned.epochMilliseconds));
}

export function instantForLocalDateTime(value: string, timeZone: string): Date {
  let plain: Temporal.PlainDateTime;
  try {
    plain = Temporal.PlainDateTime.from(value);
  } catch {
    throw new Error('Local attendance date and time is invalid.');
  }
  const zoned = Temporal.ZonedDateTime.from(
    {
      year: plain.year, month: plain.month, day: plain.day,
      hour: plain.hour, minute: plain.minute, second: plain.second,
      millisecond: plain.millisecond, timeZone: assertTimeZone(timeZone),
    },
    { disambiguation: 'compatible' }
  );
  return new Date(Number(zoned.epochMilliseconds));
}

export function pairAttendanceEvents(events: AttendanceEventFact[]): AttendancePairing {
  const ordered = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id)
  );
  const firstIn = ordered.find((event) => event.direction === AttendanceDirection.TIME_IN) ?? null;
  const validOuts = firstIn
    ? ordered.filter(
        (event) =>
          event.direction === AttendanceDirection.TIME_OUT &&
          event.occurredAt.getTime() > firstIn.occurredAt.getTime()
      )
    : [];
  const lastOut = validOuts.at(-1) ?? null;
  return {
    firstTimeIn: firstIn?.occurredAt ?? null,
    lastTimeOut: lastOut?.occurredAt ?? null,
    hasUnclassifiedEvents: ordered.some((event) => event.direction === null),
    hasOutBeforeIn: ordered.some(
      (event) =>
        event.direction === AttendanceDirection.TIME_OUT &&
        (!firstIn || event.occurredAt.getTime() <= firstIn.occurredAt.getTime())
    ),
  };
}

function overlapSeconds(start: Date, end: Date, breakStart: Date, breakEnd: Date): number {
  return Math.max(
    0,
    Math.floor((Math.min(end.getTime(), breakEnd.getTime()) - Math.max(start.getTime(), breakStart.getTime())) / 1000)
  );
}

export function calculateAttendanceDurations(input: {
  attendanceDate: string;
  timeZone: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  lateGraceSeconds: number;
  breaks: ScheduleBreakRule[];
  firstTimeIn: Date | null;
  lastTimeOut: Date | null;
}): AttendanceDurations {
  const { firstTimeIn, lastTimeOut } = input;
  const lateSeconds = firstTimeIn
    ? Math.max(0, Math.floor((firstTimeIn.getTime() - input.scheduledStartAt.getTime()) / 1000) - input.lateGraceSeconds)
    : null;
  const undertimeSeconds = lastTimeOut
    ? Math.max(0, Math.floor((input.scheduledEndAt.getTime() - lastTimeOut.getTime()) / 1000))
    : null;
  const overtimeSeconds = lastTimeOut
    ? Math.max(0, Math.floor((lastTimeOut.getTime() - input.scheduledEndAt.getTime()) / 1000))
    : null;
  if (!firstTimeIn || !lastTimeOut || lastTimeOut <= firstTimeIn) {
    return { workedSeconds: null, lateSeconds, undertimeSeconds, overtimeSeconds };
  }
  const unpaid = input.breaks
    .filter((rule) => !rule.isPaid)
    .reduce(
      (sum, rule) =>
        sum + overlapSeconds(
          firstTimeIn,
          lastTimeOut,
          instantForLocalSecond(input.attendanceDate, rule.startSecond, input.timeZone),
          instantForLocalSecond(input.attendanceDate, rule.endSecond, input.timeZone)
        ),
      0
    );
  return {
    workedSeconds: Math.max(0, Math.floor((lastTimeOut.getTime() - firstTimeIn.getTime()) / 1000) - unpaid),
    lateSeconds,
    undertimeSeconds,
    overtimeSeconds,
  };
}

export function deriveAttendanceStatus(input: {
  isWorkday: boolean | null;
  scheduledEndAt: Date | null;
  asOf: Date;
  pairing: AttendancePairing;
  eventCount: number;
}): { status: AttendanceStatus; finalizedAt: Date | null } {
  if (input.isWorkday === null) return { status: AttendanceStatus.NO_SCHEDULE, finalizedAt: input.asOf };
  if (!input.isWorkday) return { status: AttendanceStatus.REST_DAY, finalizedAt: input.asOf };
  const complete = input.scheduledEndAt !== null && input.asOf >= input.scheduledEndAt;
  if (input.pairing.firstTimeIn && input.pairing.lastTimeOut) {
    return { status: AttendanceStatus.PRESENT, finalizedAt: complete ? input.asOf : null };
  }
  if (!complete) return { status: AttendanceStatus.OPEN, finalizedAt: null };
  if (input.eventCount === 0) return { status: AttendanceStatus.ABSENT, finalizedAt: input.asOf };
  return { status: AttendanceStatus.INCOMPLETE, finalizedAt: input.asOf };
}

export function summarizeAttendanceIndicators(
  days: Array<{ attendanceDate: string; status: AttendanceStatus; lateSeconds: number | null }>
): AttendanceIndicatorSummary {
  const ordered = [...days].sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate));
  let streak = 0;
  let longest = 0;
  for (const day of ordered) {
    if (day.status === AttendanceStatus.ABSENT) {
      streak += 1;
      longest = Math.max(longest, streak);
    } else if (day.status !== AttendanceStatus.REST_DAY && day.status !== AttendanceStatus.NO_SCHEDULE) {
      streak = 0;
    }
  }
  const tardinessCount = ordered.filter((day) => (day.lateSeconds ?? 0) > 0).length;
  const absenceDays = ordered.filter((day) => day.status === AttendanceStatus.ABSENT).length;
  return {
    tardinessCount,
    absenceDays,
    longestConsecutiveAbsenceDays: longest,
    habitualTardinessReview: tardinessCount >= 4,
    absenceFrequencyReview: absenceDays >= 3,
    possibleAwolPatternReview: longest >= 5,
    unauthorizedAbsenceDays: null,
  };
}

export function durationLabel(seconds: number | null): string {
  if (seconds === null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m ${remainder}s` : `${minutes}m ${remainder}s`;
}
