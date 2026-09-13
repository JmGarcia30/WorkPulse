import Link from 'next/link';
import { getMyDashboard } from '@/features/employee-self-service/queries';

const time = (value: Date | null | undefined, zone: string) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(value) : '—';

export default async function EmployeeDashboardPage() {
  const data = await getMyDashboard();
  const employment = data.profile?.employee.employmentRecords[0];
  const schedule = data.profile?.schedule;
  const weekday = new Date(`${data.today}T00:00:00Z`).getUTCDay() || 7;
  const todayRule = schedule?.days.find((day) => day.isoWeekday === weekday);
  const second = (value: number | null | undefined) => value == null ? '—' : `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(Math.floor((value % 3600) / 60)).padStart(2, '0')}`;
  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">My Dashboard</p><h1 className="text-2xl font-black">Welcome, {data.profile?.employee.firstName}</h1></div>
    <section className="grid gap-4 md:grid-cols-2">
      <article className="rounded-3xl border bg-white p-6"><h2 className="font-bold">Employment</h2><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">Employee number</dt><dd className="font-bold">{data.profile?.employee.employeeNumber}</dd></div><div><dt className="text-slate-500">Status</dt><dd className="font-bold">{data.profile?.employee.employeeStatus}</dd></div><div><dt className="text-slate-500">Position</dt><dd className="font-bold">{employment?.jobTitle ?? '—'}</dd></div><div><dt className="text-slate-500">Department</dt><dd className="font-bold">{employment?.department ?? '—'}</dd></div><div><dt className="text-slate-500">Category</dt><dd className="font-bold">{employment?.employmentCategory ?? '—'}</dd></div><div><dt className="text-slate-500">Classification</dt><dd className="font-bold">{employment?.employmentStatus ?? '—'}</dd></div></dl></article>
      <article className="rounded-3xl border bg-white p-6"><h2 className="font-bold">Today · {data.today}</h2><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">Schedule</dt><dd className="font-bold">{schedule?.name ?? 'No schedule'}</dd></div><div><dt className="text-slate-500">Expected</dt><dd className="font-bold">{todayRule?.isWorkday ? `${second(todayRule.expectedStartSecond)}–${second(todayRule.expectedEndSecond)}` : 'Rest day'}</dd></div><div><dt className="text-slate-500">Attendance</dt><dd className="font-bold">{data.attendance?.attendanceStatus ?? 'Attendance not yet available'}</dd></div><div><dt className="text-slate-500">Time In / Out</dt><dd className="font-bold">{time(data.attendance?.firstTimeIn, data.attendance?.timeZoneSnapshot ?? data.profile?.organization.timeZone ?? 'UTC')} / {time(data.attendance?.lastTimeOut, data.attendance?.timeZoneSnapshot ?? data.profile?.organization.timeZone ?? 'UTC')}</dd></div></dl></article>
    </section>
    <section className="grid gap-3 sm:grid-cols-3"><Link href="/employee/profile" className="rounded-2xl bg-slate-900 p-5 font-bold text-white">My Profile</Link><Link href="/employee/attendance" className="rounded-2xl bg-slate-900 p-5 font-bold text-white">My Attendance</Link><div className="rounded-2xl border bg-white p-5 font-bold text-slate-400">Leave · Coming Soon</div></section>
  </div>;
}
