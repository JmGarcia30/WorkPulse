'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitAssessmentResultAction } from '@/features/hiring/assessment-actions';
import { X, Award, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface AssessmentResultModalProps {
  assessment: {
    id: string;
    title: string;
    type: string;
    maxScore: number | null;
    passingScore: number | null;
    score: number | null;
    reviewerNotes: string | null;
  };
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AssessmentResultModal({
  assessment,
  candidateName,
  isOpen,
  onClose,
}: AssessmentResultModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialMax = assessment.maxScore ?? 100;
  const initialPass = assessment.passingScore ?? 75;

  const [score, setScore] = useState(assessment.score !== null ? String(assessment.score) : '');
  const [maxScore, setMaxScore] = useState(String(initialMax));
  const [passingScore, setPassingScore] = useState(String(initialPass));
  const [reviewerNotes, setReviewerNotes] = useState(assessment.reviewerNotes || '');

  if (!isOpen) return null;

  const numScore = score !== '' ? Number(score) : NaN;
  const numMax = Number(maxScore) || 100;
  const numPass = Number(passingScore) || 75;
  const isScoreValid = !isNaN(numScore) && numScore >= 0 && numScore <= numMax;
  const calculatedStatus = isScoreValid
    ? numScore >= numPass
      ? 'PASSED'
      : 'FAILED'
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isNaN(numScore) || numScore < 0) {
      setError('Score must be a valid non-negative number.');
      return;
    }

    if (numScore > numMax) {
      setError(`Score cannot exceed the maximum score (${numMax}).`);
      return;
    }

    setLoading(true);

    try {
      const res = await submitAssessmentResultAction(assessment.id, {
        score: numScore,
        maxScore: numMax,
        passingScore: numPass,
        reviewerNotes: reviewerNotes || undefined,
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
      setError('An unexpected error occurred while saving assessment results.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Record Assessment Result
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Candidate: <span className="font-semibold text-slate-700 dark:text-slate-300">{candidateName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="mt-3 rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{assessment.title}</p>
          <p className="text-[11px] text-slate-500 capitalize">{assessment.type.replace('_', ' ')} Assessment</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Score Input & Live Preview */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Candidate Score *
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max={numMax}
                required
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="e.g. 88.5"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Passing Threshold
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max={numMax}
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Outcome Indicator */}
          {calculatedStatus && (
            <div
              className={`flex items-center justify-between rounded-xl p-3 border ${
                calculatedStatus === 'PASSED'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-900 dark:text-emerald-300'
                  : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {calculatedStatus === 'PASSED' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                )}
                <div>
                  <span className="font-bold text-xs">Outcome: {calculatedStatus}</span>
                  <p className="text-[11px] opacity-80">
                    {numScore} / {numMax} pts (Required: {numPass} pts)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reviewer Notes */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reviewer Notes / Feedback
            </label>
            <textarea
              rows={3}
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="Candidate demonstrated strong skills in..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isScoreValid}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition shadow-sm"
            >
              {loading ? 'Submitting...' : 'Save Result & Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
