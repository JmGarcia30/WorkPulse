'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingTaskType } from '@prisma/client';
import { createCustomOnboardingTaskAction } from '@/features/hiring/onboarding-actions';
import { X, Plus, AlertCircle } from 'lucide-react';

interface CustomTaskModalProps {
  onboardingProcessId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomOnboardingTaskModal({
  onboardingProcessId,
  isOpen,
  onClose,
}: CustomTaskModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OnboardingTaskType>(OnboardingTaskType.DOCUMENT);
  const [isRequired, setIsRequired] = useState(true);
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createCustomOnboardingTaskAction(onboardingProcessId, {
        title,
        description,
        type,
        isRequired,
        dueDate: dueDate ? dueDate : undefined,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
        onClose();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'An error occurred while creating task.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogFrame label="Add onboarding task" onClose={onClose} busy={isSubmitting}>
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            Add Custom Onboarding Requirement
          </h3>
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
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-slate-700">
              Task / Requirement Title *
            </label>
            <input aria-label="Task / Requirement Title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Laboratory Safety Clearance & Chemical Protocol"
              className="w-full rounded-md border border-[var(--wp-border)] bg-white px-3 py-2 text-sm text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-bold text-[var(--wp-text)]">
                Requirement Category
              </label>
              <select aria-label="Requirement Category"
                value={type}
                onChange={(e) => setType(e.target.value as OnboardingTaskType)}
                className="w-full rounded-md border border-[var(--wp-border)] bg-white px-3 py-2 text-sm text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:outline-none"
              >
                <option value={OnboardingTaskType.DOCUMENT}>Document Submission</option>
                <option value={OnboardingTaskType.ADMIN}>Administrative & IT</option>
                <option value={OnboardingTaskType.EQUIPMENT}>Equipment & Access</option>
                <option value={OnboardingTaskType.ORIENTATION}>Orientation / Meeting</option>
                <option value={OnboardingTaskType.OTHER}>Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-bold text-[var(--wp-text)]">
                Due Date
              </label>
              <input aria-label="Due Date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-[var(--wp-border)] bg-white px-3 py-2 text-sm text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-bold text-[var(--wp-text)]">
              Description & Instructions
            </label>
            <textarea aria-label="Description & Instructions"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide instructions for the employee or departmental reviewer..."
              rows={2}
              className="w-full rounded-md border border-[var(--wp-border)] bg-white px-3 py-2 text-sm text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isRequiredTask"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--wp-border)] text-[var(--wp-text)] focus:ring-[var(--tenant-accent)]"
            />
            <label
              htmlFor="isRequiredTask"
              className="text-sm text-[var(--wp-text)] font-semibold cursor-pointer"
            >
              Required item (blocks Onboarding completion until verified/waived)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--wp-border)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--wp-border)] px-4 py-2 text-sm font-semibold text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-[#F8F9FA] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--tenant-primary)] px-4 py-2 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Adding...' : 'Add Requirement'}</span>
            </button>
          </div>
        </form>
      </div>
    </DialogFrame>
  );
}
