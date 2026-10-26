import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, RotateCcw } from 'lucide-react';
import { attendanceDateForInstant, durationLabel } from '@/features/attendance/domain';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { getMyAttendance, getMyProfile } from '@/features/employee-self-service/queries';
import {
  AttendanceCalendar,
  AttendanceFilter,
  AttendanceLegend,
  AttendanceStatusBadge,
  attendanceFilterOptions,
  matchesAttendanceFilter,
  visualStateFor,
} from '@/components/attendance/AttendanceCalendar';

type Params = {
  month?: string;
  status?: string;
  schedule?: string;
  logStatus?: string;
  logFrom?: string;
  logTo?: string;
};

const validMonth = (value: string | undefined) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? '');
const validFilter = (value: string | undefined): value is AttendanceFilter =>
  attendanceFilterOptions.some((option) => option.value === value);

const shiftMonth = (month: string, amount: number) => {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, index - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const formatClockTime = (value: Date | null, zone: string) =>
  value
    ? new Intl.DateTimeFormat('en-PH', {
        timeZone: zone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(value)
    : '—';

export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const context = await requireEmployeeSelfContext();
  const today = attendanceDateForInstant(new Date(), context.organization.timeZone);
  const params = await searchParams;
  const month = validMonth(params.month) ? params.month! : today.slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const monthLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${from}T00:00:00Z`));

  const [rows, profile] = await Promise.all([
    getMyAttendance({ from, to }),
    getMyProfile(),
  ]);

  const status = validFilter(params.status) ? params.status : 'ALL';
  const logStatus = validFilter(params.logStatus) ? params.logStatus : 'ALL';
  const schedules = [
    ...new Set(
      rows
        .map((row) => row.scheduleName)
        .filter((value): value is string => Boolean(value))
    ),
  ].sort();
  const schedule = schedules.includes(params.schedule ?? '') ? params.schedule! : 'ALL';
  const logFrom =
    params.logFrom && params.logFrom >= from && params.logFrom <= to ? params.logFrom : from;
  const logTo = params.logTo && params.logTo >= logFrom && params.logTo <= to ? params.logTo : to;

  const logs = rows.filter(
    (row) =>
      row.date >= logFrom &&
      row.date <= logTo &&
      matchesAttendanceFilter(row, logStatus) &&
      (schedule === 'ALL' || row.scheduleName === schedule)
  );

  const hasCalendarFilter = status !== 'ALL' || schedule !== 'ALL';
  const hasLogFilter =
    logStatus !== 'ALL' || logFrom !== from || logTo !== to || schedule !== 'ALL';

  const employment = profile?.employee.employmentRecords[0];

  const calendarQuery = new URLSearchParams({
    month,
    status,
    ...(schedule !== 'ALL' ? { schedule } : {}),
  });
  const previousQuery = new URLSearchParams(calendarQuery);
  previousQuery.set('month', shiftMonth(month, -1));
  const nextQuery = new URLSearchParams(calendarQuery);
  nextQuery.set('month', shiftMonth(month, 1));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--tenant-accent)]">
            Employee Self-Service • Attendance
          </p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
            My Attendance
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
            <strong className="text-slate-800">
              {context.employee.firstName} {context.employee.lastName}
            </strong>
            <span>•</span>
            <span>{context.employee.employeeNumber}</span>
            {employment?.jobTitle && (
              <>
                <span>•</span>
                <span>{employment.jobTitle}</span>
              </>
            )}
            {employment?.department && (
              <>
                <span>•</span>
                <span>{employment.department}</span>
              </>
            )}
          </p>
        </div>

        {/* Month Navigation Control */}
        <div
          className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-2xs"
          aria-label="Calendar month navigation"
        >
          <Link
            href={`?${previousQuery}`}
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="px-4 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Period
            </span>
            <strong className="block text-sm font-bold text-slate-900">{monthLabel}</strong>
          </div>
          <Link
            href={`?${nextQuery}`}
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Calendar Filter Toolbar */}
      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs"
        aria-label="Calendar filters"
      >
        <div className="min-w-36 flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Month
          </label>
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:border-[var(--tenant-primary)] focus:outline-hidden"
          />
        </div>

        <div className="min-w-40 flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:border-[var(--tenant-primary)] focus:outline-hidden"
          >
            {attendanceFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {schedules.length > 0 && (
          <div className="min-w-40 flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Schedule
            </label>
            <select
              name="schedule"
              defaultValue={schedule}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:border-[var(--tenant-primary)] focus:outline-hidden"
            >
              <option value="ALL">All schedules</option>
              {schedules.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--tenant-primary)] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-2xs hover:brightness-95 transition"
          >
            Apply
          </button>
          {hasCalendarFilter && (
            <Link
              href={`?month=${month}`}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Link>
          )}
        </div>
      </form>

      {/* Monthly Calendar View */}
      <section
        className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden"
        aria-labelledby="calendar-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <h2 id="calendar-heading" className="text-sm sm:text-base font-bold text-slate-900">
                Monthly Overview
              </h2>
              <p className="text-xs text-slate-500">
                {status !== 'ALL'
                  ? 'Filtered status highlights'
                  : `${context.organization.timeZone} time`}
              </p>
            </div>
          </div>
          <AttendanceLegend />
        </div>

        <div className="overflow-x-auto">
          <AttendanceCalendar
            month={month}
            monthLabel={monthLabel}
            today={today}
            records={
              schedule === 'ALL'
                ? rows
                : rows.filter((row) => row.scheduleName === schedule)
            }
            activeFilter={status}
          />
        </div>
      </section>

      {/* Timekeeping Logs Table Section */}
      <section
        className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden"
        aria-labelledby="logs-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tenant-tint)] text-[var(--tenant-primary)]">
              <Clock3 className="h-4 w-4" />
            </span>
            <div>
              <h2 id="logs-heading" className="text-sm sm:text-base font-bold text-slate-900">
                Timekeeping Logs
              </h2>
              <p className="text-xs text-slate-500">Recorded shifts for {monthLabel}</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {logs.length === rows.length
              ? `${rows.length} records`
              : `${logs.length} of ${rows.length} records`}
          </span>
        </div>

        {/* Filter sub-toolbar for logs */}
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50/50 p-4">
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="status" value={status} />
          {schedule !== 'ALL' && <input type="hidden" name="schedule" value={schedule} />}

          <div className="min-w-36 flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              From
            </label>
            <input
              type="date"
              name="logFrom"
              min={from}
              max={to}
              defaultValue={logFrom}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm focus:border-[var(--tenant-primary)] focus:outline-hidden"
            />
          </div>

          <div className="min-w-36 flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              To
            </label>
            <input
              type="date"
              name="logTo"
              min={from}
              max={to}
              defaultValue={logTo}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm focus:border-[var(--tenant-primary)] focus:outline-hidden"
            />
          </div>

          <div className="min-w-40 flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Status
            </label>
            <select
              name="logStatus"
              defaultValue={logStatus}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm focus:border-[var(--tenant-primary)] focus:outline-hidden"
            >
              {attendanceFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--tenant-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:brightness-95 transition"
            >
              Filter logs
            </button>
            {hasLogFilter && (
              <Link
                href={`?${calendarQuery}`}
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Reset
              </Link>
            )}
          </div>
        </form>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Schedule</th>
                <th className="py-3 px-4">Clock In</th>
                <th className="py-3 px-4">Clock Out</th>
                <th className="py-3 px-4">Work Hours</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((row) => {
                const state = visualStateFor(row, row.date, today);
                return (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {new Intl.DateTimeFormat('en-PH', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(`${row.date}T00:00:00Z`))}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div className="font-semibold text-slate-800">{row.scheduleName ?? '—'}</div>
                      <div className="text-slate-400">
                        {formatClockTime(row.scheduledStartAt, row.timeZone)} –{' '}
                        {formatClockTime(row.scheduledEndAt, row.timeZone)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 font-medium whitespace-nowrap">
                      {formatClockTime(row.firstTimeIn, row.timeZone)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 font-medium whitespace-nowrap">
                      {formatClockTime(row.lastTimeOut, row.timeZone)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 font-semibold tabular-nums whitespace-nowrap">
                      {durationLabel(row.workedSeconds)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <AttendanceStatusBadge state={state} />
                        <div className="text-[11px] text-slate-400">
                          {(row.lateSeconds ?? 0) > 0
                            ? `${durationLabel(row.lateSeconds)} late`
                            : row.leaveTypeName ??
                              (row.corrected ? 'Corrected' : 'Standard')}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <p className="text-sm">No attendance records match the selected filters.</p>
                    <Link
                      href={`?${calendarQuery}`}
                      className="mt-2 inline-block text-xs font-semibold text-[var(--tenant-primary)] underline"
                    >
                      Reset filters
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
