'use client';

import React from 'react';
import { CandidateDocumentsSection } from './CandidateDocumentsSection';
import { FileText, Download } from 'lucide-react';
import { EmploymentCategory } from '@prisma/client';

type CandidateDocumentsProps = React.ComponentProps<typeof CandidateDocumentsSection>;

interface UploadedResumeDoc {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface ApplicantDocumentsTabProps {
  applicationId: string;
  category: EmploymentCategory | 'TEACHING' | 'NON_TEACHING';
  recruitmentDocuments: CandidateDocumentsProps['documents'];
  canManage: boolean;
  organizationSlug: string;
  uploadedResumes: UploadedResumeDoc[];
  coverLetter?: string | null;
}

export function ApplicantDocumentsTab({
  applicationId,
  category,
  recruitmentDocuments,
  canManage,
  organizationSlug,
  uploadedResumes,
  coverLetter,
}: ApplicantDocumentsTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. SAGA Document Requirements Checklist & Verification Hub */}
      <CandidateDocumentsSection
        applicationId={applicationId}
        category={category}
        documents={recruitmentDocuments}
        canManage={canManage}
        organizationSlug={organizationSlug}
      />

      {/* 2. Uploaded Resume Document Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <h3 className="text-base font-bold text-slate-900">
              Attached Resume Documents
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {uploadedResumes.length} file(s)
          </span>
        </div>

        {uploadedResumes.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No resume documents attached.</p>
        ) : (
          <div className="space-y-2.5">
            {uploadedResumes.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50/70 p-3.5 transition"
              >
                <div className="truncate pr-3 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(doc.fileSize / 1024).toFixed(1)} KB • {doc.fileType.split('/')[1] || 'document'}
                  </p>
                </div>

                <a
                  href={`/api/resumes/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition shrink-0 shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Cover Letter & Statement (if present) */}
      {coverLetter && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Cover Letter & Statement
            </h3>
            <span className="text-xs text-slate-400">Candidate Submission</span>
          </div>
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {coverLetter}
          </div>
        </div>
      )}
    </div>
  );
}
