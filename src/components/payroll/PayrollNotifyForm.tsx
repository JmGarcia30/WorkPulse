'use client';

import { useActionState } from 'react';
import { notifyPayrollEmployeesAction } from '@/features/payroll/actions';

export function PayrollNotifyForm({ periodId, token, recipients, skipped }: { periodId: string; token: string; recipients: Array<{ entryId: string; name: string; createdAt: string | null }>; skipped: number }) {
  const [state, action, pending] = useActionState(notifyPayrollEmployeesAction, {});
  const remaining = recipients.filter(row => !row.createdAt).length;
  return <div className="space-y-3 text-sm">
    <p>{recipients.length - remaining} of {recipients.length} eligible employees already announced. {skipped > 0 && `${skipped} finalized entries have no active ESS recipient.`}</p>
    <details><summary className="cursor-pointer font-semibold">Review notification recipients ({recipients.length})</summary><ul className="mt-2 max-h-60 overflow-y-auto space-y-1">{recipients.map(row => <li key={row.entryId}>{row.name} — {row.createdAt ? `Created ${new Date(row.createdAt).toLocaleString('en-PH')}` : 'Ready to notify'}</li>)}</ul></details>
    <form action={action} className="space-y-3" aria-busy={pending}><input type="hidden" name="payrollPeriodId" value={periodId} /><input type="hidden" name="recipientToken" value={token} />
      <label className="flex gap-2"><input type="checkbox" name="confirmation" value="NOTIFY" required disabled={!remaining || pending} />I reviewed the recipients and confirm creating in-app payslip notifications.</label>
      <button disabled={pending || !remaining} className="wp-button-primary">{pending ? 'Notifying…' : 'Notify Employees'}</button>
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-emerald-800">{state.success}</p>}
    </form>
  </div>;
}
