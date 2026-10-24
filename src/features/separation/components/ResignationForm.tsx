'use client';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitResignationAction } from '../ess-resignation-actions';

const fieldClass = 'mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm';
export function ResignationForm({ requestKey, today }: { requestKey: string; today: string }) {
  const [state, action, pending] = useActionState(submitResignationAction, {});
  const router = useRouter();
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="requestKey" value={requestKey} />
    <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
      <label className="block text-sm font-semibold">Reason for resignation<textarea name="reason" className={fieldClass} required maxLength={2000} rows={4} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Proposed last working day<input type="date" name="proposedLastWorkingDay" min={today} className={fieldClass} required /></label>
        <label className="block text-sm font-semibold">Effective separation date<input type="date" name="proposedEffectiveDate" min={today} className={fieldClass} required /></label>
      </div>
      <p className="text-sm text-slate-600">The effective date is the first day outside employment and must be after your last working day. The notice date is recorded automatically using your organization’s date when you submit.</p>
      <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" name="confirmed" required /><span>I confirm that I am submitting this resignation notice and that the proposed dates and reason are correct.</span></label>
      <button type="submit" className="rounded-xl bg-[var(--tenant-primary)] px-5 py-2.5 text-sm font-bold text-[var(--tenant-primary-foreground)]">{pending ? 'Submitting…' : 'Submit resignation notice'}</button>
    </fieldset>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-800">{state.success}</p>}
  </form>;
}
