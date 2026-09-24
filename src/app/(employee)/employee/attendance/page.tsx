import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from 'lucide-react';
import { attendanceDateForInstant, durationLabel } from '@/features/attendance/domain';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { getMyAttendance, getMyProfile } from '@/features/employee-self-service/queries';
import { AttendanceCalendar, AttendanceFilter, AttendanceLegend, AttendanceStatusBadge, attendanceFilterOptions, matchesAttendanceFilter, visualStateFor } from '@/components/attendance/AttendanceCalendar';
import styles from './attendance.module.css';

type Params = { month?: string; status?: string; schedule?: string; logStatus?: string; logFrom?: string; logTo?: string };
const validMonth = (value: string | undefined) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? '');
const validFilter = (value: string | undefined): value is AttendanceFilter => attendanceFilterOptions.some((option) => option.value === value);
const shiftMonth = (month: string, amount: number) => { const [year, index] = month.split('-').map(Number); const date = new Date(Date.UTC(year, index - 1 + amount, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`; };
const time = (value: Date | null, zone: string) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(value) : '—';

export default async function MyAttendancePage({ searchParams }: { searchParams: Promise<Params> }) {
  const context = await requireEmployeeSelfContext();
  const today = attendanceDateForInstant(new Date(), context.organization.timeZone);
  const params = await searchParams;
  const month = validMonth(params.month) ? params.month! : today.slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const from = `${month}-01`, to = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${from}T00:00:00Z`));
  const [rows, profile] = await Promise.all([getMyAttendance({ from, to }), getMyProfile()]);
  const status = validFilter(params.status) ? params.status : 'ALL';
  const logStatus = validFilter(params.logStatus) ? params.logStatus : 'ALL';
  const schedules = [...new Set(rows.map((row) => row.scheduleName).filter((value): value is string => Boolean(value)))].sort();
  const schedule = schedules.includes(params.schedule ?? '') ? params.schedule! : 'ALL';
  const logFrom = params.logFrom && params.logFrom >= from && params.logFrom <= to ? params.logFrom : from;
  const logTo = params.logTo && params.logTo >= logFrom && params.logTo <= to ? params.logTo : to;
  const logs = rows.filter((row) => row.date >= logFrom && row.date <= logTo && matchesAttendanceFilter(row, logStatus) && (schedule === 'ALL' || row.scheduleName === schedule));
  const hasCalendarFilter = status !== 'ALL' || schedule !== 'ALL';
  const hasLogFilter = logStatus !== 'ALL' || logFrom !== from || logTo !== to || schedule !== 'ALL';
  const employment = profile?.employee.employmentRecords[0];
  const calendarQuery = new URLSearchParams({ month, status, ...(schedule !== 'ALL' ? { schedule } : {}) });
  const previousQuery = new URLSearchParams(calendarQuery); previousQuery.set('month', shiftMonth(month, -1));
  const nextQuery = new URLSearchParams(calendarQuery); nextQuery.set('month', shiftMonth(month, 1));

  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Employee self-service · Attendance</p><h1>My Attendance</h1><p className={styles.employeeLine}><strong>{context.employee.firstName} {context.employee.lastName}</strong><span>{context.employee.employeeNumber}</span>{employment?.jobTitle && <span>{employment.jobTitle}</span>}{employment?.department && <span>{employment.department}</span>}</p></div><div className={styles.monthControl} aria-label="Calendar month navigation"><Link href={`?${previousQuery}`} aria-label="Previous month"><ArrowLeft /></Link><div><span>Attendance period</span><strong>{monthLabel}</strong></div><Link href={`?${nextQuery}`} aria-label="Next month"><ArrowRight /></Link></div></header>

    <form className={styles.filterBar} aria-label="Calendar filters"><label><span>Month</span><input type="month" name="month" defaultValue={month} /></label><label><span>Status</span><select name="status" defaultValue={status}>{attendanceFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{schedules.length > 0 && <label><span>Schedule</span><select name="schedule" defaultValue={schedule}><option value="ALL">All schedules</option>{schedules.map((name) => <option key={name}>{name}</option>)}</select></label>}<button className={styles.applyButton}>Apply</button>{hasCalendarFilter && <Link className={styles.resetLink} href={`?month=${month}`}>Reset</Link>}</form>

    <section className={styles.calendarCard} aria-labelledby="calendar-heading"><div className={styles.cardHeading}><div><CalendarDays aria-hidden="true" /><div><h2 id="calendar-heading">Monthly overview</h2><p>{status !== 'ALL' ? 'Matching days are emphasized' : `${context.organization.timeZone} time`}</p></div></div><AttendanceLegend /></div><AttendanceCalendar month={month} monthLabel={monthLabel} today={today} records={rows} activeFilter={status} /></section>

    <section className={styles.logsCard} aria-labelledby="logs-heading"><div className={styles.logsHeading}><div><Clock3 aria-hidden="true" /><div><h2 id="logs-heading">Timekeeping Logs</h2><p>Recorded entries for {monthLabel}</p></div></div><span>{logs.length === rows.length ? `${rows.length} records` : `${logs.length} of ${rows.length} records`}</span></div>
      <form className={styles.logToolbar}><input type="hidden" name="month" value={month} /><input type="hidden" name="status" value={status} />{schedule !== 'ALL' && <input type="hidden" name="schedule" value={schedule} />}<label><span>From</span><input type="date" name="logFrom" min={from} max={to} defaultValue={logFrom} /></label><label><span>To</span><input type="date" name="logTo" min={from} max={to} defaultValue={logTo} /></label><label><span>Status</span><select name="logStatus" defaultValue={logStatus}>{attendanceFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button className={styles.applyButton}>Filter logs</button>{hasLogFilter && <Link className={styles.resetLink} href={`?${calendarQuery}`}>Reset logs</Link>}</form>
      <div className={styles.tableScroll}><table><thead><tr><th>Date</th><th>Schedule</th><th>Clock In</th><th>Clock Out</th><th>Work Hours</th><th>Status</th></tr></thead><tbody>{logs.map((row) => { const state = visualStateFor(row, row.date, today); return <tr key={row.id}><td><strong>{new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${row.date}T00:00:00Z`))}</strong></td><td>{row.scheduleName ?? '—'}</td><td>{time(row.firstTimeIn, row.timeZone)}</td><td>{time(row.lastTimeOut, row.timeZone)}</td><td>{durationLabel(row.workedSeconds)}</td><td><AttendanceStatusBadge state={state} /><small>{(row.lateSeconds ?? 0) > 0 ? `${durationLabel(row.lateSeconds)} late` : row.leaveTypeName ?? (row.corrected ? 'Corrected record' : 'Daily record')}</small></td></tr>; })}{logs.length === 0 && <tr><td colSpan={6} className={styles.emptyState}><p>No attendance records match the selected filters.</p><Link className={styles.resetLink} href={`?${calendarQuery}`}>Reset filters</Link></td></tr>}</tbody></table></div>
    </section>
  </div>;
}
