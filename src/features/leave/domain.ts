import { Temporal } from '@js-temporal/polyfill';
import { LeaveCountingMode, LeaveRequestStatus } from '@prisma/client';
import { attendanceDateToDb, parseAttendanceDate } from '@/features/attendance/domain';

export class LeaveError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'LeaveError';
  }
}

export const ACTIVE_LEAVE_STATUSES: LeaveRequestStatus[] = [
  LeaveRequestStatus.PENDING,
  LeaveRequestStatus.APPROVED,
];

export function normalizeLeaveCode(value: string) {
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!code || code.length > 40) throw new LeaveError('INVALID_CODE', 'Leave code is invalid.');
  return code;
}

export function validateLeaveRange(from: string, to: string) {
  const start = parseAttendanceDate(from);
  const end = parseAttendanceDate(to);
  const span = start.until(end).days;
  if (span < 0) throw new LeaveError('INVALID_DATES', 'Leave end date must not precede its start date.');
  if (span > 731) throw new LeaveError('INVALID_DATES', 'A leave request cannot exceed 732 calendar days.');
  return { start, end, startDb: attendanceDateToDb(from), endDb: attendanceDateToDb(to) };
}

export function datesInclusive(start: Temporal.PlainDate, end: Temporal.PlainDate) {
  const values: string[] = [];
  for (let cursor = start; Temporal.PlainDate.compare(cursor, end) <= 0; cursor = cursor.add({ days: 1 })) {
    values.push(cursor.toString());
  }
  return values;
}

export function chargedUnits(mode: LeaveCountingMode, isScheduledWorkday: boolean) {
  return mode === LeaveCountingMode.CALENDAR_DAYS || isScheduledWorkday ? 1 : 0;
}

export function decimalNumber(value: { toString(): string } | number | null | undefined) {
  return value == null ? 0 : Number(value.toString());
}
