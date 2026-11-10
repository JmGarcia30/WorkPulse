import { attendanceDateForInstant, parseAttendanceDate } from '@/features/attendance/domain';

/**
 * Closing dates are inclusive calendar days in the organization's configured
 * IANA time zone. DateTime storage uses UTC midnight as a date-only sentinel.
 */
export function jobClosingDateString(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function isJobDeadlinePassed(
  closingDate: Date | null,
  organizationTimeZone: string,
  now: Date = new Date(),
): boolean {
  const lastDay = jobClosingDateString(closingDate);
  if (!lastDay) return false;
  return lastDay < attendanceDateForInstant(now, organizationTimeZone);
}

export function daysUntilJobDeadline(
  closingDate: Date | null,
  organizationTimeZone: string,
  now: Date = new Date(),
): number | null {
  const lastDay = jobClosingDateString(closingDate);
  if (!lastDay) return null;
  const today = attendanceDateForInstant(now, organizationTimeZone);
  return parseAttendanceDate(today).until(parseAttendanceDate(lastDay), { largestUnit: 'days' }).days;
}

export function validateJobClosingDate(input: unknown, timeZone: string, now: Date = new Date()) {
  if (input === '' || input == null) return null;
  if (typeof input !== 'string') throw new Error('Select a valid closing date.');
  const date = parseAttendanceDate(input).toString();
  if (date < attendanceDateForInstant(now, timeZone)) {
    throw new Error('Closing date cannot be in the past for your organization.');
  }
  return new Date(date + 'T00:00:00.000Z');
}
