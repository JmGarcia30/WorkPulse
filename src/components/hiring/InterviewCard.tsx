'use client';

import React, { useState, useTransition } from 'react';
import {
  InterviewType,
  InterviewStatus,
  EvaluationRecommendation,
} from '@prisma/client';
import { updateInterviewStatusAction } from '@/features/hiring/interview-actions';
import { EvaluationModal } from './EvaluationModal';
import {
  Calendar,
  User,
  MapPin,
  Video,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Star,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface EvaluationData {
  id: string;
  overallScore: number;
  recommendation: EvaluationRecommendation;
  communicationScore: number;
  technicalScore: number;
  problemSolvingScore: number;
  experienceScore: number;
  cultureFitScore: number;
  comments: string;
  createdAt: Date;
  evaluatedBy: {
    id?: string;
    name: string;
    role: string;
  };
}

interface InterviewCardProps {
  interview: {
    id: string;
    type: InterviewType;
    status: InterviewStatus;
    scheduledAt: Date | string;
    durationMinutes: number;
    location: string | null;
    meetingUrl: string | null;
    notes: string | null;
    interviewer: {
      id: string;
      name: string;
      role: string;
    };
    evaluation: EvaluationData | null;
  };
  candidateName: string;
  canManage: boolean;
}

export function InterviewCard({
  interview,
  candidateName,
  canManage,
}: InterviewCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [expandedEval, setExpandedEval] = useState(false);

  const handleStatusChange = (status: InterviewStatus) => {
    startTransition(async () => {
      await updateInterviewStatusAction(interview.id, status);
    });
  };

  const statusBadge = () => {
    switch (interview.status) {
      case InterviewStatus.SCHEDULED:
        return (
          <span className="rounded-md bg-[#F8F9FA] border border-[#E8EAED] px-2.5 py-1 text-xs font-bold text-[#181A1C] dark:bg-slate-800 dark:text-slate-300">
            Scheduled
          </span>
        );
      case InterviewStatus.COMPLETED:
        return (
          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            Completed
          </span>
        );
      case InterviewStatus.CANCELLED:
        return (
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Cancelled
          </span>
        );
      case InterviewStatus.NO_SHOW:
        return (
          <span className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            No Show
          </span>
        );
      default:
        return null;
    }
  };

  const recBadge = (rec: EvaluationRecommendation) => {
    switch (rec) {
      case EvaluationRecommendation.STRONGLY_RECOMMEND:
        return (
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Strongly Recommend
          </span>
        );
      case EvaluationRecommendation.RECOMMEND:
        return (
          <span className="rounded-md bg-[#181A1C] px-2 py-0.5 text-[10px] font-extrabold text-white">
            Recommend
          </span>
        );
      case EvaluationRecommendation.MAYBE:
        return (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Maybe / Hold
          </span>
        );
      case EvaluationRecommendation.DO_NOT_RECOMMEND:
        return (
          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            Do Not Recommend
          </span>
        );
    }
  };

  const scheduledDate = new Date(interview.scheduledAt);

  return (
    <div className="rounded-2xl border border-[#E8EAED] bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8EAED] pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181A1C] text-white shrink-0 shadow-2xs">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#181A1C] dark:text-slate-100">
              {interview.type === InterviewType.HEAD_OF_DEPARTMENT
                ? 'Head of Department (HOD) Interview'
                : interview.type === InterviewType.PRESIDENT_FINAL
                ? 'President Final Interview'
                : interview.type === InterviewType.TEACHING_DEMONSTRATION
                ? 'Teaching Demonstration Evaluation'
                : interview.type.replaceAll('_', ' ')}
            </h4>
            <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
              {scheduledDate.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              at {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({interview.durationMinutes} mins)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {statusBadge()}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid gap-2.5 sm:grid-cols-2 text-xs text-[#6B7280] dark:text-slate-300">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" />
          <span>
            Interviewer: <strong className="text-[#181A1C] dark:text-slate-100">{interview.interviewer.name}</strong> ({interview.interviewer.role.replace('_', ' ')})
          </span>
        </div>

        {interview.location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" />
            <span>{interview.location}</span>
          </div>
        )}

        {interview.meetingUrl && (
          <div className="flex items-center gap-2 sm:col-span-2">
            <Video className="h-3.5 w-3.5 text-[#181A1C] dark:text-white shrink-0" />
            <a
              href={interview.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#181A1C] hover:underline flex items-center gap-1 truncate dark:text-slate-200"
            >
              {interview.meetingUrl} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {interview.notes && (
          <div className="sm:col-span-2 rounded-xl bg-[#F8F9FA] p-3 text-xs text-[#6B7280] dark:bg-slate-800/50">
            <span className="font-bold text-[#181A1C] dark:text-slate-200">Notes: </span>
            {interview.notes}
          </div>
        )}
      </div>

      {/* Action Controls for Scheduled Interviews */}
      {canManage && interview.status === InterviewStatus.SCHEDULED && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E8EAED] dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange(InterviewStatus.COMPLETED)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange(InterviewStatus.NO_SHOW)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8EAED] bg-white px-3 py-1.5 text-xs font-bold text-[#6B7280] hover:text-[#181A1C] hover:bg-[#F8F9FA] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> No Show
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange(InterviewStatus.CANCELLED)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400 transition"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowEvalModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#181A1C] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#2A2E33] transition shadow-2xs"
          >
            <Award className="h-3.5 w-3.5" /> Evaluate Candidate
          </button>
        </div>
      )}

      {/* Complete Interview without Evaluation Prompt */}
      {canManage && interview.status === InterviewStatus.COMPLETED && !interview.evaluation && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Interview completed! Candidate evaluation pending submission.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowEvalModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#181A1C] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#2A2E33] shrink-0 transition shadow-2xs"
          >
            + Submit Candidate Evaluation
          </button>
        </div>
      )}

      {/* Render Attached Evaluation Card if present */}
      {interview.evaluation && (
        <div className="rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] p-4 dark:border-slate-800 dark:bg-slate-950/30 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E8EAED] pb-2 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[#181A1C] dark:text-white" />
              <h5 className="font-bold text-xs text-[#181A1C] dark:text-slate-100">
                Official Interview Evaluation
              </h5>
              {recBadge(interview.evaluation.recommendation)}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-[#E8EAED] dark:border-slate-800 shadow-2xs">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-extrabold text-xs text-[#181A1C] dark:text-slate-200">
                  {interview.evaluation.overallScore.toFixed(1)} / 5.0
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedEval(!expandedEval)}
                className="text-[#9CA3AF] hover:text-[#181A1C] dark:hover:text-slate-200"
              >
                {expandedEval ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {expandedEval && (
            <div className="space-y-3 pt-1">
              {/* 5-Criteria Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className="rounded-xl bg-white p-2 border border-[#E8EAED] dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] text-[#6B7280] truncate font-medium">Communication</p>
                  <p className="font-bold text-[#181A1C] dark:text-white mt-0.5">
                    {interview.evaluation.communicationScore} / 5
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2 border border-[#E8EAED] dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] text-[#6B7280] truncate font-medium">Technical</p>
                  <p className="font-bold text-[#181A1C] dark:text-white mt-0.5">
                    {interview.evaluation.technicalScore} / 5
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2 border border-[#E8EAED] dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] text-[#6B7280] truncate font-medium">Problem Solving</p>
                  <p className="font-bold text-[#181A1C] dark:text-white mt-0.5">
                    {interview.evaluation.problemSolvingScore} / 5
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2 border border-[#E8EAED] dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] text-[#6B7280] truncate font-medium">Experience</p>
                  <p className="font-bold text-[#181A1C] dark:text-white mt-0.5">
                    {interview.evaluation.experienceScore} / 5
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2 border border-[#E8EAED] dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] text-[#6B7280] truncate font-medium">Culture Fit</p>
                  <p className="font-bold text-[#181A1C] dark:text-white mt-0.5">
                    {interview.evaluation.cultureFitScore} / 5
                  </p>
                </div>
              </div>

              {/* Feedback Comments */}
              <div className="rounded-xl bg-white p-3 text-xs border border-[#E8EAED] dark:border-slate-800 dark:bg-slate-900 text-[#181A1C] dark:text-slate-300">
                <p className="font-bold text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">
                  Evaluator Feedback & Assessment Comments:
                </p>
                <p className="whitespace-pre-line leading-relaxed">{interview.evaluation.comments}</p>
                <p className="mt-2 text-[10px] text-[#9CA3AF]">
                  Evaluated by {interview.evaluation.evaluatedBy.name} ({interview.evaluation.evaluatedBy.role.replace('_', ' ')}) on {new Date(interview.evaluation.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showEvalModal && (
        <EvaluationModal
          interviewId={interview.id}
          candidateName={candidateName}
          interviewType={interview.type}
          interviewerName={interview.interviewer.name}
          isOpen={showEvalModal}
          onClose={() => setShowEvalModal(false)}
        />
      )}
    </div>
  );
}
