'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recoverEmergencyAttendanceAction } from '@/features/attendance/actions';
import type { EmergencyAttendanceReason } from '@/features/attendance/emergency-recovery';

const emergencyAttendanceReasons: EmergencyAttendanceReason[] = ['POWER_OUTAGE', 'INTERNET_OUTAGE', 'RFID_DEVICE_FAILURE', 'OTHER'];
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

const reasonLabels: Record<EmergencyAttendanceReason, string> = {
  POWER_OUTAGE: 'Power outage',
  INTERNET_OUTAGE: 'Internet outage',
  RFID_DEVICE_FAILURE: 'RFID reader / kiosk failure',
  OTHER: 'Other verified incident',
};

type Employee = { id: string; employeeNumber: string; firstName: string; lastName: string };

export function EmergencyAttendanceRecoveryForm({
  employees, timeZone,
}: {
  employees: Employee[];
  timeZone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submissionToken, setSubmissionToken] = useState(() => crypto.randomUUID());
  const [employeeId, setEmployeeId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState('');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [reason, setReason] = useState<EmergencyAttendanceReason>('POWER_OUTAGE');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const employee = employees.find(item => item.id === employeeId);
  function confirm() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await recoverEmergencyAttendanceAction({
          employeeId, attendanceDate, timeIn, timeOut, reason,
          evidenceReference, notes, submissionToken,
        });
        if (!result.success) {
          setError(result.error);
          return;
        }
        setShowConfirm(false);
        setSuccess(result.idempotent ? 'This same recovery submission was already saved.' : 'Emergency attendance saved. Review the employee DTR before payroll processing.');
        setSubmissionToken(crypto.randomUUID());
        router.refresh();
      } catch {
        setError('Unable to save attendance. Check your connection, then retry using the same submission.');
      }
    });
  }

  return (
    <div className="wp-card max-w-3xl space-y-5 p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="font-semibold text-[#282934]">Recover attendance from offline records</h2>
        <p className="text-sm text-[var(--wp-text-muted)]">
          Record a verified same-day Time In and Time Out pair from the paper attendance log.
          Times are interpreted in {timeZone}. Existing RFID/manual events must be reviewed using the DTR correction workflow instead.
        </p>
      </div>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); setError(null); setSuccess(null); setShowConfirm(true); }}>
        <label className="wp-label block">
          Employee
          <select className="wp-input mt-1" required value={employeeId} onChange={event => setEmployeeId(event.target.value)}>
            <option value="">Select an employee</option>
            {employees.map(item => (
              <option key={item.id} value={item.id}>{item.employeeNumber} — {item.firstName} {item.lastName}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="wp-label">Attendance date<input className="wp-input mt-1" type="date" required value={attendanceDate} onChange={event => setAttendanceDate(event.target.value)} /></label>
          <label className="wp-label">Time In<input className="wp-input mt-1" type="time" required value={timeIn} onChange={event => setTimeIn(event.target.value)} /></label>
          <label className="wp-label">Time Out<input className="wp-input mt-1" type="time" required value={timeOut} onChange={event => setTimeOut(event.target.value)} /></label>
        </div>
        <label className="wp-label block">
          Incident reason
          <select className="wp-input mt-1" value={reason} onChange={event => setReason(event.target.value as EmergencyAttendanceReason)}>
            {emergencyAttendanceReasons.map(value => <option key={value} value={value}>{reasonLabels[value]}</option>)}
          </select>
        </label>
        <label className="wp-label block">
          Paper attendance sheet / evidence reference
          <input className="wp-input mt-1" required minLength={3} maxLength={160} value={evidenceReference} onChange={event => setEvidenceReference(event.target.value)} placeholder="e.g. Logbook 12, page 4" />
        </label>
        <label className="wp-label block">
          Incident notes
          <textarea className="wp-input mt-1 min-h-24" required minLength={3} maxLength={800} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Explain why the regular RFID attendance could not be recorded and how the paper times were verified." />
        </label>
        <p className="text-xs text-[var(--wp-text-muted)]">Manual entries are attributed to your HR account, not to the RFID reader. The original evidence should be retained under your organization's policy.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="text-sm text-emerald-700">{success}</p>}
        <button type="submit" className="wp-button-primary" disabled={pending || !employees.length}>
          {pending ? 'Saving…' : 'Review and Save Attendance'}
        </button>
      </form>
      <ConfirmationDialog
        isOpen={showConfirm}
        onClose={() => { if (!pending) setShowConfirm(false); }}
        onConfirm={confirm}
        busy={pending}
        error={error}
        title="Confirm emergency attendance?"
        description="Verify both times against the original signed paper attendance sheet before saving."
        details={[
          { label: 'Employee', value: employee ? `${employee.firstName} ${employee.lastName}` : '—' },
          { label: 'Date', value: attendanceDate },
          { label: 'Time In / Out', value: `${timeIn} – ${timeOut} (${timeZone})` },
          { label: 'Incident', value: reasonLabels[reason] },
          { label: 'Evidence', value: evidenceReference },
        ]}
        warning="Existing attendance, leave conflicts or finalized payroll will block automatic recovery. Review the DTR afterward."
        confirmLabel="Save Manual Attendance"
        confirmVariant="warning"
      />
    </div>
  );
}
