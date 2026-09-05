'use client';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
        <div className="flex items-center justify-between border-b border-[#E8EAED] pb-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-[#181A1C] dark:text-slate-100 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-[#181A1C] dark:text-white" />
              Update Offer Workflow Stage
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Candidate: <span className="font-semibold text-[#181A1C] dark:text-slate-300">{candidateName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-[#F8F9FA] p-3.5 border border-[#E8EAED] dark:bg-slate-950 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
            Current Stage
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${currentConfig.badgeBg} ${currentConfig.badgeText}`}
            >
              {currentConfig.label}
            </span>
          </div>
        </div>

        {availableNextStatuses.length === 0 ? (
          <div className="mt-4 rounded-xl bg-[#F8F9FA] p-4 text-center text-xs text-[#6B7280] dark:bg-slate-800 dark:text-slate-400">
            <CheckCircle2 className="mx-auto h-6 w-6 text-[#9CA3AF] mb-1" />
            This offer is in terminal status <strong>{currentStatus}</strong> and cannot be transitioned further.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-[#181A1C] dark:text-slate-300 mb-1">
                Target Transition Stage *
              </label>
              <div className="space-y-2">
                {availableNextStatuses.map((st) => {
                  const cfg = OFFER_STAGE_CONFIG[st];
                  return (
                    <label
                      key={st}
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                        selectedStatus === st
                          ? 'border-[#181A1C] bg-[#F8F9FA] dark:border-white dark:bg-slate-800'
                          : 'border-[#E8EAED] hover:bg-[#F8F9FA] dark:border-slate-800 dark:hover:bg-slate-950'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="targetStatus"
                          value={st}
                          checked={selectedStatus === st}
                          onChange={() => setSelectedStatus(st)}
                          className="h-4 w-4 text-[#181A1C] focus:ring-[#181A1C]"
                        />
                        <span className="font-bold text-[#181A1C] dark:text-slate-100">
                          {cfg.label}
                        </span>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${cfg.badgeBg} ${cfg.badgeText}`}
                      >
                        {st}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#181A1C] dark:text-slate-300 mb-1">
                Decision / Audit Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason or notes regarding this offer decision..."
                className="w-full rounded-xl border border-[#E8EAED] px-3 py-2 text-xs text-[#181A1C] focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E8EAED] pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-[#E8EAED] px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#181A1C] hover:bg-[#F8F9FA] dark:border-slate-800 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedStatus}
                className="rounded-xl bg-[#181A1C] px-4 py-2 text-xs font-bold text-white hover:bg-[#2A2E33] disabled:opacity-50 transition shadow-2xs"
              >
                {loading ? 'Updating...' : 'Confirm Status Change'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
