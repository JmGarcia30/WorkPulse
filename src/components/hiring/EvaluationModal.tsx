'use client';

import { useState, useTransition } from 'react';
import { EvaluationRecommendation, InterviewType } from '@prisma/client';
import { createEvaluationAction } from '@/features/hiring/interview-actions';
import {
  X,
  Star,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
  Award,
  Sparkles,
} from 'lucide-react';

interface EvaluationModalProps {
  interviewId: string;
  candidateName: string;
  interviewType: InterviewType;
  interviewerName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EvaluationModal({
  interviewId,
  candidateName,
  interviewType,
  interviewerName,
  isOpen,
  onClose,
  onSuccess,
}: EvaluationModalProps) {
  const [communicationScore, setCommunicationScore] = useState(4);
  const [technicalScore, setTechnicalScore] = useState(4);
  const [problemSolvingScore, setProblemSolvingScore] = useState(4);
  const [experienceScore, setExperienceScore] = useState(4);
  const [cultureFitScore, setCultureFitScore] = useState(4);

  const [recommendation, setRecommendation] = useState<EvaluationRecommendation>(
    EvaluationRecommendation.RECOMMEND
  );
  const [comments, setComments] = useState('');

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  // Calculate live overall score
  const overallScore = (
    (communicationScore +
      technicalScore +
      problemSolvingScore +
      experienceScore +
      cultureFitScore) /
    5
  ).toFixed(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!comments.trim() || comments.trim().length < 5) {
      setError('Please provide meaningful evaluation comments (at least 5 characters).');
      return;
    }

    startTransition(async () => {
      const result = await createEvaluationAction({
        interviewId,
        communicationScore,
        technicalScore,
        problemSolvingScore,
        experienceScore,
        cultureFitScore,
        recommendation,
        comments: comments.trim(),
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 1000);
      }
    });
  };

  const renderScoreSelector = (
    label: string,
    description: string,
    value: number,
    setter: (val: number) => void
  ) => {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/60">
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{label}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {[1, 2, 3, 4, 5].map((num) => {
            const isSelected = value === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setter(num)}
                className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition ${
                  isSelected
                    ? 'bg-[#181A1C] text-white shadow-2xs'
                    : 'bg-white text-[#181A1C] hover:bg-[#F8F9FA] dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-[#E8EAED] dark:border-slate-700'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E8EAED] pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-[#181A1C] dark:text-slate-100 flex items-center gap-2">
              <Award className="h-5 w-5 text-[#181A1C] dark:text-white" />
              Candidate Interview Evaluation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Candidate: <span className="font-semibold text-[#181A1C] dark:text-slate-300">{candidateName}</span> • {interviewType} (Interviewer: {interviewerName})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Candidate evaluation recorded successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Live Overall Rating Badge */}
          <div className="flex items-center justify-between rounded-2xl bg-[#F8F9FA] p-3.5 border border-[#E8EAED] dark:bg-slate-950/40 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#181A1C] dark:text-white" />
              <span className="font-bold text-[#181A1C] dark:text-slate-100">
                Calculated Overall Score:
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="text-base font-extrabold text-[#181A1C] dark:text-slate-100">
                {overallScore} / 5.0
              </span>
            </div>
          </div>

          {/* Competency Scoring Breakdown */}
          <div className="space-y-2.5">
            <p className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
              Evaluation Competency Criteria (Scale: 1 Poor – 5 Excellent)
            </p>

            {renderScoreSelector(
              '1. Communication & Articulation',
              'Clarity, listening ability, professional demeanor, and structured responses.',
              communicationScore,
              setCommunicationScore
            )}

            {renderScoreSelector(
              '2. Technical & Domain Mastery',
              'Core subject expertise, pedagogical knowledge, tools, and technical proficiency.',
              technicalScore,
              setTechnicalScore
            )}

            {renderScoreSelector(
              '3. Problem Solving & Critical Thinking',
              'Analytical approach, handling complex classroom/technical scenarios.',
              problemSolvingScore,
              setProblemSolvingScore
            )}

            {renderScoreSelector(
              '4. Experience & Relevant Background',
              'Track record, depth of prior teaching or relevant industry work.',
              experienceScore,
              setExperienceScore
            )}

            {renderScoreSelector(
              '5. Institutional & Culture Fit',
              'Alignment with values, collaboration, student focus, and institutional ethos.',
              cultureFitScore,
              setCultureFitScore
            )}
          </div>

          {/* Recommendation */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Hiring Recommendation
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  val: EvaluationRecommendation.STRONGLY_RECOMMEND,
                  label: 'Strongly Recommend',
                  color: 'text-emerald-700 border-emerald-300 dark:text-emerald-300',
                },
                {
                  val: EvaluationRecommendation.RECOMMEND,
                  label: 'Recommend',
                  color: 'text-[#181A1C] border-[#E8EAED] dark:text-slate-100',
                },
                {
                  val: EvaluationRecommendation.MAYBE,
                  label: 'Maybe / Hold',
                  color: 'text-amber-700 border-amber-300 dark:text-amber-300',
                },
                {
                  val: EvaluationRecommendation.DO_NOT_RECOMMEND,
                  label: 'Do Not Recommend',
                  color: 'text-rose-700 border-rose-300 dark:text-rose-300',
                },
              ].map((item) => {
                const isSelected = recommendation === item.val;
                return (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setRecommendation(item.val)}
                    className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                      isSelected
                        ? 'bg-[#181A1C] text-white ring-2 ring-[#181A1C] dark:bg-white dark:text-[#181A1C]'
                        : 'bg-white text-[#6B7280] hover:text-[#181A1C] hover:bg-[#F8F9FA] dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Qualitative Comments */}
          <div>
            <label className="block font-bold text-[#181A1C] dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-[#9CA3AF]" /> Qualitative Feedback & Interview Notes
            </label>
            <textarea
              rows={4}
              required
              placeholder="Candidate strengths, areas for development, key interview observations..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full rounded-2xl border border-[#E8EAED] bg-white p-3 text-xs text-[#181A1C] focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8EAED] dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E8EAED] bg-white px-4 py-2.5 text-xs font-semibold text-[#6B7280] hover:text-[#181A1C] hover:bg-[#F8F9FA] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-[#181A1C] px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2A2E33] disabled:opacity-50 transition"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit Candidate Evaluation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
