'use client';

import { useState } from 'react';
import { AssessmentStatus, AssessmentType } from '@prisma/client';
import {
  ASSESSMENT_STAGE_CONFIG,
  ASSESSMENT_TYPE_CONFIG,
} from '@/features/hiring/assessment-pipeline';
import { AssessmentModal } from './AssessmentModal';
import { AssessmentResultModal } from './AssessmentResultModal';
import {
  Award,
  Plus,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  FileEdit,
} from 'lucide-react';

export interface CandidateAssessmentItem {
  id: string;
  title: string;
  type: AssessmentType;
  description: string | null;
  dueDate: Date | string | null;
  status: AssessmentStatus;
  score: number | null;
  maxScore: number | null;
  passingScore: number | null;
  submittedAt: Date | string | null;
  evaluatedAt: Date | string | null;
  reviewerNotes: string | null;
  evaluator?: {
    id: string;
    name: string;
    role: string;
  } | null;
}

interface CandidateAssessmentsSectionProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  assessments: CandidateAssessmentItem[];
  organizationEvaluators: Array<{ id: string; name: string; role: string }>;
  canManage: boolean;
  canRecordResult: boolean;
}

export function CandidateAssessmentsSection({
  applicationId,
  candidateName,
  jobTitle,
  assessments,
  organizationEvaluators,
  canManage,
  canRecordResult,
}: CandidateAssessmentsSectionProps) {
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedAssessmentForScore, setSelectedAssessmentForScore] =
    useState<CandidateAssessmentItem | null>(null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400 flex items-center gap-2">
            <Award className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Pre-Employment Assessments
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Technical, skills, and cognitive evaluations
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsAssignOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Assign Assessment
          </button>
        )}
      </div>

      {/* Assessments List */}
      {assessments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
          <Award className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
          <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            No assessments assigned yet
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Assign technical challenges, behavioral tasks, or skill evaluations to this candidate.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => {
            const statusConfig = ASSESSMENT_STAGE_CONFIG[a.status];
            const typeConfig = ASSESSMENT_TYPE_CONFIG[a.type];
            const isTerminal =
              a.status === AssessmentStatus.PASSED ||
              a.status === AssessmentStatus.FAILED ||
              a.status === AssessmentStatus.EXPIRED ||
              a.status === AssessmentStatus.CANCELLED;

            return (
              <div
                key={a.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition dark:border-slate-800 dark:bg-slate-950/50 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {a.title}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${typeConfig.badgeBg} ${typeConfig.badgeText}`}
                      >
                        {typeConfig.label}
                      </span>
                    </div>

                    {a.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        {a.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-bold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
                    >
                      {statusConfig.label}
                    </span>

                    {canRecordResult && !isTerminal && (
                      <button
                        type="button"
                        onClick={() => setSelectedAssessmentForScore(a)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
                      >
                        <FileEdit className="h-3 w-3" /> Record Score
                      </button>
                    )}
                  </div>
                </div>

                {/* Score & Meta Bar */}
                <div className="grid gap-2 sm:grid-cols-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400">
                  {/* Score */}
                  <div className="flex items-center gap-1.5">
                    {a.score !== null ? (
                      <span className="flex items-center gap-1 font-bold text-xs">
                        {a.status === AssessmentStatus.PASSED ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-rose-600" />
                        )}
                        Score: {a.score} / {a.maxScore ?? 100} pts (Pass: {a.passingScore ?? 75})
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        Pass threshold: {a.passingScore ?? 75} / {a.maxScore ?? 100} pts
                      </span>
                    )}
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {a.dueDate
                        ? `Due: ${new Date(a.dueDate).toLocaleDateString()}`
                        : 'No due date'}
                    </span>
                  </div>

                  {/* Evaluator */}
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {a.evaluator ? `Evaluator: ${a.evaluator.name}` : 'Unassigned reviewer'}
                    </span>
                  </div>
                </div>

                {/* Reviewer Notes */}
                {a.reviewerNotes && (
                  <div className="rounded-lg bg-white p-3 border border-slate-100 dark:bg-slate-900 dark:border-slate-800 text-xs">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] mb-0.5">
                      Reviewer Feedback:
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 italic">
                      "{a.reviewerNotes}"
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Modal */}
      {isAssignOpen && (
        <AssessmentModal
          applicationId={applicationId}
          candidateName={candidateName}
          jobTitle={jobTitle}
          evaluators={organizationEvaluators}
          isOpen={isAssignOpen}
          onClose={() => setIsAssignOpen(false)}
        />
      )}

      {/* Record Score Modal */}
      {selectedAssessmentForScore && (
        <AssessmentResultModal
          assessment={selectedAssessmentForScore}
          candidateName={candidateName}
          isOpen={!!selectedAssessmentForScore}
          onClose={() => setSelectedAssessmentForScore(null)}
        />
      )}
    </div>
  );
}
