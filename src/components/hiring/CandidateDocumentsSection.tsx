'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import {
  RecruitmentDocumentType,
  RecruitmentDocumentStatus,
  EmploymentCategory,
} from '@prisma/client';
import {
  FileText,
  CheckCircle2,
  Upload,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  MoreHorizontal,
  Ban,
  Download,
  RotateCcw,
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
  organizationSlug: string;
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

function getDocumentDisplayTitle(title: string, type: RecruitmentDocumentType): string {
  switch (type) {
    case RecruitmentDocumentType.LET_BASIC_EDUCATION:
      return 'Licensure Examination for Teachers (LET)';
    case RecruitmentDocumentType.DIPLOMA:
      return 'Diploma';
    case RecruitmentDocumentType.MARRIAGE_CONTRACT:
      return 'Marriage Contract (if applicable)';
    default:
      return title;
  }
}

function getDocumentSubtitle(type: RecruitmentDocumentType, fallbackNotes?: string | null): string {
  switch (type) {
    case RecruitmentDocumentType.RESUME_APPLICATION_LETTER:
      return 'Cover letter and updated resume';
    case RecruitmentDocumentType.TRANSCRIPT_OF_RECORDS:
      return 'Official transcript';
    case RecruitmentDocumentType.DIPLOMA:
      return 'Photocopy of diploma';
    case RecruitmentDocumentType.LET_BASIC_EDUCATION:
      return 'Photocopy of PRC license (if applicable)';
    case RecruitmentDocumentType.PROFESSIONAL_LICENSE:
      return 'Photocopy of valid PRC license';
    case RecruitmentDocumentType.NBI_CLEARANCE:
      return 'Clearance copy';
    case RecruitmentDocumentType.MARRIAGE_CONTRACT:
      return 'For married applicants';
    case RecruitmentDocumentType.PREVIOUS_EMPLOYMENT_CERT:
      return 'Certificate from previous employer';
    case RecruitmentDocumentType.RECOMMENDATION_LETTER_1:
      return 'First letter of recommendation';
    case RecruitmentDocumentType.RECOMMENDATION_LETTER_2:
      return 'Second letter of recommendation';
    case RecruitmentDocumentType.RECOMMENDATION_LETTER_3:
      return 'Third letter of recommendation';
    case RecruitmentDocumentType.OTHER:
      return 'Additional institutional requirements';
    default:
      return fallbackNotes || 'Official credential copy';
  }
}

export function CandidateDocumentsSection({
  applicationId,
  category,
  documents,
  canManage,
}: CandidateDocumentsSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);

  // Modal State for Rejecting / Flagging Blurry Documents
  const [rejectingDoc, setRejectingDoc] = useState<RecruitmentDocItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close overflow menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuDocId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const evaluation = areRecruitmentDocumentsSatisfied(documents, category);

  const handleVerify = (documentId: string) => {
    setActiveMenuDocId(null);
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
    setActiveMenuDocId(null);
    setRejectingDoc(doc);
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
          text: 'Document rejected. Notification email sent to applicant with resubmission instructions.',
        });
      }
      setTimeout(() => setFeedbackMessage(null), 5000);
    });
  };

  const handleStatusChange = (documentId: string, status: RecruitmentDocumentStatus) => {
    setActiveMenuDocId(null);
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

    setActiveMenuDocId(null);
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
        setFeedbackMessage({ type: 'success', text: 'Recruitment document requirements initialized.' });
      }
      setTimeout(() => setFeedbackMessage(null), 3000);
    });
  };

  // Find first pending doc to trigger with header Upload button
  const firstPendingDoc = documents.find(
    (d) => d.status === RecruitmentDocumentStatus.PENDING || d.status === RecruitmentDocumentStatus.REJECTED
  );

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
      {/* Clean Header matching target reference */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Documents & Requirements
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {evaluation.satisfiedMandatoryCount} of {evaluation.mandatoryCount} Mandatory Verified
          </p>
        </div>

        {canManage && firstPendingDoc && (
          <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer shadow-2xs">
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            <span>Upload Document</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => handleFileUpload(firstPendingDoc.id, e)}
              disabled={isPending || uploadingDocId === firstPendingDoc.id}
            />
          </label>
        )}
      </div>

      {/* Feedback Message Banner */}
      {feedbackMessage && (
        <div
          className={`rounded-xl border p-3 text-xs sm:text-sm flex items-center gap-2 ${
            feedbackMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
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

      {/* Empty State */}
      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          <p>No document checklist records initialized for this candidate.</p>
          {canManage && (
            <button
              type="button"
              onClick={handleInitialize}
              disabled={isPending}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Load Document Requirements
            </button>
          )}
        </div>
      ) : (
        /* Document Checklist Rows */
        <div className="divide-y divide-slate-100" ref={menuRef}>
          {documents.map((doc) => {
            const isVerified = doc.status === RecruitmentDocumentStatus.VERIFIED;
            const isSubmitted = doc.status === RecruitmentDocumentStatus.SUBMITTED;
            const isRejected = doc.status === RecruitmentDocumentStatus.REJECTED;
            const isNA = doc.status === RecruitmentDocumentStatus.NOT_APPLICABLE;
            const hasFile = Boolean(doc.fileName);

            const displayTitle = getDocumentDisplayTitle(doc.title, doc.type);
            const subtitle = getDocumentSubtitle(doc.type, doc.notes);

            // Minimalist badge configuration matching target image
            let badgeLabel = 'Pending';
            let badgeBg = 'bg-amber-50 text-amber-700 border-amber-200/50';
            let dotColor = 'bg-amber-500';

            if (isVerified) {
              badgeLabel = 'Completed';
              badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
              dotColor = 'bg-emerald-500';
            } else if (isSubmitted) {
              badgeLabel = 'Submitted';
              badgeBg = 'bg-blue-50 text-blue-700 border-blue-200/50';
              dotColor = 'bg-blue-500';
            } else if (isRejected) {
              badgeLabel = 'Action Required';
              badgeBg = 'bg-rose-50 text-rose-700 border-rose-200/50';
              dotColor = 'bg-rose-500';
            } else if (isNA || (!doc.isRequired && doc.isConditional)) {
              badgeLabel = 'Optional';
              badgeBg = 'bg-slate-100 text-slate-600 border-slate-200/50';
              dotColor = 'bg-slate-400';
            }

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 sm:gap-4 py-3.5 first:pt-1 last:pb-1 group"
              >
                {/* Left Side: Warm Icon Box & Titles */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Warm Ivory Document Box Icon matching target */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F5EE] border border-slate-200/70 text-slate-700 shadow-2xs">
                    <FileText className="h-5 w-5 stroke-[1.75]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {displayTitle}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
                      {subtitle}
                    </p>
                  </div>
                </div>

                {/* Right Side: Status Badge, Primary Action Button & Overflow Menu */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  {/* Status Badge with dot matching reference */}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badgeBg}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                    <span>{badgeLabel}</span>
                  </span>

                  {/* Primary Action Button (View or Upload) */}
                  {hasFile ? (
                    <a
                      href={`/api/recruitment-documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center min-w-[72px] sm:min-w-[80px] rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
                    >
                      View
                    </a>
                  ) : canManage ? (
                    <label className="cursor-pointer inline-flex items-center justify-center min-w-[72px] sm:min-w-[80px] rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs">
                      <span>{uploadingDocId === doc.id ? '...' : 'Upload'}</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(doc.id, e)}
                        disabled={isPending || uploadingDocId === doc.id}
                      />
                    </label>
                  ) : (
                    <span className="min-w-[72px] text-center text-xs text-slate-400">
                      Pending
                    </span>
                  )}

                  {/* Overflow Action Menu (•••) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {/* Dropdown Options */}
                    {activeMenuDocId === doc.id && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-slate-200/80 bg-white p-1 shadow-lg z-30 space-y-0.5 text-xs">
                        {hasFile && (
                          <a
                            href={`/api/recruitment-documents/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 font-medium"
                          >
                            <Download className="h-3.5 w-3.5 text-slate-400" />
                            <span>Download File</span>
                          </a>
                        )}

                        {canManage && (
                          <label className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer">
                            <Upload className="h-3.5 w-3.5 text-slate-400" />
                            <span>{hasFile ? 'Replace File' : 'Upload File'}</span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileUpload(doc.id, e)}
                              disabled={isPending || uploadingDocId === doc.id}
                            />
                          </label>
                        )}

                        {canManage && !isVerified && (
                          <button
                            type="button"
                            onClick={() => handleVerify(doc.id)}
                            disabled={isPending}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-emerald-700 hover:bg-emerald-50 font-semibold"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Verify Document</span>
                          </button>
                        )}

                        {canManage && !isNA && (
                          <button
                            type="button"
                            onClick={() => handleOpenRejectModal(doc)}
                            disabled={isPending}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-rose-700 hover:bg-rose-50 font-semibold"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                            <span>{isRejected ? 'Edit Rejection Note' : 'Flag / Reject'}</span>
                          </button>
                        )}

                        {canManage && doc.isConditional && (
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
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 font-medium"
                          >
                            {isNA ? (
                              <>
                                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                                <span>Mark as Required</span>
                              </>
                            ) : (
                              <>
                                <Ban className="h-3.5 w-3.5 text-slate-400" />
                                <span>Mark as Not Applicable</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* File Details / Verified Metadata */}
                        {doc.fileName && (
                          <div className="pt-1 mt-1 border-t border-slate-100 px-2.5 py-1 text-[11px] text-slate-400">
                            <p className="truncate font-medium text-slate-600">{doc.fileName}</p>
                            {doc.fileSize && (
                              <p>{(doc.fileSize / 1024).toFixed(1)} KB</p>
                            )}
                            {doc.verifiedBy && (
                              <p className="text-emerald-700 mt-0.5">Verified by {doc.verifiedBy.name}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HR Rejection Modal */}
      {rejectingDoc && (
        <DialogFrame label="Reject recruitment document" onClose={() => setRejectingDoc(null)} busy={isPending}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Flag / Reject Document
                  </h3>
                  <p className="text-xs text-slate-500">
                    {rejectingDoc.title}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Flagging this document marks it as <strong>Action Required</strong>. The candidate will be notified to re-upload a compliant copy.
            </p>

            {/* Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Common Rejection Reasons
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {REJECTION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setRejectionReason(preset.reason)}
                    className="text-left rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition"
                  >
                    <span className="font-semibold block">{preset.label}</span>
                    <span className="text-[11px] text-slate-500 line-clamp-1">{preset.reason}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Instructions for Applicant
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Explain what needs to be fixed..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectingDoc(null)}
                disabled={isPending}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isPending || !rejectionReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {isPending ? 'Submitting...' : 'Reject & Notify Applicant'}
              </button>
            </div>
          </div>
        </DialogFrame>
      )}
    </div>
  );
}
