import { attendanceDateForInstant, durationLabel } from '@/features/attendance/domain';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { getMyAttendance } from '@/features/employee-self-service/queries';

const time = (value: Date | null, zone: string) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(value) : '—';

export default async function MyAttendancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const context = await requireEmployeeSelfContext();
  const today = attendanceDateForInstant(new Date(), context.organization.timeZone);
  const params = await searchParams;
  const from = params.from ?? `${today.slice(0, 8)}01`;
  const to = params.to ?? today;
  let rows: Awaited<ReturnType<typeof getMyAttendance>>;
  let error: string | null = null;
  try { rows = await getMyAttendance({ from, to }); } catch { rows = []; error = 'Choose a valid attendance range of no more than 93 days.'; }
  return <div className="space-y-6"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Self-Service</p><h1 className="text-2xl font-black">My Attendance</h1><p className="text-sm text-slate-500">Read-only daily time records · {context.organization.timeZone}</p></div>
    <form className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4 text-sm"><label>From <input className="ml-2 rounded-lg border p-2" type="date" name="from" defaultValue={from} /></label><label>To <input className="ml-2 rounded-lg border p-2" type="date" name="to" defaultValue={to} /></label><button className="rounded-lg bg-slate-900 px-4 text-white">View</button></form>{error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="overflow-x-auto rounded-3xl border bg-white"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b bg-slate-50"><tr>{['Date','Schedule','Expected','Time In','Time Out','Worked','Late','Undertime','Detected overtime','Status'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id}><td className="px-4 py-3 font-bold">{row.date}{row.corrected && <span className="ml-2 rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-800">Corrected</span>}</td><td className="px-4">{row.scheduleName ?? '—'}</td><td className="px-4">{time(row.scheduledStartAt, row.timeZone)}–{time(row.scheduledEndAt, row.timeZone)}</td><td className="px-4">{time(row.firstTimeIn, row.timeZone)}</td><td className="px-4">{time(row.lastTimeOut, row.timeZone)}</td><td className="px-4">{durationLabel(row.workedSeconds)}</td><td className="px-4">{durationLabel(row.lateSeconds)}</td><td className="px-4">{durationLabel(row.undertimeSeconds)}</td><td className="px-4">{durationLabel(row.overtimeSeconds)}</td><td className="px-4 font-bold">{row.status}</td></tr>)}{rows.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No DTR records are available for this range.</td></tr>}</tbody></table></div>
  </div>;
}
