'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

import React, { useState } from 'react';
import { FileText, Eye, Download, X, ExternalLink } from 'lucide-react';

interface ResumePreviewModalProps {
  documentId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export function ResumePreviewModal({
  documentId,
  fileName,
  fileSize,
  fileType,
}: ResumePreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isPdf = fileType === 'application/pdf';
  const resumeUrl = `/api/resumes/${documentId}`;

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] p-4 hover:border-[#181A1C]/30 transition-colors">
        <div className="flex items-center gap-3 min-w-0 pr-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)]">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 truncate">
            <p className="text-sm font-bold text-[var(--wp-text)] truncate">
              {fileName}
            </p>
            <p className="text-xs text-[var(--wp-text-muted)] mt-0.5">
              {(fileSize / 1024).toFixed(1)} KB • {isPdf ? 'PDF Document' : 'Word Document'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isPdf && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--wp-border)] bg-white px-3 py-1.5 text-sm font-bold text-[var(--wp-text)] hover:bg-[#F4F5F7] transition-colors"
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          )}

          <a
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={fileName}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--tenant-primary)] px-3.5 py-1.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      </div>

      {/* Interactive In-App PDF Preview Dialog */}
      {isOpen && (
        <DialogFrame label="Resume preview" onClose={() => setIsOpen(false)} className="wp-dialog-wide">
          <div className="relative flex flex-col w-full max-w-5xl h-[90vh] rounded-lg bg-white shadow-2xl border border-[var(--wp-border)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--wp-border)] bg-[var(--wp-surface-subtle)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)]">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[var(--wp-text)] truncate">
                    {fileName}
                  </h3>
                  <p className="text-xs text-[var(--wp-text-muted)]">
                    Candidate Resume Preview • {(fileSize / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-[#E8EAED]/60 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>

                <a
                  href={resumeUrl}
                  download={fileName}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--tenant-primary)] px-3.5 py-1.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-md text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-[#E8EAED]/60 transition-colors"
                  title="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Embedded PDF Viewer */}
            <div className="flex-1 bg-[var(--wp-surface-subtle)] p-2">
              <iframe
                src={`${resumeUrl}#toolbar=1&navpanes=0`}
                className="w-full h-full rounded-lg border border-[var(--wp-border)] bg-white"
                title="Resume Preview"
              />
            </div>
          </div>
        </DialogFrame>
      )}
    </>
  );
}
