'use client';

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
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-950/40 hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors">
        <div className="flex items-center gap-3 min-w-0 pr-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 truncate">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
              {fileName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {(fileSize / 1024).toFixed(1)} KB • {isPdf ? 'PDF Document' : 'Word Document'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isPdf && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300 transition-colors shadow-2xs"
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          )}

          <a
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={fileName}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 shadow-sm transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      </div>

      {/* Interactive In-App PDF Preview Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 sm:p-6 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative flex flex-col w-full max-w-5xl h-[90vh] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {fileName}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Candidate Resume Preview • {(fileSize / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>

                <a
                  href={resumeUrl}
                  download={fileName}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                  title="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Embedded PDF Viewer */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2">
              <iframe
                src={`${resumeUrl}#toolbar=1&navpanes=0`}
                className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-800"
                title="Resume Preview"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
