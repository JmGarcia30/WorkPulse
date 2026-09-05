'use client';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${typeConfig.badgeBg} ${typeConfig.badgeText}`}
            >
              {typeConfig.label}
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 leading-snug">
              Submit: {task.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E8EAED] dark:border-slate-700 bg-[#F8F9FA] dark:bg-slate-800/30 p-6 text-center hover:border-[#181A1C] transition cursor-pointer"
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
                <div className="mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 p-3 text-emerald-600 dark:text-emerald-400 w-12 h-12 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold text-[#181A1C] dark:text-slate-100 truncate max-w-[250px]">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-[#9CA3AF]">
                  {Math.round(selectedFile.size / 1024)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="mx-auto rounded-full bg-white border border-[#E8EAED] dark:bg-slate-800 p-3 text-[#181A1C] dark:text-slate-200 w-12 h-12 flex items-center justify-center shadow-2xs">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold text-[#181A1C] dark:text-slate-300">
                  Click to select file or document
                </p>
                <p className="text-[10px] text-[#9CA3AF]">
                  Supports PDF, DOCX, PNG, JPG (up to 10MB)
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8EAED] dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E8EAED] dark:border-slate-700 px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#181A1C] hover:bg-[#F8F9FA] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#181A1C] px-4 py-2 text-xs font-bold text-white hover:bg-[#2A2E33] transition shadow-2xs disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Submit Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
