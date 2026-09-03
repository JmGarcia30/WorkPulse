'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  X,
  AlertCircle,
  Send,
  Loader2,
} from 'lucide-react';

interface ApplicationFormProps {
  job: {
    id: string;
    slug: string;
    title: string;
  };
  org: {
    slug: string;
    name: string;
  };
  error?: string;
  action: (formData: FormData) => Promise<void>;
}

export function ApplicationForm({
  job,
  org,
  error: serverError,
  action,
}: ApplicationFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  const validateAndSetFile = (file: File | null) => {
    setFileError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const fileNameLower = file.name.toLowerCase();
    const isValidExt =
      fileNameLower.endsWith('.pdf') || fileNameLower.endsWith('.docx');

    if (!isValidExt) {
      setFileError(
        'Invalid file type. Please upload a PDF (.pdf) or Word document (.docx).'
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(
        `File size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller file.`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    validateAndSetFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0] || null;
    if (file) {
      validateAndSetFile(file);
      // Transfer to input
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
      }
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <form
      action={async (formData: FormData) => {
        setIsSubmitting(true);
        try {
          await action(formData);
        } catch {
          setIsSubmitting(false);
        }
      }}
      className="space-y-6"
    >
      <input type="hidden" name="jobId" value={job.id} />
      <input type="hidden" name="organizationSlug" value={org.slug} />
      <input type="hidden" name="jobSlug" value={job.slug} />

      {serverError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Personal Information */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 dark:text-slate-100 dark:border-slate-800">
          1. Personal Information
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              First Name *
            </label>
            <input
              type="text"
              name="firstName"
              required
              placeholder="e.g. Maria"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Last Name *
            </label>
            <input
              type="text"
              name="lastName"
              required
              placeholder="e.g. Santos"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="maria.santos@gmail.com"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              required
              placeholder="+63 917 123 4567"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Application Cover Letter */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 dark:text-slate-100 dark:border-slate-800">
          2. Cover Letter & Statement
        </h2>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Cover Letter *
          </label>
          <textarea
            name="coverLetter"
            required
            rows={5}
            placeholder="Introduce yourself and explain why you are an ideal candidate for this position..."
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Resume Upload */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 dark:text-slate-100 dark:border-slate-800">
          3. Resume / Curriculum Vitae Upload
        </h2>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Resume File (PDF, DOCX up to 5MB)
          </label>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            name="resume"
            id="resume-upload-input"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="sr-only"
          />

          {!selectedFile ? (
            /* Upload Dropzone */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/30 ring-4 ring-indigo-500/10'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-slate-800/30'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-3">
                <Upload className="h-6 w-6" />
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  Click to upload
                </span>
                <span> or drag and drop your file here</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Supported formats: PDF or DOCX (max 5MB)
              </p>
            </div>
          ) : (
            /* Selected File Preview Box */
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {selectedFile.name}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 shrink-0">
                        <CheckCircle2 className="h-3 w-3" /> Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatFileSize(selectedFile.size)} •{' '}
                      {selectedFile.name.toLowerCase().endsWith('.pdf')
                        ? 'PDF Document'
                        : 'Word Document'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                    title="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {fileError && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting
              Application...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Submit Application
            </>
          )}
        </button>
      </div>
    </form>
  );
}
