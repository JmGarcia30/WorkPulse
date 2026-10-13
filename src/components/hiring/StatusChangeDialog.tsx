'use client';

import { useState, useTransition } from 'react';
import { ApplicationStatus } from '@prisma/client';
import { updateApplicationStatusAction } from '@/features/hiring/actions';
import { getAvailableNextStatuses, STAGE_CONFIG } from '@/features/hiring/pipeline';
import { Check, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';

interface StatusChangeDialogProps {
  applicationId: string;
  currentStatus: ApplicationStatus;
  onStatusUpdated?: () => void;
}

export function StatusChangeDialog({
  applicationId,
  currentStatus,
  onStatusUpdated,
}: StatusChangeDialogProps) {
  const allowedNextStatuses = getAvailableNextStatuses(currentStatus).filter(
    (status) => status !== ApplicationStatus.HIRED
  );
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
    badgeBg: 'bg-slate-100 ',
    badgeText: 'text-slate-700 ',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Candidate Pipeline Status
          </h3>
          <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5">
            Current Stage:{' '}
            <span
              className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${currentConfig.badgeBg} ${currentConfig.badgeText}`}
            >
              {currentConfig.label}
            </span>
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg p-3 text-sm font-medium flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 '
              : 'bg-rose-50 text-rose-800 border border-rose-200 '
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {isTerminal ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3.5 text-sm text-amber-800 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {currentStatus === ApplicationStatus.OFFER
                ? 'Final Hiring Conversion'
                : 'Terminal Application State'}
            </p>
            <p className="text-xs opacity-90 mt-0.5">
              {currentStatus === ApplicationStatus.OFFER
                ? 'Use the Hiring Readiness card to complete the atomic Employee conversion.'
                : `Candidate is in terminal state (${currentStatus}). No further stage transitions allowed.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">
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
                  className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-sm font-bold transition-all ${
                    isSelected
                      ? 'border-[#181A1C] bg-[var(--wp-surface-subtle)] text-[var(--wp-text)] ring-2 ring-[#181A1C] '
                      : 'border-[var(--wp-border)] bg-white text-[var(--wp-text-muted)] hover:border-[#181A1C] hover:text-[var(--wp-text)] '
                  }`}
                >
                  <span>{config?.label || status}</span>
                  {isSelected && (
                    <Check className="h-4 w-4 text-[var(--wp-text)] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedStatus && selectedStatus !== currentStatus && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--tenant-primary)] px-4 py-2.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
