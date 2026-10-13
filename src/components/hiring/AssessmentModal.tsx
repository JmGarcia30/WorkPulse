'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AssessmentType } from '@prisma/client';
import { createAssessmentAction } from '@/features/hiring/assessment-actions';
import { ASSESSMENT_TYPE_CONFIG } from '@/features/hiring/assessment-pipeline';
import { X, Award, AlertCircle, Calendar } from 'lucide-react';

interface AssessmentModalProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  evaluators: Array<{ id: string; name: string; role: string }>;
  isOpen: boolean;
  onClose: () => void;
}

export function AssessmentModal({
  applicationId,
  candidateName,
  jobTitle,
  evaluators,
  isOpen,
  onClose,
}: AssessmentModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<AssessmentType>(AssessmentType.TECHNICAL);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [passingScore, setPassingScore] = useState('75');
  const [evaluatorId, setEvaluatorId] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createAssessmentAction({
        applicationId,
        title,
        type,
        description: description || undefined,
        dueDate: dueDate || undefined,
        maxScore: maxScore ? Number(maxScore) : 100,
        passingScore: passingScore ? Number(passingScore) : 75,
        evaluatorId: evaluatorId || undefined,
      });

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setError('An unexpected error occurred while assigning the assessment.');
      setLoading(false);
    }
  }

  return (
    <DialogFrame label="Assign assessment" onClose={onClose} busy={loading}>
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-[var(--wp-text)] flex items-center gap-2">
              <Award className="h-5 w-5 text-[var(--wp-text)]" />
              Assign Pre-Employment Assessment
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Candidate: <span className="font-semibold text-slate-700">{candidateName}</span> ({jobTitle})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose} aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          {/* Assessment Title */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Assessment Title *
            </label>
            <input aria-label="Assessment Title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior High Physics Demonstration & Pedagogy Exam"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            />
          </div>

          {/* Assessment Type & Evaluator Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Assessment Type *
              </label>
              <select aria-label="Assessment Type"
                value={type}
                onChange={(e) => setType(e.target.value as AssessmentType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              >
                {Object.values(AssessmentType).map((t) => (
                  <option key={t} value={t}>
                    {ASSESSMENT_TYPE_CONFIG[t].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Designated Evaluator
              </label>
              <select aria-label="Designated Evaluator"
                value={evaluatorId}
                onChange={(e) => setEvaluatorId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              >
                <option value="">Unassigned / Open Evaluation</option>
                {evaluators.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Max Score & Passing Score */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Maximum Score (Points) *
              </label>
              <input aria-label="Maximum Score (Points)"
                type="number"
                min="1"
                max="1000"
                required
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Passing Score Threshold *
              </label>
              <input aria-label="Passing Score Threshold"
                type="number"
                min="0"
                max={maxScore || 100}
                required
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" /> Due Date (Optional)
            </label>
            <input aria-label="Due Date (Optional)"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            />
          </div>

          {/* Instructions / Description */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Instructions & Assessment Details
            </label>
            <textarea aria-label="Instructions & Assessment Details"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide instructions, project brief, or submission expectations for this assessment..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-[var(--tenant-primary)] px-4 py-2 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 disabled:opacity-50 transition"
            >
              {loading ? 'Assigning...' : 'Assign Assessment'}
            </button>
          </div>
        </form>
      </div>
    </DialogFrame>
  );
}
