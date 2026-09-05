'use client';

import { useState, useTransition } from 'react';
import { ApplicationStatus } from '@prisma/client';
import { updateApplicationStatusAction } from '@/features/hiring/actions';
import { getAvailableNextStatuses, STAGE_CONFIG } from '@/features/hiring/pipeline';
import { Check, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';

interface StatusChangeDialogProps {
  applicationId: string;
  currentStatus: ApplicationStatus;
  isReadyToHire?: boolean;
  unmetRequirements?: string[];
  onStatusUpdated?: () => void;
}

export function StatusChangeDialog({
  applicationId,
  currentStatus,
  isReadyToHire = true,
  unmetRequirements = [],
  onStatusUpdated,
}: StatusChangeDialogProps) {
  const allowedNextStatuses = getAvailableNextStatuses(currentStatus);
  const isTerminal = allowedNextStatuses.length === 0;

  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus | null>(
    allowedNextStatuses.length > 0 ? allowedNextStatuses[0] : null
  );
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const handleUpdate = () => {
    if (!selectedStatus || selectedStatus === currentStatus) return;
    if (selectedStatus === ApplicationStatus.HIRED && !isReadyToHire) {
      setFeedback({
        type: 'error',
        message: 'Cannot move to Hired: candidate has not completed all mandatory pre-employment requirements.',
      });
      return;
    }
    setFeedback(null);

    startTransition(async () => {
      const result = await updateApplicationStatusAction(applicationId, selectedStatus);
      if (result.error) {
        setFeedback({ type: 'error', message: result.error });
      } else {
        setFeedback({ type: 'success', message: `Candidate successfully moved to ${selectedStatus}` });
        if (onStatusUpdated) {
          onStatusUpdated();
        }
      }
    });
  };

  const currentConfig = STAGE_CONFIG[currentStatus] || {
    label: currentStatus,
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
            Candidate Pipeline Status
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5">
            Current Stage:{' '}
            <span
              className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${currentConfig.badgeBg} ${currentConfig.badgeText}`}
            >
              {currentConfig.label}
            </span>
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg p-3 text-xs font-medium flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {isTerminal ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Terminal Application State</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              Candidate is in terminal state ({currentStatus}). No further stage transitions allowed.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Select Next Pipeline Stage:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {allowedNextStatuses.map((status) => {
              const config = STAGE_CONFIG[status];
              const isSelected = status === selectedStatus;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelectedStatus(status)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-bold transition-all ${
                    isSelected
                      ? 'border-[#181A1C] bg-[#F8F9FA] text-[#181A1C] ring-2 ring-[#181A1C] dark:border-white dark:bg-slate-800 dark:text-white'
                      : 'border-[#E8EAED] bg-white text-[#6B7280] hover:border-[#181A1C] hover:text-[#181A1C] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  <span>{config?.label || status}</span>
                  {isSelected && (
                    <Check className="h-4 w-4 text-[#181A1C] dark:text-white shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedStatus === ApplicationStatus.HIRED && !isReadyToHire && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              <p className="font-bold">Candidate Not Ready to Hire</p>
              <p className="mt-0.5">
                All mandatory pre-employment onboarding tasks and accepted offer terms must be verified
                before moving to Hired. Please use the Hiring Readiness card to review pending requirements.
              </p>
            </div>
          )}

          {selectedStatus && selectedStatus !== currentStatus && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isPending || (selectedStatus === ApplicationStatus.HIRED && !isReadyToHire)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#181A1C] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#2A2E33] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Move Candidate to {STAGE_CONFIG[selectedStatus]?.label || selectedStatus}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
