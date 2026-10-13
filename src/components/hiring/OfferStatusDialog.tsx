'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OfferStatus } from '@prisma/client';
import { updateOfferStatusAction } from '@/features/hiring/offer-actions';
import {
  getAvailableOfferTransitions,
  OFFER_STAGE_CONFIG,
} from '@/features/hiring/offer-pipeline';
import { X, ArrowRightLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

interface OfferStatusDialogProps {
  offerId: string;
  currentStatus: OfferStatus;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OfferStatusDialog({
  offerId,
  currentStatus,
  candidateName,
  isOpen,
  onClose,
}: OfferStatusDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableNextStatuses = getAvailableOfferTransitions(currentStatus);
  const [selectedStatus, setSelectedStatus] = useState<OfferStatus | ''>(
    availableNextStatuses[0] || ''
  );
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStatus) return;

    setError(null);
    setLoading(true);

    try {
      const res = await updateOfferStatusAction(
        offerId,
        selectedStatus as OfferStatus,
        notes || undefined
      );

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setError('An unexpected error occurred while updating the offer status.');
      setLoading(false);
    }
  }

  const currentConfig = OFFER_STAGE_CONFIG[currentStatus];

  return (
    <DialogFrame label="Update offer status" onClose={onClose} busy={loading}>
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-[var(--wp-border)] pb-4">
          <div>
            <h3 className="text-base font-bold text-[var(--wp-text)] flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-[var(--wp-text)]" />
              Update Offer Workflow Stage
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Candidate: <span className="font-semibold text-[var(--wp-text)]">{candidateName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose} aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="mt-4 rounded-md bg-[var(--wp-surface-subtle)] p-3.5 border border-[var(--wp-border)] space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--wp-text-muted)]">
            Current Stage
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-sm font-bold ${currentConfig.badgeBg} ${currentConfig.badgeText}`}
            >
              {currentConfig.label}
            </span>
          </div>
        </div>

        {availableNextStatuses.length === 0 ? (
          <div className="mt-4 rounded-md bg-[var(--wp-surface-subtle)] p-4 text-center text-sm text-[var(--wp-text-muted)]">
            <CheckCircle2 className="mx-auto h-6 w-6 text-[var(--wp-text-muted)] mb-1" />
            This offer is in terminal status <strong>{currentStatus}</strong> and cannot be transitioned further.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
            <div>
              <label className="block font-bold text-[var(--wp-text)] mb-1">
                Target Transition Stage *
              </label>
              <div className="space-y-2">
                {availableNextStatuses.map((st) => {
                  const cfg = OFFER_STAGE_CONFIG[st];
                  return (
                    <label
                      key={st}
                      className={`flex items-center justify-between rounded-md border p-3 cursor-pointer transition ${
                        selectedStatus === st
                          ? 'border-[#181A1C] bg-[var(--wp-surface-subtle)] '
                          : 'border-[var(--wp-border)] hover:bg-[#F8F9FA] '
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="targetStatus"
                          value={st}
                          checked={selectedStatus === st}
                          onChange={() => setSelectedStatus(st)}
                          className="h-4 w-4 text-[var(--wp-text)] focus:ring-[var(--tenant-accent)]"
                        />
                        <span className="font-bold text-[var(--wp-text)]">
                          {cfg.label}
                        </span>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${cfg.badgeBg} ${cfg.badgeText}`}
                      >
                        {st}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-bold text-[var(--wp-text)] mb-1">
                Decision / Audit Notes (Optional)
              </label>
              <textarea aria-label="Decision / Audit Notes (Optional)"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason or notes regarding this offer decision..."
                className="w-full rounded-md border border-[var(--wp-border)] px-3 py-2 text-sm text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--wp-border)] pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-md border border-[var(--wp-border)] px-4 py-2 text-sm font-semibold text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-[#F8F9FA]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedStatus}
                className="rounded-md bg-[var(--tenant-primary)] px-4 py-2 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 disabled:opacity-50 transition"
              >
                {loading ? 'Updating...' : 'Confirm Status Change'}
              </button>
            </div>
          </form>
        )}
      </div>
    </DialogFrame>
  );
}
