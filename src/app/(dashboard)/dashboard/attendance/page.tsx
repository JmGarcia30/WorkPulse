import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AttendanceStatus, EmploymentCategory } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import { canViewAttendance } from '@/lib/permissions/rbac';
import { attendanceDateForInstant, durationLabel } from '@/features/attendance/domain';
import { evaluateAttendanceFormAction } from '@/features/attendance/actions';
import { getAttendanceFilterOptions, getAttendancePeriod } from '@/features/attendance/queries';
import { prisma } from '@/lib/db/prisma';

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!canViewAttendance(user)) redirect('/dashboard');
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { timeZone: true } });
  const today = attendanceDateForInstant(new Date(), organization.timeZone);
  const params = await searchParams;
  const from = params.from ?? `${today.slice(0, 8)}01`;
  const to = params.to ?? today;
  const category = Object.values(EmploymentCategory).includes(params.category as EmploymentCategory) ? params.category as EmploymentCategory : undefined;
  const status = Object.values(AttendanceStatus).includes(params.status as AttendanceStatus) ? params.status as AttendanceStatus : undefined;
  const [rows, options] = await Promise.all([
    getAttendancePeriod(user.organizationId, { from, to, employeeId: params.employeeId, department: params.department, category, status }),
    getAttendanceFilterOptions(user.organizationId),
  ]);
  const time = (value: Date | null) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: organization.timeZone, hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(value) : '—';
  return <div className="space-y-6">
    <div className="flex items-end justify-between gap-3"><div><h1 className="text-xl font-bold">Attendance</h1><p className="text-xs text-slate-500">Tenant-local DTR projections · {organization.timeZone}</p></div><Link href="/dashboard/attendance/schedules" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Schedules</Link></div>
    {params.evaluationError === 'failed' && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Attendance evaluation could not be completed. Please try again; if the problem continues, contact your administrator.</p>}
    <form className="grid gap-2 rounded-3xl border bg-white p-5 md:grid-cols-6">
      <input type="date" name="from" defaultValue={from} className="rounded-xl border px-3 py-2 text-xs" /><input type="date" name="to" defaultValue={to} className="rounded-xl border px-3 py-2 text-xs" />
      <select name="employeeId" defaultValue={params.employeeId ?? ''} className="rounded-xl border px-3 py-2 text-xs"><option value="">All employees</option>{options.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} — {employee.firstName} {employee.lastName}</option>)}</select>
      <select name="department" defaultValue={params.department ?? ''} className="rounded-xl border px-3 py-2 text-xs"><option value="">All departments</option>{options.departments.map((department) => <option key={department}>{department}</option>)}</select>
      <select name="category" defaultValue={category ?? ''} className="rounded-xl border px-3 py-2 text-xs"><option value="">All categories</option>{Object.values(EmploymentCategory).map((value) => <option key={value}>{value}</option>)}</select>
      <select name="status" defaultValue={status ?? ''} className="rounded-xl border px-3 py-2 text-xs"><option value="">All statuses</option>{Object.values(AttendanceStatus).map((value) => <option key={value}>{value}</option>)}</select>
      <button className="rounded-xl border px-4 py-2 text-xs font-bold">Filter projections</button>
      <button formAction={evaluateAttendanceFormAction} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">Evaluate / refresh period</button>
    </form>
    <div className="overflow-x-auto rounded-3xl border bg-white"><table className="w-full text-left text-xs"><thead className="border-b bg-slate-50"><tr>{['Date','Employee','Schedule','In','Out','Worked','Late','Undertime','Overtime','Status'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id}><td className="px-4 py-3">{row.attendanceDate}</td><td className="px-4 py-3"><Link className="font-bold hover:underline" href={`/dashboard/attendance/${row.employee.id}?from=${from}&to=${to}`}>{row.employee.firstName} {row.employee.lastName}</Link><p className="text-slate-500">{row.employee.employeeNumber}</p></td><td className="px-4 py-3">{row.scheduleName ? `${row.scheduleName} v${row.scheduleVersion}` : '—'}</td><td className="px-4 py-3">{time(row.firstTimeIn)}</td><td className="px-4 py-3">{time(row.lastTimeOut)}</td><td className="px-4 py-3">{durationLabel(row.workedSeconds)}</td><td className="px-4 py-3">{durationLabel(row.lateSeconds)}</td><td className="px-4 py-3">{durationLabel(row.undertimeSeconds)}</td><td className="px-4 py-3">{durationLabel(row.overtimeSeconds)}</td><td className="px-4 py-3 font-bold">{row.status}{row.corrected ? ' · Corrected' : ''}{row.hasAnomaly ? ' · Review' : ''}</td></tr>)}{rows.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No materialized attendance records. Use Evaluate / refresh period.</td></tr>}</tbody></table></div>
  </div>;
}
