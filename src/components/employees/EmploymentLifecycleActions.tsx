'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EmploymentCategory } from '@prisma/client';
import {
  doNotRenewEmployeeAction,
  regularizeEmployeeAction,
  renewTeachingProbationAction,
} from '@/features/employees/actions';
import { AlertCircle, CalendarClock, Loader2, ShieldCheck, X } from 'lucide-react';

type ActionMode = 'REGULARIZE' | 'RENEW' | 'NOT_RENEWED';

interface EmploymentLifecycleActionsProps {
  employeeId: string;
  employeeName: string;
  category: EmploymentCategory;
  regularizationAllowed: boolean;
  renewalAllowed: boolean;
  notRenewalAllowed: boolean;
  blockedReason: string | null;
  defaultEffectiveDate: string;
}

export function EmploymentLifecycleActions({
  employeeId,
  employeeName,
  category,
  regularizationAllowed,
  renewalAllowed,
  notRenewalAllowed,
  blockedReason,
  defaultEffectiveDate,
}: EmploymentLifecycleActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ActionMode | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(defaultEffectiveDate);
  const [nextStart, setNextStart] = useState('');
  const [nextEnd, setNextEnd] = useState('');
  const [remarks, setRemarks] = useState('');

  const close = () => {
    if (isPending) return;
    setMode(null);
    setError(null);
  };

  const submit = () => {
    if (!mode) return;
    setError(null);
    startTransition(async () => {
      const result =
        mode === 'REGULARIZE'
          ? await regularizeEmployeeAction(employeeId, {
              confirmed: true,
              regularizationEffectiveAt: effectiveDate,
              remarks,
            })
          : mode === 'RENEW'
            ? await renewTeachingProbationAction(employeeId, {
                confirmed: true,
                nextSchoolYearStartDate: nextStart,
                nextSchoolYearEndDate: nextEnd,
                remarks,
              })
            : await doNotRenewEmployeeAction(employeeId, {
                confirmed: true,
                nonRenewalEffectiveAt: effectiveDate,
                remarks,
              });

      if (!result.success) {
        setError(result.error);
        return;
      }
      setMode(null);
      router.refresh();
    });
  };

  const submitDisabled =
    isPending ||
    (mode === 'RENEW' && (!nextStart || !nextEnd)) ||
    ((mode === 'REGULARIZE' || mode === 'NOT_RENEWED') && !effectiveDate) ||
    (mode === 'NOT_RENEWED' && !remarks.trim());

  return (
    <>
      <section className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4" /> HR Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          {category === EmploymentCategory.NON_TEACHING && regularizationAllowed && (
            <button
              type="button"
              onClick={() => setMode('REGULARIZE')}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Regularize Employee
            </button>
          )}
          {category === EmploymentCategory.TEACHING && renewalAllowed && (
            <button
              type="button"
              onClick={() => setMode('RENEW')}
              className="rounded-xl bg-[#181A1C] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2A2E33]"
            >
              Renew Teaching Probation
            </button>
          )}
          {notRenewalAllowed && (
            <button
              type="button"
              onClick={() => setMode('NOT_RENEWED')}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Do Not Renew
            </button>
          )}
        </div>
        {blockedReason && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{blockedReason}</span>
          </div>
        )}
      </section>

      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold">
                  {mode === 'REGULARIZE'
                    ? 'Confirm Employee Regularization'
                    : mode === 'RENEW'
                      ? 'Confirm Teaching Probation Renewal'
                      : 'Confirm Non-Renewal'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{employeeName}</p>
              </div>
              <button type="button" onClick={close} aria-label="Close dialog">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-800">
              The decision timestamp is recorded by the server. Enter the actual institutional effective or school-year dates separately.
            </p>

            {mode === 'RENEW' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold">
                  <span>Next school-year start</span>
                  <input
                    type="date"
                    required
                    value={nextStart}
                    onChange={(event) => setNextStart(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  <span>Next school-year end</span>
                  <input
                    type="date"
                    required
                    value={nextEnd}
                    onChange={(event) => setNextEnd(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
            ) : (
              <label className="block space-y-1 text-xs font-semibold">
                <span>
                  {mode === 'REGULARIZE'
                    ? 'Regularization effective date'
                    : 'Non-renewal effective date'}
                </span>
                <input
                  type="date"
                  required
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
            )}

            <label className="block space-y-1 text-xs font-semibold">
              <span>Remarks {mode === 'NOT_RENEWED' ? '(required)' : '(optional)'}</span>
              <textarea
                rows={4}
                maxLength={2000}
                required={mode === 'NOT_RENEWED'}
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={close}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitDisabled}
                onClick={submit}
                className="inline-flex items-center gap-2 rounded-xl bg-[#181A1C] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
