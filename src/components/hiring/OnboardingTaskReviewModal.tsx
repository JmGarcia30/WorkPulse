'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

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
    <DialogFrame label="Review onboarding task" onClose={onClose} busy={isSubmitting}>
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${typeConfig.badgeBg} ${typeConfig.badgeText}`}
              >
                {typeConfig.label}
              </span>
              {task.isRequired && (
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                  Required
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1.5 leading-snug">
              {task.title}
            </h3>
            <p className="text-sm text-slate-500">
              Candidate: <span className="font-semibold text-slate-700">{candidateName}</span>
            </p>
          </div>
          <button
            onClick={onClose} aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Task Details */}
        <div className="space-y-3 text-sm">
          {task.description && (
            <div className="rounded-md bg-slate-50 p-3 text-slate-700">
              <p className="font-semibold text-slate-500 uppercase tracking-wider text-xs mb-1">
                Instructions / Description
              </p>
              {task.description}
            </div>
          )}

          {/* Current Status & Submitted Document */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-slate-100 p-3 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Current Status
              </span>
              <div>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
                >
                  {statusConfig.label}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-slate-100 p-3 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Due Date
              </span>
              <p className="font-medium text-slate-800">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'None'}
              </p>
            </div>
          </div>

          {/* Attached Document Download Box */}
          {task.storageKey ? (
            <div className="flex items-center justify-between rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="rounded-md bg-[var(--tenant-primary)] p-2 text-[var(--tenant-primary-foreground)] shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[var(--wp-text)] truncate">
                    {task.fileName || 'Uploaded Document'}
                  </p>
                  <p className="text-xs text-[var(--wp-text-muted)]">
                    {task.fileSize ? `${Math.round(task.fileSize / 1024)} KB` : ''} •{' '}
                    Submitted {task.submittedAt ? new Date(task.submittedAt).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
              <a
                href={`/api/onboarding-documents/${task.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-[var(--tenant-primary)] px-3 py-1.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                <span>View</span>
              </a>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--wp-border)] p-3 text-center text-[var(--wp-text-muted)]">
              No document has been uploaded for this item yet.
            </div>
          )}

          {/* Reviewer Feedback Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-[var(--wp-text)]">
              Reviewer Notes / Feedback (Optional)
            </label>
            <textarea aria-label="Reviewer Notes / Feedback (Optional)"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="e.g. Document verified against official PRC database. Approved."
              rows={2}
              className="w-full rounded-lg border border-[var(--wp-border)] bg-white px-3 py-2 text-sm text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:outline-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {availableTransitions.includes(OnboardingTaskStatus.REJECTED) && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleStatusUpdate(OnboardingTaskStatus.REJECTED)}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 border border-rose-200 px-3.5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition disabled:opacity-50"
              >
                <span>Waive Requirement</span>
              </button>
            )}

            {availableTransitions.includes(OnboardingTaskStatus.VERIFIED) && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleStatusUpdate(OnboardingTaskStatus.VERIFIED)}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-3.5 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reopen Item</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </DialogFrame>
  );
}
