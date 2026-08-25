'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  OnboardingStatus,
  OnboardingTaskType,
  OnboardingTaskStatus,
  OfferStatus,
} from '@prisma/client';
import {
  ONBOARDING_STATUS_CONFIG,
  TASK_STATUS_CONFIG,
  TASK_TYPE_CONFIG,
  calculateOnboardingProgress,
} from '@/features/hiring/onboarding-pipeline';
import { initializeOnboardingAction } from '@/features/hiring/onboarding-actions';
import { OnboardingTaskReviewModal } from './OnboardingTaskReviewModal';
import { OnboardingTaskUploadModal } from './OnboardingTaskUploadModal';
import { CustomOnboardingTaskModal } from './CustomOnboardingTaskModal';
import {
  UserCheck,
  CheckCircle2,
  Clock,
  Plus,
  FileText,
  UploadCloud,
  CheckSquare,
  AlertCircle,
  Calendar,
  ExternalLink,
} from 'lucide-react';

interface OnboardingSectionProps {
  applicationId: string;
  candidateName: string;
  offers: Array<{ status: OfferStatus; startDate: Date }>;
  onboarding: {
    id: string;
    status: OnboardingStatus;
    startDate: Date;
    targetCompletionDate: Date | null;
    completedAt: Date | null;
    notes: string | null;
    tasks: Array<{
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
    }>;
  } | null;
  canManage: boolean;
}

export function CandidateOnboardingSection({
  applicationId,
  candidateName,
  offers,
  onboarding,
  canManage,
}: OnboardingSectionProps) {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Modals state
  const [reviewTask, setReviewTask] = useState<(typeof onboarding extends null ? never : NonNullable<typeof onboarding>['tasks'][number]) | null>(null);
  const [uploadTask, setUploadTask] = useState<(typeof onboarding extends null ? never : NonNullable<typeof onboarding>['tasks'][number]) | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  const acceptedOffer = offers.find((o) => o.status === OfferStatus.ACCEPTED);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setInitError(null);

    try {
      const res = await initializeOnboardingAction(applicationId);
      if (res?.error) {
        setInitError(res.error);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      setInitError(
        err instanceof Error ? err.message : 'Failed to initialize onboarding.'
      );
    } finally {
      setIsInitializing(false);
    }
  };

  if (!onboarding) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Pre-Employment & Onboarding Checklist
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional onboarding, document clearance, and Day 1 readiness.
              </p>
            </div>
          </div>
        </div>

        {initError && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{initError}</span>
          </div>
        )}

        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-slate-800 dark:bg-slate-800/20 space-y-3">
          <UserCheck className="mx-auto h-8 w-8 text-slate-400" />
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Onboarding Process Not Yet Initialized
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {acceptedOffer
                ? 'Candidate has an accepted offer. Click below to initialize the standard institutional checklist.'
                : 'An offer must be created and marked as Accepted before starting employee onboarding.'}
            </p>
          </div>

          {canManage && acceptedOffer && (
            <button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
            >
              <CheckSquare className="h-4 w-4" />
              <span>{isInitializing ? 'Initializing...' : 'Initialize Onboarding Checklist'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const progress = calculateOnboardingProgress(onboarding.tasks);
  const statusConfig = ONBOARDING_STATUS_CONFIG[onboarding.status];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
      {/* Top Header & Progress */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Pre-Employment & Onboarding Checklist
              </h3>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Start Date: <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(onboarding.startDate).toLocaleDateString()}</span>
              {onboarding.targetCompletionDate && (
                <> • Target: <span className="font-medium">{new Date(onboarding.targetCompletionDate).toLocaleDateString()}</span></>
              )}
            </p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition"
          >
            <Plus className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Add Custom Task</span>
          </button>
        )}
      </div>

      {/* Progress Bar Card */}
      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            Checklist Completion Progress
          </span>
          <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
            {progress.completedTasks} of {progress.totalTasks} tasks verified ({progress.percentComplete}%)
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full transition-all duration-300 ${
              progress.percentComplete === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
            }`}
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
          <span>{progress.verifiedCount} Verified</span>
          <span>{progress.submittedCount} Awaiting Review</span>
          <span>{progress.pendingCount} Pending</span>
          {progress.rejectedCount > 0 && (
            <span className="text-rose-600 font-semibold">{progress.rejectedCount} Revision Needed</span>
          )}
        </div>
      </div>

      {/* Checklist Task Items */}
      <div className="space-y-2.5">
        {onboarding.tasks.map((task) => {
          const typeConf = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.OTHER;
          const statusConf = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.PENDING;

          return (
            <div
              key={task.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${typeConf.badgeBg} ${typeConf.badgeText}`}
                  >
                    {typeConf.label}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusConf.badgeBg} ${statusConf.badgeText}`}
                  >
                    {statusConf.label}
                  </span>
                  {task.isRequired && (
                    <span className="rounded-md bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                      REQUIRED
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {task.title}
                </h4>

                {task.description && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {task.description}
                  </p>
                )}

                {task.reviewerNotes && (
                  <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-md mt-1">
                    <span className="font-semibold">Reviewer:</span> {task.reviewerNotes}
                  </div>
                )}
              </div>

              {/* Task Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {task.storageKey ? (
                  <a
                    href={`/api/onboarding-documents/${task.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
                  >
                    <FileText className="h-3.5 w-3.5 text-indigo-600" />
                    <span>View File</span>
                  </a>
                ) : (
                  <button
                    onClick={() => setUploadTask(task)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
                  >
                    <UploadCloud className="h-3.5 w-3.5 text-slate-500" />
                    <span>Upload</span>
                  </button>
                )}

                {canManage && (
                  <button
                    onClick={() => setReviewTask(task)}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Review / Verify</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {reviewTask && (
        <OnboardingTaskReviewModal
          task={reviewTask}
          candidateName={candidateName}
          isOpen={true}
          onClose={() => setReviewTask(null)}
        />
      )}

      {uploadTask && (
        <OnboardingTaskUploadModal
          task={uploadTask}
          isOpen={true}
          onClose={() => setUploadTask(null)}
        />
      )}

      {isCustomModalOpen && (
        <CustomOnboardingTaskModal
          onboardingProcessId={onboarding.id}
          isOpen={true}
          onClose={() => setIsCustomModalOpen(false)}
        />
      )}
    </div>
  );
}
