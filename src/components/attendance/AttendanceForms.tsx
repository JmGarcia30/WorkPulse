'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AttendanceDirection, AttendanceStatus } from '@prisma/client';
import { correctAttendanceAction, recordManualAttendanceEventAction } from '@/features/attendance/actions';

export function ManualAttendanceEventForm({ employeeId, submissionToken }: { employeeId: string; submissionToken: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [occurredAtLocal, setOccurredAtLocal] = useState('');
  const [direction, setDirection] = useState<AttendanceDirection>(AttendanceDirection.TIME_IN);
  const [message, setMessage] = useState<string | null>(null);
  return <form className="grid gap-3 rounded-2xl border border-slate-200 p-4" onSubmit={(event) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await recordManualAttendanceEventAction({ employeeId, occurredAtLocal, direction, submissionToken });
      if (!result.success) return setMessage(result.error);
      setMessage('Manual attendance event recorded. Reload the page for a fresh submission token.');
      router.refresh();
    });
  }}>
    <h3 className="text-sm font-bold">Manual attendance event</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <input aria-label="Occurred at" type="datetime-local" required value={occurredAtLocal} onChange={(event) => setOccurredAtLocal(event.target.value)} className="rounded-xl border px-3 py-2 text-xs" />
      <select value={direction} onChange={(event) => setDirection(event.target.value as AttendanceDirection)} className="rounded-xl border px-3 py-2 text-xs">
        <option value={AttendanceDirection.TIME_IN}>Time In</option><option value={AttendanceDirection.TIME_OUT}>Time Out</option>
      </select>
    </div>
    {message && <p className="text-xs text-slate-600">{message}</p>}
    <button disabled={pending} className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{pending ? 'Recording…' : 'Record event'}</button>
  </form>;
}

export function AttendanceCorrectionForm({ record }: { record: { id: string; attendanceDate: string; correctionVersion: number } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>(AttendanceStatus.PRESENT);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  return <form className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3" onSubmit={(event) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await correctAttendanceAction({
        dailyAttendanceRecordId: record.id, expectedRevision: record.correctionVersion,
        correctedTimeInLocal: timeIn || null, correctedTimeOutLocal: timeOut || null,
        correctedStatus: status, reason,
      });
      setMessage(result.success ? 'Correction recorded.' : result.error);
      if (result.success) router.refresh();
    });
  }}>
    <p className="text-xs font-bold">Add correction — {record.attendanceDate}</p>
    <div className="grid gap-2 sm:grid-cols-3">
      <input aria-label="Corrected time in" type="datetime-local" value={timeIn} onChange={(event) => setTimeIn(event.target.value)} className="rounded-lg border px-2 py-1.5 text-xs" />
      <input aria-label="Corrected time out" type="datetime-local" value={timeOut} onChange={(event) => setTimeOut(event.target.value)} className="rounded-lg border px-2 py-1.5 text-xs" />
      <select value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus)} className="rounded-lg border px-2 py-1.5 text-xs">
        <option value={AttendanceStatus.PRESENT}>Present</option><option value={AttendanceStatus.ABSENT}>Absent</option><option value={AttendanceStatus.INCOMPLETE}>Incomplete</option>
      </select>
    </div>
    <textarea required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Correction reason (required)" className="rounded-lg border px-2 py-1.5 text-xs" />
    {message && <p className="text-xs text-slate-600">{message}</p>}
    <button disabled={pending} className="w-fit rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Save correction</button>
  </form>;
}
