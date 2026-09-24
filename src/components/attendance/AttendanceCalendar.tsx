import { AttendanceDisposition, AttendanceStatus } from '@prisma/client';
import styles from './AttendanceCalendar.module.css';

export type AttendanceFilter = 'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'REST_DAY' | 'NO_SCHEDULE' | 'OPEN';
export type AttendanceVisualState = Exclude<AttendanceFilter, 'ALL'> | 'INCOMPLETE' | 'UPCOMING' | 'NO_RECORD';

export interface CalendarAttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  disposition: AttendanceDisposition;
  lateSeconds: number | null;
  firstTimeIn: Date | null;
  lastTimeOut: Date | null;
  timeZone: string;
  leaveTypeName?: string | null;
  corrected?: boolean;
}

export const attendanceFilterOptions: { value: AttendanceFilter; label: string }[] = [
  { value: 'ALL', label: 'All statuses' }, { value: 'PRESENT', label: 'Present' }, { value: 'LATE', label: 'Late' },
  { value: 'ABSENT', label: 'Absent' }, { value: 'LEAVE', label: 'Leave' }, { value: 'REST_DAY', label: 'Rest Day' },
  { value: 'NO_SCHEDULE', label: 'No Schedule' }, { value: 'OPEN', label: 'Open' },
];

export function visualStateFor(record: CalendarAttendanceRecord | undefined, date: string, today: string): AttendanceVisualState {
  if (!record) return date > today ? 'UPCOMING' : 'NO_RECORD';
  if (record.disposition === AttendanceDisposition.APPROVED_LEAVE) return 'LEAVE';
  if ((record.lateSeconds ?? 0) > 0) return 'LATE';
  return record.status;
}

export function matchesAttendanceFilter(record: CalendarAttendanceRecord, filter: AttendanceFilter) {
  return filter === 'ALL' || visualStateFor(record, record.date, record.date) === filter;
}

const labels: Record<AttendanceVisualState, string> = {
  PRESENT: 'Present', LATE: 'Late', ABSENT: 'Absent', LEAVE: 'Leave', REST_DAY: 'Rest Day', NO_SCHEDULE: 'No Schedule',
  OPEN: 'Open', INCOMPLETE: 'Incomplete', UPCOMING: 'Upcoming', NO_RECORD: 'No record',
};
const stateClass = (state: AttendanceVisualState) => styles[state.toLowerCase().replace('_', '')];
const time = (value: Date | null, zone: string) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(value) : '—';

export function AttendanceStatusBadge({ state }: { state: AttendanceVisualState }) {
  return <span className={`${styles.badge} ${stateClass(state)}`}>{labels[state]}</span>;
}

export function AttendanceLegend() {
  const states: AttendanceVisualState[] = ['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'REST_DAY', 'UPCOMING'];
  return <ul className={styles.legend} aria-label="Attendance status legend">{states.map((state) => <li key={state}><i className={stateClass(state)} />{labels[state]}</li>)}</ul>;
}

export function AttendanceCalendar({ month, monthLabel, today, records, activeFilter = 'ALL' }: { month: string; monthLabel: string; today: string; records: CalendarAttendanceRecord[]; activeFilter?: AttendanceFilter }) {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const firstDate = `${month}-01`;
  const leadingDays = (new Date(`${firstDate}T00:00:00Z`).getUTCDay() + 6) % 7;
  const byDate = new Map(records.map((record) => [record.date, record]));
  return <div className={styles.scroll}><div className={styles.calendar} role="grid" aria-label={`${monthLabel} attendance calendar`}>
    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div className={styles.weekday} role="columnheader" key={day}>{day}</div>)}
    {Array.from({ length: leadingDays }, (_, index) => <div key={`empty-${index}`} className={styles.emptyCell} aria-hidden="true" />)}
    {Array.from({ length: daysInMonth }, (_, index) => { const date = `${month}-${String(index + 1).padStart(2, '0')}`; const record = byDate.get(date); const state = visualStateFor(record, date, today); const muted = activeFilter !== 'ALL' && (!record || !matchesAttendanceFilter(record, activeFilter)); return <article key={date} role="gridcell" aria-label={`${date}: ${labels[state]}`} className={`${styles.dayCell} ${stateClass(state)} ${muted ? styles.muted : ''}`}><div className={styles.dayTop}><time dateTime={date}>{index + 1}</time><AttendanceStatusBadge state={state} /></div>{record && state !== 'REST_DAY' && state !== 'UPCOMING' && <div className={styles.cellTimes}><span>{time(record.firstTimeIn, record.timeZone)}</span><b aria-hidden="true">→</b><span>{time(record.lastTimeOut, record.timeZone)}</span></div>}{record?.leaveTypeName && <small>{record.leaveTypeName}</small>}{record?.corrected && <small>Corrected record</small>}</article>; })}
  </div></div>;
}
