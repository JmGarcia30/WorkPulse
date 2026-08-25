'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  OnboardingTaskStatus,
  OnboardingTaskType,
} from '@prisma/client';
import {
  TASK_STATUS_CONFIG,
  TASK_TYPE_CONFIG,
  getAvailableTaskTransitions,
} from '@/features/hiring/onboarding-pipeline';
import { updateOnboardingTaskStatusAction } from '@/features/hiring/onboarding-actions';
import {
  X,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Download,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

interface TaskReviewModalProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    type: OnboardingTaskType;
    status: OnboardingTaskStatus;
    isRequired: boolean;
    dueDate: Date | null;
    submittedAt: Date | null;
    verifiedAt: Date | null;
    reviewerNotes: string | null;
    fileName: string | null;
    fileType: string | null;
    fileSize: number | null;
    storageKey: string | null;
    verifiedBy?: { name: string } | null;
  };
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingTaskReviewModal({
  task,
  candidateName,
  isOpen,
  onClose,
}: TaskReviewModalProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<OnboardingTaskStatus>(
    OnboardingTaskStatus.VERIFIED
  );
  const [reviewerNotes, setReviewerNotes] = useState(task.reviewerNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableTransitions = getAvailableTaskTransitions(task.status);
  const typeConfig = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.OTHER;
  const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.PENDING;

  const handleStatusUpdate = async (targetStatus: OnboardingTaskStatus) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await updateOnboardingTaskStatusAction(
        task.id,
        targetStatus,
        reviewerNotes
      );

      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
        onClose();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'An error occurred while updating the task.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${typeConfig.badgeBg} ${typeConfig.badgeText}`}
              >
                {typeConfig.label}
              </span>
              {task.isRequired && (
                <span className="rounded-md bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  Required
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1.5 leading-snug">
              {task.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Candidate: <span className="font-semibold text-slate-700 dark:text-slate-300">{candidateName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Task Details */}
        <div className="space-y-3 text-xs">
          {task.description && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                Instructions / Description
              </p>
              {task.description}
            </div>
          )}

          {/* Current Status & Submitted Document */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Current Status
              </span>
              <div>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
                >
                  {statusConfig.label}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Due Date
              </span>
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'None'}
              </p>
            </div>
          </div>

          {/* Attached Document Download Box */}
          {task.storageKey ? (
            <div className="flex items-center justify-between rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="rounded-lg bg-indigo-600 p-2 text-white shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-indigo-900 dark:text-indigo-200 truncate">
                    {task.fileName || 'Uploaded Document'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {task.fileSize ? `${Math.round(task.fileSize / 1024)} KB` : ''} •{' '}
                    Submitted {task.submittedAt ? new Date(task.submittedAt).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
              <a
                href={`/api/onboarding-documents/${task.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                <span>View</span>
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-3 text-center text-slate-400">
              No document has been uploaded for this item yet.
            </div>
          )}

          {/* Reviewer Feedback Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Reviewer Notes / Feedback (Optional)
            </label>
            <textarea
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="e.g. Document verified against official PRC database. Approved."
              rows={2}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {availableTransitions.includes(OnboardingTaskStatus.REJECTED) && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleStatusUpdate(OnboardingTaskStatus.REJECTED)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Reject / Request Revision</span>
              </button>
            )}

            {availableTransitions.includes(OnboardingTaskStatus.WAIVED) && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleStatusUpdate(OnboardingTaskStatus.WAIVED)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition disabled:opacity-50"
              >
                <span>Waive Requirement</span>
              </button>
            )}

            {availableTransitions.includes(OnboardingTaskStatus.VERIFIED) && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleStatusUpdate(OnboardingTaskStatus.VERIFIED)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Verify & Approve</span>
              </button>
            )}

            {task.status === OnboardingTaskStatus.VERIFIED && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleStatusUpdate(OnboardingTaskStatus.IN_PROGRESS)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-3.5 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reopen Item</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
