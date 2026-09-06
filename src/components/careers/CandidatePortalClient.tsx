'use client';

import React, { useState, useTransition } from 'react';
import {
  RecruitmentDocumentType,
  RecruitmentDocumentStatus,
  EmploymentCategory,
  OnboardingTaskStatus,
  OnboardingTaskType,
} from '@prisma/client';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Sparkles,
  HelpCircle,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Info,
  Eye,
  Download,
  GraduationCap,
  Briefcase,
  Layers,
} from 'lucide-react';
import {
  submitCandidateRecruitmentDocumentAction,
  submitCandidateOnboardingDocumentAction,
} from '@/features/careers/portal-actions';

interface PortalDocument {
  id: string;
  type: RecruitmentDocumentType;
  title: string;
  status: RecruitmentDocumentStatus;
  isRequired: boolean;
  isConditional: boolean;
  notes?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  storageKey?: string | null;
  verifiedAt?: Date | string | null;
}

interface PortalOnboardingTask {
  id: string;
  title: string;
  description?: string | null;
  type: OnboardingTaskType;
  status: OnboardingTaskStatus;
  isRequired: boolean;
  fileName?: string | null;
  fileSize?: number | null;
  storageKey?: string | null;
  reviewerNotes?: string | null;
  dueDate?: Date | string | null;
}

interface CandidatePortalClientProps {
  organizationSlug: string;
  applicationId: string;
  initialDocuments: PortalDocument[];
  category: EmploymentCategory;
  applicantName: string;
  jobTitle: string;
  orgName: string;
  onboarding?: {
    id: string;
    status: string;
    tasks: PortalOnboardingTask[];
  } | null;
}

