import { EmploymentCategory } from '@prisma/client';
import { attendanceDateForInstant, instantForLocalSecond, parseAttendanceDate } from '@/features/attendance/domain';

export type AnalyticsFilters = { preset?: string; from?: string; to?: string; category?: string };

export class AnalyticsFilterError extends Error {}

export function resolveAnalyticsRange(filters: AnalyticsFilters, timeZone: string, asOf = new Date()) {
  const today = parseAttendanceDate(attendanceDateForInstant(asOf, timeZone));
  const preset = filters.preset ?? (filters.from || filters.to ? 'custom' : 'this-month');
  if (!['this-month', 'last-month', 'custom'].includes(preset)) throw new AnalyticsFilterError('Choose This Month, Last Month, or Custom Range.');
  const category = filters.category && filters.category !== 'ALL' ? filters.category : undefined;
  if (category && !Object.values(EmploymentCategory).includes(category as EmploymentCategory)) throw new AnalyticsFilterError('Choose a valid employee type.');
  let from: string;
  let to: string;
  if (preset === 'custom') {
    from = filters.from ?? '';
    to = filters.to ?? '';
  } else {
    const month = (preset === 'last-month' ? today.subtract({ months: 1 }) : today).with({ day: 1 });
    from = month.toString();
    to = month.with({ day: month.daysInMonth }).toString();
  }
  try {
    const start = parseAttendanceDate(from);
    const end = parseAttendanceDate(to);
    const days = start.until(end).days;
    if (start.year < 1 || end.year < 1 || days < 0 || days > 365) throw new Error();
  } catch { throw new AnalyticsFilterError('Choose valid dates in order, covering no more than 366 days.'); }
  return {
    preset, from, to, category: category as EmploymentCategory | undefined,
    fromDate: new Date(`${from}T00:00:00Z`), toDate: new Date(`${to}T00:00:00Z`),
    fromInstant: instantForLocalSecond(from, 0, timeZone),
    throughInstant: instantForLocalSecond(to, 86_400, timeZone),
  };
}
