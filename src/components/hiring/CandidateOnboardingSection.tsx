'use client';

import { useState, useEffect, useTransition } from 'react';
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
  getOnboardingTaskSection,
} from '@/features/hiring/onboarding-pipeline';
import {
  initializeOnboardingAction,
  syncOnboardingWithRecruitmentDocsAction,
} from '@/features/hiring/onboarding-actions';
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
  GraduationCap,
  Briefcase,
  RefreshCw,
  ShieldCheck,
  FileCheck2,
  ExternalLink,
  Eye,
  Download,
} from 'lucide-react';

interface OnboardingSectionProps {
  applicationId: string;
  candidateName: string;
  offers: Array<{ status: OfferStatus; startDate: Date }>;
  category?: 'TEACHING' | 'NON_TEACHING';
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
  category,
  onboarding,
  canManage,
}: OnboardingSectionProps) {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [reviewTask, setReviewTask] = useState<
    NonNullable<typeof onboarding>['tasks'][0] | null
  >(null);
  const [uploadTask, setUploadTask] = useState<
    NonNullable<typeof onboarding>['tasks'][0] | null
  >(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  const [isSyncing, startSyncTransition] = useTransition();
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const onboardingId = onboarding?.id;

  const acceptedOffer = offers.find((o) => o.status === OfferStatus.ACCEPTED);
  const isTeaching = category === 'TEACHING';

  // Automatic synchronization: auto-recognize verified credentials on mount
  useEffect(() => {
    if (!canManage || !onboardingId || !applicationId) return;
    let cancelled = false;
    syncOnboardingWithRecruitmentDocsAction(applicationId)
      .then((res) => {
        if (!cancelled && res.success && res.updatedCount && res.updatedCount > 0) router.refresh();
      })
      .catch(() => {
        if (!cancelled) setSyncError('Unable to refresh recruitment document checks. Use Reconcile with Recruitment Docs to retry.');
      });
    return () => { cancelled = true; };
  }, [applicationId, onboardingId, canManage, router]);

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

  const handleManualSync = () => {
    setSyncError(null);
    setSyncFeedback(null);
    startSyncTransition(async () => {
      try {
        const res = await syncOnboardingWithRecruitmentDocsAction(applicationId);
        if (res.error) {
          setSyncError(`Sync failed: ${res.error}`);
        } else {
          setSyncFeedback(
            res.updatedCount && res.updatedCount > 0
              ? `Successfully reconciled ${res.updatedCount} credential(s) from Recruitment Documents.`
              : 'Checklist is up to date. All verified recruitment documents are already recognized.'
          );
          router.refresh();
        }
        setTimeout(() => setSyncFeedback(null), 4500);
      } catch {
        setSyncError('Unable to reconcile recruitment documents. Please try again.');
      }
    });
  };

  if (!onboarding) {
    return (
      <div className="rounded-lg border border-[var(--wp-border)] bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)]">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--wp-text)]">
                  Pre-Employment & Onboarding Checklist
                </h3>
                {category && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                      isTeaching
                        ? 'bg-purple-100 text-purple-800 '
                        : 'bg-blue-100 text-blue-800 '
                    }`}
                  >
                    {isTeaching ? <GraduationCap className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                    {isTeaching ? 'Faculty' : 'Staff'}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--wp-text-muted)]">
                Institutional onboarding, document clearance, and Day 1 readiness.
              </p>
            </div>
          </div>
        </div>

        {initError && (
          <div className="flex items-center gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{initError}</span>
          </div>
        )}

        <div className="rounded-lg border border-dashed border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] p-6 text-center space-y-3">
          <UserCheck className="mx-auto h-8 w-8 text-[var(--wp-text-muted)]" />
          <div>
            <p className="text-sm font-bold text-[var(--wp-text)]">
              Onboarding Process Not Yet Initialized
            </p>
            <p className="text-xs text-[var(--wp-text-muted)] mt-0.5">
              {acceptedOffer
                ? `Candidate has an accepted offer. Click below to initialize the category-aware checklist (${isTeaching ? 'Faculty with LET requirement' : 'Staff without LET'}).`
                : 'An offer must be created and marked as Accepted before starting employee onboarding.'}
            </p>
          </div>

          {canManage && acceptedOffer && (
            <button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--tenant-primary)] px-4 py-2 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition disabled:opacity-50"
            >
              <CheckSquare className="h-4 w-4" />
              <span>{isInitializing ? 'Initializing Onboarding...' : 'Initialize Onboarding Checklist'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const progress = calculateOnboardingProgress(onboarding.tasks);
  const statusConfig = ONBOARDING_STATUS_CONFIG[onboarding.status];

  // Separate Pre-Employment Credentials from Onboarding Activities
  const preEmploymentTasks = onboarding.tasks.filter(
    (t) => getOnboardingTaskSection(t.title, t.type) === 'PRE_EMPLOYMENT_CREDENTIALS'
  );
  const activityTasks = onboarding.tasks.filter(
    (t) => getOnboardingTaskSection(t.title, t.type) === 'ONBOARDING_ACTIVITIES'
  );

  const renderTaskItem = (task: typeof onboarding.tasks[0]) => {
    const typeConf = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.OTHER;
    const statusConf = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.PENDING;
    const isAutoVerified =
      task.status === OnboardingTaskStatus.VERIFIED &&
      Boolean(task.reviewerNotes?.includes('Auto-verified from verified SAGA Recruitment'));
    const isContractVerified =
      task.status === OnboardingTaskStatus.VERIFIED &&
      Boolean(task.reviewerNotes?.includes('Auto-verified from executed institutional employment contract'));

    return (
      <div
        key={task.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[var(--wp-border)] bg-white p-4 hover:border-[#181A1C]/30 transition"
      >
        <div className="space-y-1.5 min-w-0 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${typeConf.badgeBg} ${typeConf.badgeText}`}
            >
              {typeConf.label}
            </span>
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${statusConf.badgeBg} ${statusConf.badgeText}`}
            >
              {statusConf.label}
            </span>
            {task.isRequired ? (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                REQUIRED
              </span>
            ) : (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                CONDITIONAL
              </span>
            )}

            {isAutoVerified && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-500/20">
                <ShieldCheck className="h-3 w-3" />
                Carried from Recruitment
              </span>
            )}

            {isContractVerified && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--tenant-tint)] px-2 py-0.5 text-[9px] font-bold text-indigo-700 ring-1 ring-indigo-500/20">
                <FileCheck2 className="h-3 w-3" />
                Contract Executed
              </span>
            )}
          </div>

          <h4 className="text-sm font-bold text-[var(--wp-text)]">
            {task.title}
          </h4>

          {task.description && (
            <p className="text-xs text-[var(--wp-text-muted)] line-clamp-1">
              {task.description}
            </p>
          )}

          {/* Uploaded File Info */}
          {task.fileName && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-700 font-medium pt-0.5">
              <FileCheck2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[280px]">File: {task.fileName}</span>
              {task.fileSize && (
                <span className="text-slate-400">({(task.fileSize / 1024).toFixed(1)} KB)</span>
              )}
              {task.storageKey && (
                <a
                  href={`/api/onboarding-documents/${task.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2 ml-1"
                >
                  <Eye className="h-3 w-3" />
                  <span>View</span>
                </a>
              )}
            </div>
          )}

          {task.reviewerNotes && (
            <div className="text-xs text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
              <span className="font-semibold text-slate-900">Review Note:</span> {task.reviewerNotes}
            </div>
          )}
        </div>

        {/* Task Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {task.storageKey ? (
            <div className="flex items-center gap-1.5">
              <a
                href={`/api/onboarding-documents/${task.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/70 text-blue-700 px-3 py-1.5 text-sm font-bold hover:bg-blue-100 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>View / Download</span>
              </a>
              <button
                onClick={() => setUploadTask(task)}
                title="Replace or re-upload document file"
                className="inline-flex items-center gap-1 rounded-md border border-[var(--wp-border)] bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                <UploadCloud className="h-3.5 w-3.5 text-slate-400" />
                <span>Replace</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setUploadTask(task)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--wp-border)] bg-white px-3 py-1.5 text-sm font-bold text-[var(--wp-text)] hover:bg-[#F8F9FA] transition"
            >
              <UploadCloud className="h-3.5 w-3.5 text-[var(--wp-text-muted)]" />
              <span>Upload Document</span>
            </button>
          )}

          {canManage && (
            <button
              onClick={() => setReviewTask(task)}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--tenant-primary)] px-3.5 py-1.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Review / Verify</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-[var(--wp-border)] bg-white p-6 space-y-6">
      {/* Top Header & Progress */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--wp-border)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)]">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[var(--wp-text)]">
                Pre-Employment & Onboarding Checklist
              </h3>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
              >
                {statusConfig.label}
              </span>
              {category && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isTeaching
                      ? 'bg-purple-100 text-purple-800 '
                      : 'bg-blue-100 text-blue-800 '
                  }`}
                >
                  {isTeaching ? <GraduationCap className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                  {isTeaching ? 'Faculty (Teaching)' : 'Staff (Non-Teaching)'}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--wp-text-muted)] mt-0.5">
              Start Date:{' '}
              <span className="font-bold text-[var(--wp-text)]">
                {new Date(onboarding.startDate).toLocaleDateString()}
              </span>
              {onboarding.targetCompletionDate && (
                <>
                  {' '}
                  • Target:{' '}
                  <span className="font-semibold">
                    {new Date(onboarding.targetCompletionDate).toLocaleDateString()}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Reconcile / Manual Sync Button */}
          {canManage && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Reconcile and pull in credentials verified during the recruitment stage"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Reconciling...' : 'Reconcile with Recruitment Docs'}</span>
            </button>
          )}

          {canManage && (
            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3.5 py-1.5 text-sm font-bold text-[var(--wp-text)] hover:bg-[var(--tenant-primary)] hover:text-[var(--tenant-primary-foreground)] transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Custom Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Feedback Message */}
      {syncError && <p role="alert" className="wp-alert-danger">{syncError}</p>}
      {syncFeedback && (
        <div role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Progress Bar Card */}
      <div className="rounded-lg bg-[var(--wp-surface-subtle)] p-4 border border-[var(--wp-border)] space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-[var(--wp-text)]">
            Checklist Completion Progress
          </span>
          <span className="font-semibold text-[var(--wp-text)]">
            {progress.completedTasks} of {progress.totalTasks} tasks verified ({progress.percentComplete}%)
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E8EAED]">
          <div
            className={`h-full transition-all duration-300 ${
              progress.percentComplete === 100 ? 'bg-emerald-500' : 'bg-[var(--tenant-primary)]'
            }`}
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--wp-text-muted)] pt-1">
          <span>{progress.verifiedCount} Verified</span>
          <span>{progress.submittedCount} Awaiting Review</span>
          <span>{progress.pendingCount} Pending</span>
          {progress.waivedCount > 0 && <span>{progress.waivedCount} Waived</span>}
          {progress.rejectedCount > 0 && (
            <span className="text-rose-600 font-semibold">{progress.rejectedCount} Revision Needed</span>
          )}
        </div>
      </div>

      {/* SECTION A: PRE-EMPLOYMENT INSTITUTIONAL CREDENTIALS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Pre-Employment Institutional Credentials
            </h4>
            <p className="text-xs text-slate-500">
              Credentials verified from recruitment submissions, government identification, and medical clearance.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {preEmploymentTasks.filter((t) => t.status === OnboardingTaskStatus.VERIFIED || t.status === OnboardingTaskStatus.WAIVED).length} of {preEmploymentTasks.length} Cleared
          </span>
        </div>

        <div className="space-y-2.5">
          {preEmploymentTasks.map(renderTaskItem)}
        </div>
      </div>

      {/* SECTION B: INSTITUTIONAL ONBOARDING & INDUCTION ACTIVITIES */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-[var(--tenant-primary)]" />
              Institutional Onboarding & Induction Activities
            </h4>
            <p className="text-xs text-slate-500">
              Contract execution, institutional IT provisioning, campus access credentials, and rules & policies briefing.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {activityTasks.filter((t) => t.status === OnboardingTaskStatus.VERIFIED || t.status === OnboardingTaskStatus.WAIVED).length} of {activityTasks.length} Completed
          </span>
        </div>

        <div className="space-y-2.5">
          {activityTasks.map(renderTaskItem)}
        </div>
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
