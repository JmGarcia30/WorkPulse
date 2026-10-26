'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { submitResignationAction } from '../ess-resignation-actions';

const fieldClass =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-[var(--tenant-primary)] focus:outline-hidden transition';

export function ResignationForm({ requestKey, today }: { requestKey: string; today: string }) {
  const [state, action, pending] = useActionState(submitResignationAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="requestKey" value={requestKey} />
      <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Reason for Resignation
          </label>
          <textarea
            name="reason"
            className={fieldClass}
            required
            maxLength={2000}
            rows={4}
            placeholder="Please explain your reasons for resigning and any transition notes..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Proposed Last Working Day
            </label>
            <input
              type="date"
              name="proposedLastWorkingDay"
              min={today}
              className={fieldClass}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Effective Separation Date
            </label>
            <input
              type="date"
              name="proposedEffectiveDate"
              min={today}
              className={fieldClass}
              required
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-600">
          The effective date is your first day outside employment and must be after your last working day. The notice date is recorded automatically upon submission.
        </div>

        <label className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 cursor-pointer pt-1">
          <input
            type="checkbox"
            name="confirmed"
            required
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--tenant-primary)] focus:ring-[var(--tenant-primary)]"
          />
          <span>
            I confirm that I am submitting this formal resignation notice and that the proposed dates and reason are correct.
          </span>
        </label>

        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-primary)] px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-2xs hover:brightness-95 transition disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Submitting notice…</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Submit Resignation Notice</span>
            </>
          )}
        </button>
      </fieldset>

      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {state.success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{state.success}</span>
        </div>
      )}
    </form>
  );
}
