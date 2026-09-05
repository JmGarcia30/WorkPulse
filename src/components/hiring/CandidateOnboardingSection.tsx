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
  Plus,
  FileText,
  UploadCloud,
  CheckSquare,
  AlertCircle,
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

  const [reviewTask, setReviewTask] = useState<NonNullable<typeof onboarding>['tasks'][0] | null>(null);
  const [uploadTask, setUploadTask] = useState<NonNullable<typeof onboarding>['tasks'][0] | null>(null);
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
      <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181A1C] text-white">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#181A1C] dark:text-slate-100">
                Pre-Employment & Onboarding Checklist
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
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

        <div className="rounded-2xl border border-dashed border-[#E8EAED] bg-[#F8F9FA] p-6 text-center dark:border-slate-800 dark:bg-slate-800/20 space-y-3">
          <UserCheck className="mx-auto h-8 w-8 text-[#9CA3AF]" />
          <div>
            <p className="text-xs font-bold text-[#181A1C] dark:text-slate-300">
              Onboarding Process Not Yet Initialized
            </p>
            <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-0.5">
              {acceptedOffer
                ? 'Candidate has an accepted offer. Click below to initialize the standard institutional checklist.'
                : 'An offer must be created and marked as Accepted before starting employee onboarding.'}
            </p>
          </div>

          {canManage && acceptedOffer && (
            <button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="inline-flex items-center gap-2 rounded-xl bg-[#181A1C] px-4 py-2 text-xs font-bold text-white hover:bg-[#2A2E33] transition shadow-2xs disabled:opacity-50"
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
    <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
      {/* Top Header & Progress */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8EAED] dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181A1C] text-white">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#181A1C] dark:text-slate-100">
                Pre-Employment & Onboarding Checklist
              </h3>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
              Start Date: <span className="font-bold text-[#181A1C] dark:text-slate-300">{new Date(onboarding.startDate).toLocaleDateString()}</span>
              {onboarding.targetCompletionDate && (
                <> • Target: <span className="font-semibold">{new Date(onboarding.targetCompletionDate).toLocaleDateString()}</span></>
              )}
            </p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8EAED] dark:border-slate-700 bg-[#F8F9FA] dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-[#181A1C] dark:text-slate-300 hover:bg-[#181A1C] hover:text-white transition shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Custom Task</span>
          </button>
        )}
      </div>

      {/* Progress Bar Card */}
      <div className="rounded-2xl bg-[#F8F9FA] dark:bg-slate-800/40 p-4 border border-[#E8EAED] dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#181A1C] dark:text-slate-300">
            Checklist Completion Progress
          </span>
          <span className="font-extrabold text-[#181A1C] dark:text-slate-100">
            {progress.completedTasks} of {progress.totalTasks} tasks verified ({progress.percentComplete}%)
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E8EAED] dark:bg-slate-700">
          <div
            className={`h-full transition-all duration-300 ${
              progress.percentComplete === 100 ? 'bg-emerald-500' : 'bg-[#181A1C]'
            }`}
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#6B7280] dark:text-slate-400 pt-1">
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
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E8EAED] bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 hover:border-[#181A1C]/30 transition"
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
                    <span className="rounded-md bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                      REQUIRED
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-bold text-[#181A1C] dark:text-slate-100">
                  {task.title}
                </h4>

                {task.description && (
                  <p className="text-[11px] text-[#6B7280] dark:text-slate-400 line-clamp-1">
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
                    className="inline-flex items-center gap-1 rounded-xl border border-[#E8EAED] dark:border-slate-700 bg-[#F8F9FA] dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-[#181A1C] dark:text-slate-300 hover:bg-[#181A1C] hover:text-white transition shadow-2xs"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>View File</span>
                  </a>
                ) : (
                  <button
                    onClick={() => setUploadTask(task)}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#E8EAED] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-[#181A1C] dark:text-slate-300 hover:bg-[#F8F9FA] transition shadow-2xs"
                  >
                    <UploadCloud className="h-3.5 w-3.5 text-[#6B7280]" />
                    <span>Upload</span>
                  </button>
                )}

                {canManage && (
                  <button
                    onClick={() => setReviewTask(task)}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#181A1C] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#2A2E33] transition shadow-2xs"
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
