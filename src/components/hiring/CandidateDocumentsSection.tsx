'use client';

import React, { useState, useTransition } from 'react';
import {
  RecruitmentDocumentType,
  RecruitmentDocumentStatus,
  EmploymentCategory,
} from '@prisma/client';
import {
  FileText,
  CheckCircle2,
  Clock,
  Ban,
  Upload,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';
import {
  verifyRecruitmentDocumentAction,
  rejectRecruitmentDocumentAction,
  updateRecruitmentDocumentStatusAction,
  uploadRecruitmentDocumentAction,
  initializeRecruitmentDocumentsAction,
} from '@/features/hiring/recruitment-document-actions';
import { areRecruitmentDocumentsSatisfied } from '@/features/hiring/saga-requirements';

interface RecruitmentDocItem {
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
  verifiedBy?: { name: string } | null;
}

interface CandidateDocumentsSectionProps {
  applicationId: string;
  category: EmploymentCategory;
  documents: RecruitmentDocItem[];
  canManage: boolean;
  organizationSlug?: string;
}

const REJECTION_PRESETS = [
  {
    label: 'Blurry / Illegible Scan',
    reason:
      'The photo/scan is blurry or illegible. Please re-upload a clear, high-resolution copy with all text, grades, and official seals readable.',
  },
  {
    label: 'Missing Pages / Incomplete TOR',
    reason:
      'Incomplete pages. All pages of your Transcript of Records must be provided in sequence in a single high-quality PDF.',
  },
  {
    label: 'Incorrect Document Type',
    reason:
      'The uploaded document does not correspond to the requested requirement. Please verify the requirement and upload the correct official credential.',
  },
  {
    label: 'Expired / Unauthenticated Copy',
    reason:
      'Document appears expired or unauthenticated. Please provide a valid, recent certified copy from the issuing authority.',
  },
];

export function CandidateDocumentsSection({
  applicationId,
  category,
  documents,
  canManage,
  organizationSlug = 'st-aloysius',
}: CandidateDocumentsSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  // Modal State for Rejecting / Flagging Blurry Documents
  const [rejectingDoc, setRejectingDoc] = useState<RecruitmentDocItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const evaluation = areRecruitmentDocumentsSatisfied(documents, category);

  const handleVerify = (documentId: string) => {
    startTransition(async () => {
      const res = await verifyRecruitmentDocumentAction(documentId);
      if (res.error) {
        setFeedbackMessage({ type: 'error', text: res.error });
      } else {
        setFeedbackMessage({ type: 'success', text: 'Document verified and notification sent to applicant.' });
      }
      setTimeout(() => setFeedbackMessage(null), 4000);
    });
  };

  const handleOpenRejectModal = (doc: RecruitmentDocItem) => {
    setRejectingDoc(doc);
    // Pre-populate with default blurry reason if not already specified
    setRejectionReason(
      doc.notes && doc.status === RecruitmentDocumentStatus.REJECTED
        ? doc.notes
        : REJECTION_PRESETS[0].reason
    );
  };

  const handleConfirmReject = () => {
    if (!rejectingDoc) return;

    startTransition(async () => {
      const res = await rejectRecruitmentDocumentAction(rejectingDoc.id, rejectionReason);
      setRejectingDoc(null);
      if (res.error) {
        setFeedbackMessage({ type: 'error', text: res.error });
      } else {
        setFeedbackMessage({
          type: 'success',
          text: `Document rejected as requested. Notification email sent to applicant with resubmission instructions.`,
        });
      }
      setTimeout(() => setFeedbackMessage(null), 5000);
    });
  };

  const handleStatusChange = (documentId: string, status: RecruitmentDocumentStatus) => {
    startTransition(async () => {
      const res = await updateRecruitmentDocumentStatusAction(documentId, status);
      if (res.error) {
        setFeedbackMessage({ type: 'error', text: res.error });
      } else {
        setFeedbackMessage({ type: 'success', text: 'Document status updated.' });
      }
      setTimeout(() => setFeedbackMessage(null), 3000);
    });
  };

  const handleFileUpload = (documentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocId(documentId);
    const formData = new FormData();
    formData.append('file', file);

    startTransition(async () => {
      const res = await uploadRecruitmentDocumentAction(documentId, formData);
      setUploadingDocId(null);
      if (res.error) {
        setFeedbackMessage({ type: 'error', text: res.error });
      } else {
        setFeedbackMessage({ type: 'success', text: 'Document uploaded successfully.' });
      }
      setTimeout(() => setFeedbackMessage(null), 3000);
    });
  };

  const handleInitialize = () => {
    startTransition(async () => {
      const res = await initializeRecruitmentDocumentsAction(applicationId);
      if (res.error) {
        setFeedbackMessage({ type: 'error', text: res.error });
      } else {
        setFeedbackMessage({ type: 'success', text: 'SAGA recruitment document requirements initialized.' });
      }
      setTimeout(() => setFeedbackMessage(null), 3000);
    });
  };

  return (
    <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E8EAED] dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#181A1C] dark:text-white" />
            <h3 className="text-xs font-bold text-[#181A1C] uppercase tracking-wider dark:text-slate-100">
              SAGA Recruitment Document Requirements
            </h3>
          </div>
          <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-0.5">
            Submitted to the <span className="font-semibold text-slate-700 dark:text-slate-200">Head of the Department</span> for {category === 'TEACHING' ? 'Faculty' : 'Non-Teaching'} hiring.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Candidate Portal Public Link */}
          <a
            href={`/careers/${organizationSlug}/portal/${applicationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
          >
            <span>Candidate Portal</span>
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>

          {documents.length === 0 ? (
            canManage && (
              <button
                type="button"
                onClick={handleInitialize}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#181A1C] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2A2E33] transition disabled:opacity-50"
              >
                Initialize Checklist
              </button>
            )
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                evaluation.isSatisfied
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 ring-1 ring-emerald-500/20'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-500/20'
              }`}
            >
              {evaluation.isSatisfied ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Requirements Satisfied</span>
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {evaluation.satisfiedMandatoryCount} of {evaluation.mandatoryCount} Mandatory Verified
                  </span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`rounded-2xl border p-3 text-xs flex items-center gap-2 ${
            feedbackMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/60 dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/60 dark:text-rose-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Document Items List */}
      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E8EAED] p-8 text-center text-xs text-[#6B7280] dark:border-slate-800">
          <p>No document checklist records initialized for this candidate.</p>
          {canManage && (
            <button
              type="button"
              onClick={handleInitialize}
              disabled={isPending}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#181A1C] px-4 py-2 text-xs font-bold text-white hover:bg-[#2A2E33] transition"
            >
              Load SAGA Document Requirements
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[#E8EAED] dark:divide-slate-800">
          {documents.map((doc) => {
            const isVerified = doc.status === RecruitmentDocumentStatus.VERIFIED;
            const isSubmitted = doc.status === RecruitmentDocumentStatus.SUBMITTED;
            const isRejected = doc.status === RecruitmentDocumentStatus.REJECTED;
            const isNA = doc.status === RecruitmentDocumentStatus.NOT_APPLICABLE;
            const isPendingDoc = doc.status === RecruitmentDocumentStatus.PENDING;

            return (
              <div
                key={doc.id}
                className={`py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                  isRejected ? 'bg-rose-50/30 dark:bg-rose-950/10 px-2 rounded-xl' : ''
                }`}
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#181A1C] dark:text-slate-100">
                      {doc.title}
                    </span>
                    {doc.isRequired && !doc.isConditional ? (
                      <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                        REQUIRED
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        CONDITIONAL
                      </span>
                    )}

                    {/* Status Badge */}
                    {isVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </span>
                    )}
                    {isSubmitted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        <Clock className="h-3 w-3" /> Submitted
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        <AlertTriangle className="h-3 w-3" /> Rejected / Action Required
                      </span>
                    )}
                    {isNA && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <Ban className="h-3 w-3" /> Not Applicable / Waived
                      </span>
                    )}
                    {isPendingDoc && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        ○ Awaiting Submission
                      </span>
                    )}
                  </div>

                  {/* If Rejected, display reason prominently */}
                  {isRejected && doc.notes && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                      <span className="font-bold">Rejection Note: </span>
                      <span className="italic">{doc.notes}</span>
                    </div>
                  )}

                  {!isRejected && doc.notes && (
                    <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                      {doc.notes}
                    </p>
                  )}

                  {doc.fileName && (
                    <div className="flex items-center gap-2 text-[11px] text-[#181A1C] dark:text-slate-300 font-medium">
                      <span className="truncate max-w-[280px]">File: {doc.fileName}</span>
                      {doc.fileSize && (
                        <span className="text-[#9CA3AF]">({(doc.fileSize / 1024).toFixed(1)} KB)</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {/* Upload button (HR override) */}
                    <label className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-[#E8EAED] bg-[#F8F9FA] px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                      <Upload className="h-3 w-3" />
                      <span>{uploadingDocId === doc.id ? 'Uploading...' : 'Scan / Upload'}</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(doc.id, e)}
                        disabled={isPending || uploadingDocId === doc.id}
                      />
                    </label>

                    {/* Verify button */}
                    {!isVerified && (
                      <button
                        type="button"
                        onClick={() => handleVerify(doc.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50 shadow-xs"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        <span>Verify</span>
                      </button>
                    )}

                    {/* Reject / Flag Button (Blurry scan, incomplete, etc.) */}
                    {!isNA && (
                      <button
                        type="button"
                        onClick={() => handleOpenRejectModal(doc)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-300"
                        title="Flag or reject blurry/illegible document"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span>{isRejected ? 'Edit Note' : 'Flag / Reject'}</span>
                      </button>
                    )}

                    {/* Conditional Toggle (N/A) */}
                    {doc.isConditional && (
                      <button
                        type="button"
                        onClick={() =>
                          handleStatusChange(
                            doc.id,
                            isNA
                              ? RecruitmentDocumentStatus.PENDING
                              : RecruitmentDocumentStatus.NOT_APPLICABLE
                          )
                        }
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                      >
                        {isNA ? 'Re-enable' : 'Mark N/A'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* HR Rejection Modal */}
      {rejectingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Flag / Reject Document
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-sm">
                    {rejectingDoc.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectingDoc(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Select a standard rejection reason or provide specific feedback. An email notification will be dispatched to the candidate with instructions to re-upload via their portal:
              </p>

              {/* Quick Preset Reason Chips */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Quick Institutional Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {REJECTION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setRejectionReason(preset.reason)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Reviewer Feedback Note
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. The photo/scan is blurry or illegible. Please re-upload a clear copy..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-rose-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRejectingDoc(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isPending || !rejectionReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition disabled:opacity-50 shadow-sm"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Confirm Rejection & Notify Candidate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