export function CandidatePortalClient({
  organizationSlug,
  applicationId,
  initialDocuments,
  category,
  applicantName,
  jobTitle,
  orgName,
  onboarding,
}: CandidatePortalClientProps) {
  const [activeTab, setActiveTab] = useState<'recruitment' | 'onboarding'>(
    onboarding ? 'onboarding' : 'recruitment'
  );

  const [documents, setDocuments] = useState<PortalDocument[]>(initialDocuments);
  const [onboardingTasks, setOnboardingTasks] = useState<PortalOnboardingTask[]>(
    onboarding?.tasks || []
  );

  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rejectedDocs = documents.filter((d) => d.status === RecruitmentDocumentStatus.REJECTED);
  const verifiedDocs = documents.filter((d) => d.status === RecruitmentDocumentStatus.VERIFIED);
  const mandatoryDocs = documents.filter((d) => d.isRequired && !d.isConditional);
  const mandatoryVerified = mandatoryDocs.filter((d) => d.status === RecruitmentDocumentStatus.VERIFIED);

  // Recruitment Document Upload Handler
  const handleRecruitmentUpload = (documentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadingDocId(documentId);

    const formData = new FormData();
    formData.append('file', file);

    startTransition(async () => {
      const result = await submitCandidateRecruitmentDocumentAction(
        organizationSlug,
        applicationId,
        documentId,
        formData
      );

      setUploadingDocId(null);

      if (result.error) {
        setErrorMessage(result.error);
      } else {
        setSuccessMessage(`"${file.name}" uploaded successfully! Document is now submitted for department review.`);
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === documentId
              ? {
                  ...d,
                  status: RecruitmentDocumentStatus.SUBMITTED,
                  fileName: file.name,
                  fileSize: file.size,
                }
              : d
          )
        );
      }

      e.target.value = '';
      setTimeout(() => setSuccessMessage(null), 5000);
    });
  };

  // Onboarding Requirement Upload Handler
  const handleOnboardingUpload = (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadingDocId(taskId);

    const formData = new FormData();
    formData.append('file', file);

    startTransition(async () => {
      const result = await submitCandidateOnboardingDocumentAction(
        organizationSlug,
        applicationId,
        taskId,
        formData
      );

      setUploadingDocId(null);

      if (result.error) {
        setErrorMessage(result.error);
      } else {
        setSuccessMessage(`"${file.name}" uploaded successfully! Requirement submitted for HR verification.`);
        setOnboardingTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: OnboardingTaskStatus.SUBMITTED,
                  fileName: file.name,
                  fileSize: file.size,
                }
              : t
          )
        );
      }

      e.target.value = '';
      setTimeout(() => setSuccessMessage(null), 5000);
    });
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification Messages */}
      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/60 dark:text-rose-200 flex items-start gap-3 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <p className="font-bold">Upload Error</p>
            <p className="text-[11px] font-normal mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-200 flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="font-bold">Upload Successful</p>
            <p className="text-[11px] font-normal mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs: Recruitment Documents vs Onboarding Requirements */}
      {onboarding && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('onboarding')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === 'onboarding'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Pre-Employment & Onboarding Checklist</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
              {onboardingTasks.filter((t) => t.status === OnboardingTaskStatus.VERIFIED).length}/{onboardingTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recruitment')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === 'recruitment'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Recruitment Documents (Step 1)</span>
            <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[10px]">
              {mandatoryVerified.length}/{mandatoryDocs.length}
            </span>
          </button>
        </div>
      )}

      {/* TAB 1: RECRUITMENT DOCUMENTS */}
      {activeTab === 'recruitment' && (
        <div className="space-y-6">
          {/* Prominent Status Notification Banners */}
          {rejectedDocs.length > 0 ? (
            <div className="rounded-3xl border-2 border-rose-500/40 bg-rose-50/90 p-6 dark:border-rose-900 dark:bg-rose-950/40 space-y-3 shadow-sm">
              <div className="flex items-center gap-2.5 text-rose-800 dark:text-rose-300">
                <AlertTriangle className="h-5 w-5 text-rose-600 animate-pulse" />
                <h3 className="text-sm font-extrabold uppercase tracking-wide">
                  Action Required: {rejectedDocs.length} Document(s) Require Re-upload
                </h3>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                The Head of the Department has reviewed your credential submission. Certain documents could not be accepted (e.g. blurry photos, unreadable grades, or missing pages). Please inspect the reviewer notes below and re-upload clear replacements.
              </p>
            </div>
          ) : mandatoryVerified.length === mandatoryDocs.length && mandatoryDocs.length > 0 ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 dark:border-emerald-900 dark:bg-emerald-950/40 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-extrabold">All Mandatory SAGA Requirements Verified</h3>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Your credentials have been authenticated by the Head of the Department. You are eligible to proceed to the next hiring evaluation stages.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5 dark:border-blue-900/50 dark:bg-blue-950/30 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Submission Progress: {mandatoryVerified.length} of {mandatoryDocs.length} Mandatory Verified</p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300">
                  Upload clear PDF, JPG, or PNG scans of your original documents. Our department evaluators verify submissions regularly.
                </p>
              </div>
            </div>
          )}

          {/* Guidelines Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>SAGA Document Clarity & Authentication Guidelines</span>
            </div>
            <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
              <li>Ensure all scanned pages are complete, straight, and high-resolution (300 DPI recommended).</li>
              <li>Official Transcript of Records (TOR) must show the school dry seal or official registrar signature.</li>
              <li>LET Board Licensure must clearly show the PRC license number and expiration date.</li>
            </ul>
          </div>

          {/* Interactive Document Checklist */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Required SAGA Document Checklist
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {verifiedDocs.length} of {documents.length} verified
              </span>
            </div>

            <div className="space-y-3">
              {documents.map((doc) => {
                const isVerified = doc.status === RecruitmentDocumentStatus.VERIFIED;
                const isSubmitted = doc.status === RecruitmentDocumentStatus.SUBMITTED;
                const isRejected = doc.status === RecruitmentDocumentStatus.REJECTED;
                const isPendingDoc = doc.status === RecruitmentDocumentStatus.PENDING;
                const isNA = doc.status === RecruitmentDocumentStatus.NOT_APPLICABLE;

                return (
                  <div
                    key={doc.id}
                    className={`rounded-2xl border p-5 transition-all shadow-xs ${
                      isRejected
                        ? 'border-rose-300 bg-rose-50/40 dark:border-rose-800 dark:bg-rose-950/20 ring-1 ring-rose-500/20'
                        : isVerified
                        ? 'border-emerald-200 bg-emerald-50/20 dark:border-emerald-900/60 dark:bg-emerald-950/10'
                        : isSubmitted
                        ? 'border-blue-200 bg-blue-50/20 dark:border-blue-900/60 dark:bg-blue-950/10'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-2 max-w-xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {doc.title}
                          </h4>

                          {doc.isRequired && !doc.isConditional ? (
                            <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                              MANDATORY
                            </span>
                          ) : (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              CONDITIONAL
                            </span>
                          )}

                          {isVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> VERIFIED
                            </span>
                          )}
                          {isSubmitted && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              <Clock className="h-3 w-3" /> UNDER REVIEW
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse">
                              <AlertTriangle className="h-3 w-3" /> RE-UPLOAD REQUESTED
                            </span>
                          )}
                          {isPendingDoc && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              AWAITING UPLOAD
                            </span>
                          )}
                          {isNA && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                              NOT APPLICABLE / WAIVED
                            </span>
                          )}
                        </div>

                        {isRejected && doc.notes && (
                          <div className="rounded-xl border border-rose-300 bg-rose-100/70 p-3 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200 space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-rose-950 dark:text-rose-100">
                              <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                              <span>Reviewer Feedback / Rejection Note:</span>
                            </div>
                            <p className="text-[11px] leading-relaxed italic">&ldquo;{doc.notes}&rdquo;</p>
                          </div>
                        )}

                        {!isRejected && doc.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{doc.notes}</p>
                        )}

                        {doc.fileName && (
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-700 dark:text-slate-300 font-medium pt-1">
                            <FileCheck2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate max-w-[260px]">Uploaded: {doc.fileName}</span>
                            {doc.fileSize && (
                              <span className="text-slate-400">({(doc.fileSize / 1024).toFixed(1)} KB)</span>
                            )}
                            <a
                              href={`/api/recruitment-documents/${doc.id}?appId=${applicationId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold underline underline-offset-2 ml-1"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View / Download</span>
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center">
                        {!isVerified && !isNA && (
                          <label
                            className={`cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-xs ${
                              isRejected
                                ? 'bg-rose-600 text-white hover:bg-rose-700 ring-2 ring-rose-500/50'
                                : isSubmitted
                                ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                : 'bg-indigo-600 text-white hover:bg-indigo-500'
                            } ${uploadingDocId === doc.id || isPending ? 'opacity-60 pointer-events-none' : ''}`}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>
                              {uploadingDocId === doc.id
                                ? 'Uploading...'
                                : isRejected
                                ? 'Re-upload Document'
                                : isSubmitted
                                ? 'Replace File'
                                : 'Upload Document'}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                              className="hidden"
                              onChange={(e) => handleRecruitmentUpload(doc.id, e)}
                              disabled={uploadingDocId === doc.id || isPending}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRE-EMPLOYMENT & ONBOARDING REQUIREMENTS */}
      {activeTab === 'onboarding' && onboarding && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5 dark:border-indigo-900/50 dark:bg-indigo-950/30 flex items-start gap-3 text-xs text-indigo-950 dark:text-indigo-200">
            <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">SAGA Pre-Employment & Onboarding Requirements</p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                Congratulations on your appointment! Please submit your pre-employment statutory requirements (Government numbers and Medical fit-to-work clearance) below. Credentials previously submitted during recruitment are automatically recognized.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Pre-Employment Onboarding Checklist
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {onboardingTasks.filter((t) => t.status === OnboardingTaskStatus.VERIFIED).length} of {onboardingTasks.length} cleared
              </span>
            </div>

            <div className="space-y-3">
              {onboardingTasks.map((task) => {
                const isVerified = task.status === OnboardingTaskStatus.VERIFIED;
                const isSubmitted = task.status === OnboardingTaskStatus.SUBMITTED;
                const isRejected = task.status === OnboardingTaskStatus.REJECTED;
                const isPendingTask = task.status === OnboardingTaskStatus.PENDING || task.status === OnboardingTaskStatus.IN_PROGRESS;
                const isWaived = task.status === OnboardingTaskStatus.WAIVED;
                const isDocumentTask = task.type === OnboardingTaskType.DOCUMENT;
                const isAutoCarried = Boolean(task.reviewerNotes?.includes('Auto-verified from verified SAGA Recruitment'));

                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-5 transition-all shadow-xs ${
                      isRejected
                        ? 'border-rose-300 bg-rose-50/40 dark:border-rose-800 dark:bg-rose-950/20 ring-1 ring-rose-500/20'
                        : isVerified
                        ? 'border-emerald-200 bg-emerald-50/20 dark:border-emerald-900/60 dark:bg-emerald-950/10'
                        : isSubmitted
                        ? 'border-blue-200 bg-blue-50/20 dark:border-blue-900/60 dark:bg-blue-950/10'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-2 max-w-xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {task.title}
                          </h4>

                          {task.isRequired ? (
                            <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                              MANDATORY
                            </span>
                          ) : (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              CONDITIONAL
                            </span>
                          )}

                          {isVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> VERIFIED
                            </span>
                          )}
                          {isSubmitted && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              <Clock className="h-3 w-3" /> AWAITING REVIEW
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse">
                              <AlertTriangle className="h-3 w-3" /> REVISION NEEDED
                            </span>
                          )}
                          {isPendingTask && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              {isDocumentTask ? 'AWAITING UPLOAD' : 'IN PROGRESS'}
                            </span>
                          )}
                          {isWaived && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                              WAIVED
                            </span>
                          )}

                          {isAutoCarried && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20">
                              <ShieldCheck className="h-3 w-3" />
                              Carried from Recruitment
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {task.reviewerNotes && (
                          <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-100 dark:border-slate-800">
                            <span className="font-semibold text-slate-900 dark:text-slate-200">Review Note:</span> {task.reviewerNotes}
                          </div>
                        )}

                        {task.fileName && (
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-700 dark:text-slate-300 font-medium pt-1">
                            <FileCheck2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate max-w-[260px]">Attached: {task.fileName}</span>
                            {task.fileSize && (
                              <span className="text-slate-400">({(task.fileSize / 1024).toFixed(1)} KB)</span>
                            )}
                            {task.storageKey && (
                              <a
                                href={`/api/onboarding-documents/${task.id}?appId=${applicationId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold underline underline-offset-2 ml-1"
                              >
                                <Eye className="h-3 w-3" />
                                <span>View / Download</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Candidate Action */}
                      <div className="shrink-0 flex items-center">
                        {isDocumentTask && !isVerified && !isWaived ? (
                          <label
                            className={`cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-xs ${
                              isRejected
                                ? 'bg-rose-600 text-white hover:bg-rose-700 ring-2 ring-rose-500/50'
                                : isSubmitted
                                ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                : 'bg-indigo-600 text-white hover:bg-indigo-500'
                            } ${uploadingDocId === task.id || isPending ? 'opacity-60 pointer-events-none' : ''}`}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>
                              {uploadingDocId === task.id
                                ? 'Uploading...'
                                : isRejected
                                ? 'Re-upload Document'
                                : isSubmitted
                                ? 'Replace File'
                                : 'Upload Document'}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                              className="hidden"
                              onChange={(e) => handleOnboardingUpload(task.id, e)}
                              disabled={uploadingDocId === task.id || isPending}
                            />
                          </label>
                        ) : isVerified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Requirement Cleared</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
