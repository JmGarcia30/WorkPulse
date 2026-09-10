'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignScheduleAction, createScheduleVersionAction } from '@/features/attendance/actions';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const seconds = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 3600 + minute * 60; };

export function ScheduleManager({ groups, employees }: {
  groups: Array<{ scheduleKey: string; name: string; versions: Array<{ id: string; version: number; displayName: string }> }>;
  employees: Array<{ id: string; employeeNumber: string; firstName: string; lastName: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scheduleKey, setScheduleKey] = useState('');
  const selected = groups.find((group) => group.scheduleKey === scheduleKey);
  const [name, setName] = useState('');
  const [workdays, setWorkdays] = useState<number[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [grace, setGrace] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const versions = useMemo(() => groups.flatMap((group) => group.versions), [groups]);
  const [employeeId, setEmployeeId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');

  return <div className="grid gap-5 lg:grid-cols-2">
    <form className="space-y-3 rounded-3xl border bg-white p-5" onSubmit={(event) => {
      event.preventDefault();
      startTransition(async () => {
        const result = await createScheduleVersionAction({
          scheduleKey: scheduleKey || undefined,
          name: name || selected?.name || '', lateGraceSeconds: grace,
          days: weekdays.map((_, index) => ({
            isoWeekday: index + 1, isWorkday: workdays.includes(index + 1),
            expectedStartSecond: workdays.includes(index + 1) ? seconds(start) : null,
            expectedEndSecond: workdays.includes(index + 1) ? seconds(end) : null,
            breaks: workdays.includes(index + 1) && breakStart && breakEnd ? [{ startSecond: seconds(breakStart), endSecond: seconds(breakEnd), isPaid: false }] : [],
          })),
        });
        setMessage(result.success ? 'Immutable schedule version created.' : result.error);
        if (result.success) router.refresh();
      });
    }}>
      <h2 className="text-sm font-bold">Create schedule version</h2>
      <select value={scheduleKey} onChange={(event) => { setScheduleKey(event.target.value); setName(groups.find((group) => group.scheduleKey === event.target.value)?.name ?? ''); }} className="w-full rounded-xl border px-3 py-2 text-xs"><option value="">New logical schedule</option>{groups.map((group) => <option key={group.scheduleKey} value={group.scheduleKey}>{group.name} — next version</option>)}</select>
      <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Schedule name" className="w-full rounded-xl border px-3 py-2 text-xs" />
      <div className="flex flex-wrap gap-2">{weekdays.map((day, index) => <label key={day} className="text-xs"><input type="checkbox" checked={workdays.includes(index + 1)} onChange={() => setWorkdays((current) => current.includes(index + 1) ? current.filter((value) => value !== index + 1) : [...current, index + 1])} /> {day.slice(0, 3)}</label>)}</div>
      <div className="grid grid-cols-2 gap-2"><input aria-label="Expected start" type="time" required={workdays.length > 0} value={start} onChange={(event) => setStart(event.target.value)} className="rounded-xl border px-3 py-2 text-xs" /><input aria-label="Expected end" type="time" required={workdays.length > 0} value={end} onChange={(event) => setEnd(event.target.value)} className="rounded-xl border px-3 py-2 text-xs" /></div>
      <div className="grid grid-cols-2 gap-2"><input aria-label="Unpaid break start" type="time" value={breakStart} onChange={(event) => setBreakStart(event.target.value)} className="rounded-xl border px-3 py-2 text-xs" /><input aria-label="Unpaid break end" type="time" value={breakEnd} onChange={(event) => setBreakEnd(event.target.value)} className="rounded-xl border px-3 py-2 text-xs" /></div>
      <label className="block text-xs">Late grace seconds<input type="number" min={0} value={grace} onChange={(event) => setGrace(Number(event.target.value))} className="ml-2 rounded-xl border px-3 py-2" /></label>
      <button disabled={pending} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Create version</button>
    </form>
    <form className="space-y-3 rounded-3xl border bg-white p-5" onSubmit={(event) => {
      event.preventDefault();
      startTransition(async () => {
        const result = await assignScheduleAction({ employeeId, scheduleVersionId: versionId, effectiveFrom, effectiveTo: effectiveTo || null });
        setMessage(result.success ? 'Schedule assigned.' : result.error);
        if (result.success) router.refresh();
      });
    }}>
      <h2 className="text-sm font-bold">Assign exact schedule version</h2>
      <select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="w-full rounded-xl border px-3 py-2 text-xs"><option value="">Employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} — {employee.firstName} {employee.lastName}</option>)}</select>
      <select required value={versionId} onChange={(event) => setVersionId(event.target.value)} className="w-full rounded-xl border px-3 py-2 text-xs"><option value="">Schedule version</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.displayName} v{version.version}</option>)}</select>
      <div className="grid grid-cols-2 gap-2"><input aria-label="Effective from" type="date" required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="rounded-xl border px-3 py-2 text-xs" /><input aria-label="Effective to exclusive" title="Exclusive end date" type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} className="rounded-xl border px-3 py-2 text-xs" /></div>
      <button disabled={pending} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Assign schedule</button>
    </form>
    {message && <p className="text-xs text-slate-600 lg:col-span-2">{message}</p>}
  </div>;
}
