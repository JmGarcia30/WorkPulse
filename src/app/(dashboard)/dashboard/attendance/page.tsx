import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmploymentCategory } from '@prisma/client';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from 'lucide-react';
import { AttendanceCorrectionForm } from '@/components/attendance/AttendanceForms';
import {
  AttendanceCalendar,
  AttendanceFilter,
  AttendanceLegend,
  AttendanceStatusBadge,
  attendanceFilterOptions,
  matchesAttendanceFilter,
  visualStateFor,
} from '@/components/attendance/AttendanceCalendar';
import { evaluateAttendanceFormAction } from '@/features/attendance/actions';
import { attendanceDateForInstant, durationLabel } from '@/features/attendance/domain';
import { getAttendanceFilterOptions, getEmployeeAttendanceDetail } from '@/features/attendance/queries';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canCorrectAttendance, canViewAttendance } from '@/lib/permissions/rbac';
import { formatStatusLabel } from '@/lib/ui/format-status';

type Params = { employeeId?: string; month?: string; status?: string; department?: string; category?: string; day?: string; evaluationError?: string };

const validMonth = (value: string | undefined) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? '');
const validFilter = (value: string | undefined): value is AttendanceFilter => attendanceFilterOptions.some((option) => option.value === value);
const shiftMonth = (month: string, amount: number) => {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, index - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!canViewAttendance(user)) redirect('/dashboard');

  const [organization, options] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { timeZone: true } }),
    getAttendanceFilterOptions(user.organizationId),
  ]);
  const today = attendanceDateForInstant(new Date(), organization.timeZone);
  const params = await searchParams;
  const month = validMonth(params.month) ? params.month! : today.slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${from}T00:00:00Z`));
  const status = validFilter(params.status) ? params.status : 'ALL';
  const category = Object.values(EmploymentCategory).includes(params.category as EmploymentCategory) ? params.category as EmploymentCategory : undefined;
  const filteredEmployees = options.employees.filter((employee) => {
    const employment = employee.employmentRecords[0];
    return (!params.department || employment?.department === params.department) && (!category || employment?.employmentCategory === category);
  });
  const employeeId = options.employees.some((employee) => employee.id === params.employeeId) ? params.employeeId : undefined;
  const detail = employeeId ? await getEmployeeAttendanceDetail(user.organizationId, employeeId, from, to) : null;
  const calendarRecords = detail?.records.map((record) => ({
    id: record.id,
    date: record.attendanceDate.toISOString().slice(0, 10),
    status: record.attendanceStatus,
    disposition: record.disposition,
    lateSeconds: record.lateSeconds,
    firstTimeIn: record.firstTimeIn,
    lastTimeOut: record.lastTimeOut,
    timeZone: detail.timeZone,
    leaveTypeName: record.leaveTypeNameSnapshot,
    corrected: record.correctionVersion > 0,
  })) ?? [];
  const selectedDay = params.day?.startsWith(`${month}-`) ? params.day : (month === today.slice(0, 7) ? today : from);
  const selectedRecord = detail?.records.find((record) => record.attendanceDate.toISOString().slice(0, 10) === selectedDay);
  const selectedEvents = detail?.events.filter((event) => attendanceDateForInstant(event.occurredAt, detail.timeZone) === selectedDay) ?? [];
  const logs = calendarRecords.filter((record) => status === 'ALL' || matchesAttendanceFilter(record, status));
  const time = (value: Date | null) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: organization.timeZone, hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(value) : '—';
  const baseQuery = new URLSearchParams({ month, status, ...(employeeId ? { employeeId } : {}), ...(params.department ? { department: params.department } : {}), ...(category ? { category } : {}) });
  const previousQuery = new URLSearchParams(baseQuery); previousQuery.set('month', shiftMonth(month, -1)); previousQuery.delete('day');
  const nextQuery = new URLSearchParams(baseQuery); nextQuery.set('month', shiftMonth(month, 1)); nextQuery.delete('day');

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="wp-eyebrow">Attendance</p><h1 className="wp-page-title mt-1">Monthly Attendance</h1><p className="mt-2 text-sm text-[var(--wp-text-muted)]">Select an employee, review their month, then choose a day for complete details. Times use {organization.timeZone}.</p></div>
      <div className="flex items-center rounded-xl border border-[var(--tenant-border)] bg-white p-1 shadow-sm" aria-label="Calendar month navigation"><Link className="grid size-10 place-items-center rounded-lg text-[var(--tenant-primary)] hover:bg-[var(--tenant-tint-strong)]" href={`?${previousQuery}`} aria-label="Previous month"><ArrowLeft className="size-4" /></Link><div className="min-w-44 px-4 text-center"><span className="block text-[10px] font-bold uppercase tracking-widest text-[var(--wp-text-muted)]">Attendance period</span><strong className="text-sm">{monthLabel}</strong></div><Link className="grid size-10 place-items-center rounded-lg text-[var(--tenant-primary)] hover:bg-[var(--tenant-tint-strong)]" href={`?${nextQuery}`} aria-label="Next month"><ArrowRight className="size-4" /></Link></div>
    </header>

    {params.evaluationError === 'failed' && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Attendance records could not be refreshed. Please try again.</p>}

    <form className="wp-filter-bar md:grid-cols-2 xl:grid-cols-6" aria-label="Attendance filters">
      <label className="wp-label">Month<input type="month" name="month" defaultValue={month} className="wp-input mt-1" /></label>
      <label className="wp-label xl:col-span-2">Employee<select name="employeeId" defaultValue={employeeId ?? ''} className="wp-input mt-1"><option value="">Select an employee</option>{filteredEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} — {employee.firstName} {employee.lastName}</option>)}</select></label>
      <label className="wp-label">Department<select name="department" defaultValue={params.department ?? ''} className="wp-input mt-1"><option value="">All departments</option>{options.departments.map((department) => <option key={department}>{department}</option>)}</select></label>
      <label className="wp-label">Employee group<select name="category" defaultValue={category ?? ''} className="wp-input mt-1"><option value="">All groups</option>{Object.values(EmploymentCategory).map((value) => <option key={value} value={value}>{formatStatusLabel(value)}</option>)}</select></label>
      <label className="wp-label">Attendance status<select name="status" defaultValue={status} className="wp-input mt-1">{attendanceFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6"><button className="wp-button-primary">View Attendance</button><Link href="/dashboard/attendance" className="wp-button-secondary">Reset</Link><Link href="/dashboard/attendance/schedules" className="wp-button-secondary ml-auto">Work Schedules</Link></div>
    </form>

    {!detail ? <section className="wp-card grid min-h-80 place-items-center p-8 text-center"><div><CalendarDays className="mx-auto mb-4 size-8 text-[var(--tenant-accent)]" aria-hidden="true" /><h2 className="text-lg font-bold">Select an employee to view attendance</h2><p className="mt-2 max-w-md text-sm text-[var(--wp-text-muted)]">Their monthly calendar, daily details, corrections, and timekeeping logs will appear here.</p></div></section> : <>
      <section className="overflow-hidden rounded-2xl border border-[var(--tenant-border)] bg-white shadow-sm" aria-labelledby="calendar-heading"><div className="flex flex-col gap-3 border-b border-[var(--tenant-border)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 id="calendar-heading" className="font-bold">{detail.employee.firstName} {detail.employee.lastName} · {monthLabel}</h2><p className="text-xs text-[var(--wp-text-muted)]">{detail.employee.employeeNumber} · Select any date to view its details</p></div><AttendanceLegend /></div><AttendanceCalendar month={month} monthLabel={monthLabel} today={today} records={calendarRecords} activeFilter={status} selectedDate={selectedDay} dayHref={(date) => { const query = new URLSearchParams(baseQuery); query.set('day', date); return `?${query}`; }} /></section>

      <section id="day-details" className="wp-card p-5" aria-labelledby="day-details-heading"><div className="flex flex-col gap-3 border-b border-[var(--tenant-border)] pb-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="wp-eyebrow">Selected day</p><h2 id="day-details-heading" className="mt-1 text-lg font-bold">{new Intl.DateTimeFormat('en-PH', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${selectedDay}T00:00:00Z`))}</h2></div>{selectedRecord && <AttendanceStatusBadge state={visualStateFor(calendarRecords.find((record) => record.date === selectedDay), selectedDay, today)} />}</div>
        {!selectedRecord ? <p className="wp-empty">No evaluated attendance record is available for this date.</p> : <div className="mt-5 space-y-5"><dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><div><dt className="wp-label">Time in</dt><dd className="mt-1 font-semibold">{time(selectedRecord.firstTimeIn)}</dd></div><div><dt className="wp-label">Time out</dt><dd className="mt-1 font-semibold">{time(selectedRecord.lastTimeOut)}</dd></div><div><dt className="wp-label">Total hours</dt><dd className="mt-1 font-semibold">{durationLabel(selectedRecord.workedSeconds)}</dd></div><div><dt className="wp-label">Late</dt><dd className="mt-1 font-semibold">{durationLabel(selectedRecord.lateSeconds)}</dd></div><div><dt className="wp-label">Undertime</dt><dd className="mt-1 font-semibold">{durationLabel(selectedRecord.undertimeSeconds)}</dd></div></dl>
          {canCorrectAttendance(user) && <AttendanceCorrectionForm record={{ id: selectedRecord.id, attendanceDate: selectedDay, correctionVersion: selectedRecord.correctionVersion }} />}
          <div><h3 className="text-sm font-bold">Corrections</h3>{selectedRecord.corrections.length === 0 ? <p className="mt-2 text-sm text-[var(--wp-text-muted)]">No corrections recorded.</p> : selectedRecord.corrections.map((correction) => <p key={correction.id} className="mt-2 text-sm text-[var(--wp-text-muted)]">Revision {correction.revision} by {correction.createdBy.name}: {correction.reason}</p>)}</div>
          <div><h3 className="text-sm font-bold">Attendance events</h3>{selectedEvents.length === 0 ? <p className="mt-2 text-sm text-[var(--wp-text-muted)]">No attendance events recorded.</p> : <ul className="mt-2 divide-y divide-[var(--tenant-border)]">{selectedEvents.map((event) => <li key={event.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{time(event.occurredAt)} · {formatStatusLabel(event.direction ?? 'UNCLASSIFIED')}</span><span className="text-[var(--wp-text-muted)]">{formatStatusLabel(event.source)}</span></li>)}</ul>}</div>
        </div>}
      </section>

      <section className="wp-table-wrap" aria-labelledby="logs-heading"><div className="flex flex-col gap-3 border-b border-[var(--tenant-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Clock3 className="size-5 text-[var(--tenant-accent)]" aria-hidden="true" /><div><h2 id="logs-heading" className="font-bold">Detailed attendance logs</h2><p className="text-xs text-[var(--wp-text-muted)]">Secondary record list for {monthLabel}</p></div></div><form action={evaluateAttendanceFormAction}><input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} /><input type="hidden" name="employeeId" value={employeeId} /><button className="wp-button-secondary">Refresh Records</button></form></div><table className="wp-table"><thead><tr>{['Date', 'Schedule', 'Time In', 'Time Out', 'Hours', 'Late', 'Undertime', 'Status'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{logs.map((row) => { const source = detail.records.find((record) => record.id === row.id); const query = new URLSearchParams(baseQuery); query.set('day', row.date); return <tr key={row.id}><td><Link className="font-bold text-[var(--tenant-primary)] hover:underline" href={`?${query}`}>{row.date}</Link></td><td>{source?.scheduleAssignment?.scheduleVersion.displayName ?? '—'}</td><td>{time(row.firstTimeIn)}</td><td>{time(row.lastTimeOut)}</td><td>{durationLabel(source?.workedSeconds ?? null)}</td><td>{durationLabel(row.lateSeconds)}</td><td>{durationLabel(source?.undertimeSeconds ?? null)}</td><td><AttendanceStatusBadge state={visualStateFor(row, row.date, today)} />{row.corrected && <span className="ml-2 text-xs text-[var(--wp-text-muted)]">Corrected</span>}</td></tr>; })}{logs.length === 0 && <tr><td colSpan={8} className="wp-empty">No attendance records match the selected status.</td></tr>}</tbody></table></section>
    </>}
  </div>;
}
