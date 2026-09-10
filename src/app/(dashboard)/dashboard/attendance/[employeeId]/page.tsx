import { notFound, redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { getSession } from '@/lib/auth/session';
import { canCorrectAttendance, canRecordAttendance, canViewAttendance } from '@/lib/permissions/rbac';
import { attendanceDateForInstant, durationLabel } from '@/features/attendance/domain';
import { getEmployeeAttendanceDetail } from '@/features/attendance/queries';
import { prisma } from '@/lib/db/prisma';
import { AttendanceCorrectionForm, ManualAttendanceEventForm } from '@/components/attendance/AttendanceForms';
import { evaluateAttendanceFormAction } from '@/features/attendance/actions';

export default async function EmployeeAttendancePage({ params, searchParams }: { params: Promise<{ employeeId: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!canViewAttendance(user)) redirect('/dashboard');
  const { employeeId } = await params;
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { timeZone: true } });
  const today = attendanceDateForInstant(new Date(), organization.timeZone);
  const query = await searchParams;
  const from = query.from ?? `${today.slice(0, 8)}01`;
  const to = query.to ?? today;
  const detail = await getEmployeeAttendanceDetail(user.organizationId, employeeId, from, to);
  if (!detail) notFound();
  const time = (value: Date | null) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: detail.timeZone, dateStyle: 'medium', timeStyle: 'medium' }).format(value) : '—';
  return <div className="space-y-6"><div className="flex items-end justify-between gap-3"><div><h1 className="text-xl font-bold">{detail.employee.firstName} {detail.employee.lastName}</h1><p className="text-xs text-slate-500">DTR history · {detail.employee.employeeNumber} · {detail.timeZone}</p></div><form action={evaluateAttendanceFormAction}><input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} /><input type="hidden" name="employeeId" value={employeeId} /><button className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">Evaluate / refresh period</button></form></div>
    <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4 text-xs"><p className="text-slate-500">Tardiness this period</p><p className="text-2xl font-black">{detail.indicators.tardinessCount}</p>{detail.indicators.habitualTardinessReview && <p className="text-amber-700">HR review indicator: 4+ instances</p>}</div><div className="rounded-2xl border bg-white p-4 text-xs"><p className="text-slate-500">Absence days</p><p className="text-2xl font-black">{detail.indicators.absenceDays}</p>{detail.indicators.absenceFrequencyReview && <p className="text-amber-700">HR review indicator: 3+ days; authorization not determined</p>}</div><div className="rounded-2xl border bg-white p-4 text-xs"><p className="text-slate-500">Longest scheduled-day absence streak</p><p className="text-2xl font-black">{detail.indicators.longestConsecutiveAbsenceDays}</p>{detail.indicators.possibleAwolPatternReview && <p className="text-amber-700">Possible AWOL pattern — HR review required</p>}</div></section>
    {canRecordAttendance(user) && <ManualAttendanceEventForm employeeId={employeeId} submissionToken={randomUUID()} />}
    <section className="space-y-3">{detail.records.map((record) => <article key={record.id} className="rounded-2xl border bg-white p-4 text-xs"><div className="grid gap-2 sm:grid-cols-6"><strong>{record.attendanceDate.toISOString().slice(0,10)}</strong><span>{record.attendanceStatus}</span><span>In {time(record.firstTimeIn)}</span><span>Out {time(record.lastTimeOut)}</span><span>Worked {durationLabel(record.workedSeconds)}</span><span>Late {durationLabel(record.lateSeconds)}</span></div>{canCorrectAttendance(user) && <AttendanceCorrectionForm record={{ id: record.id, attendanceDate: record.attendanceDate.toISOString().slice(0,10), correctionVersion: record.correctionVersion }} />}{record.corrections.map((correction) => <p key={correction.id} className="mt-2 text-slate-500">Correction v{correction.revision} by {correction.createdBy.name}: {correction.reason}</p>)}</article>)}</section>
    <section className="rounded-2xl border bg-white p-4"><h2 className="mb-3 text-sm font-bold">Immutable raw events</h2>{detail.events.map((event) => <p key={event.id} className="text-xs">{time(event.occurredAt)} · {event.direction ?? 'UNCLASSIFIED'} · {event.source}</p>)}</section>
  </div>;
}
