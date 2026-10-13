'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingTaskType } from '@prisma/client';
import { TASK_TYPE_CONFIG } from '@/features/hiring/onboarding-pipeline';
import { uploadOnboardingTaskDocumentAction } from '@/features/hiring/onboarding-actions';
import { X, UploadCloud, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

interface TaskUploadModalProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    type: OnboardingTaskType;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingTaskUploadModal({
  task,
  isOpen,
  onClose,
}: TaskUploadModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const typeConfig = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.OTHER;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await uploadOnboardingTaskDocumentAction(task.id, formData);
      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
        onClose();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'An error occurred during file upload.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DialogFrame label="Upload onboarding document" onClose={onClose} busy={isUploading}>
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${typeConfig.badgeBg} ${typeConfig.badgeText}`}
            >
              {typeConfig.label}
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-1 leading-snug">
              Submit: {task.title}
            </h3>
          </div>
          <button
            onClick={onClose} aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] p-6 text-center hover:border-[#181A1C] transition cursor-pointer"
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              className="hidden"
            />
            {selectedFile ? (
              <div className="space-y-1">
                <div className="mx-auto rounded-full bg-emerald-100 p-3 text-emerald-600 w-12 h-12 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-[var(--wp-text)] truncate max-w-[250px]">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-[var(--wp-text-muted)]">
                  {Math.round(selectedFile.size / 1024)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="mx-auto rounded-full bg-white border border-[var(--wp-border)] p-3 text-[var(--wp-text)] w-12 h-12 flex items-center justify-center">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-[var(--wp-text)]">
                  Click to select file or document
                </p>
                <p className="text-xs text-[var(--wp-text-muted)]">
                  Supports PDF, DOCX, PNG, JPG (up to 10MB)
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--wp-border)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--wp-border)] px-4 py-2 text-sm font-semibold text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-[#F8F9FA] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--tenant-primary)] px-4 py-2 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Submit Document'}
            </button>
          </div>
        </form>
      </div>
    </DialogFrame>
  );
}
