import {
  History,
  UserCheck,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Award,
  AlertTriangle,
  FileText,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import {
  ApplicationStatus,
  InterviewType,
  InterviewStatus,
  EvaluationRecommendation,
  AssessmentStatus,
  AssessmentType,
  OfferStatus,
  PayFrequency,
} from '@prisma/client';
import { PAY_FREQUENCY_CONFIG } from '@/features/hiring/offer-pipeline';

export interface TimelineHistoryItem {
  id: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  createdAt: Date | string;
  changedBy: {
    name: string;
    role: string;
  };
}

export interface TimelineInterviewItem {
  id: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  interviewer: {
    name: string;
    role: string;
  };
  evaluation?: {
    overallScore: number;
    recommendation: EvaluationRecommendation;
    createdAt: Date | string;
    evaluatedBy: {
      name: string;
    };
  } | null;
}

export interface TimelineAssessmentItem {
  id: string;
  title: string;
  type: AssessmentType;
  status: AssessmentStatus;
  score: number | null;
  maxScore: number | null;
  passingScore: number | null;
  createdAt: Date | string;
  evaluatedAt: Date | string | null;
  evaluator?: {
    name: string;
  } | null;
}

export interface TimelineOfferItem {
  id: string;
  salary: number;
  payFrequency: PayFrequency;
  employmentType: string;
  status: OfferStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: {
    name: string;
  };
  approvedBy?: {
    name: string;
  } | null;
}

export interface TimelineOnboardingItem {
  id: string;
  status: string;
  startDate: Date | string;
  completedAt?: Date | string | null;
  createdAt: Date | string;
}

interface ApplicationTimelineProps {
  initialStatus: ApplicationStatus;
  appliedAt: Date | string;
  history: TimelineHistoryItem[];
  interviews?: TimelineInterviewItem[];
  assessments?: TimelineAssessmentItem[];
  offers?: TimelineOfferItem[];
  onboarding?: TimelineOnboardingItem | null;
}

type UnifiedTimelineEvent =
  | {
      kind: 'INITIAL_APPLIED';
      timestamp: Date;
      status: ApplicationStatus;
    }
  | {
      kind: 'STATUS_TRANSITION';
      id: string;
      timestamp: Date;
      fromStatus: ApplicationStatus;
      toStatus: ApplicationStatus;
      changedBy: { name: string; role: string };
    }
  | {
      kind: 'INTERVIEW_SCHEDULED';
      id: string;
      timestamp: Date;
      scheduledAt: Date;
      type: InterviewType;
      interviewer: { name: string; role: string };
    }
  | {
      kind: 'INTERVIEW_STATUS';
      id: string;
      timestamp: Date;
      status: InterviewStatus;
      type: InterviewType;
      interviewer: { name: string; role: string };
    }
  | {
      kind: 'EVALUATION_SUBMITTED';
      id: string;
      timestamp: Date;
      overallScore: number;
      recommendation: EvaluationRecommendation;
      evaluatedBy: { name: string };
    }
  | {
      kind: 'ASSESSMENT_ASSIGNED';
      id: string;
      timestamp: Date;
      title: string;
      type: AssessmentType;
      evaluatorName?: string;
    }
  | {
      kind: 'ASSESSMENT_RESULT';
      id: string;
      timestamp: Date;
      title: string;
      status: AssessmentStatus;
      score: number;
      maxScore: number;
      evaluatorName?: string;
    }
  | {
      kind: 'OFFER_CREATED';
      id: string;
      timestamp: Date;
      salary: number;
      payFrequency: PayFrequency;
      status: OfferStatus;
      createdByName: string;
    }
  | {
      kind: 'OFFER_STATUS';
      id: string;
      timestamp: Date;
      status: OfferStatus;
      approvedByName?: string;
    }
  | {
      kind: 'ONBOARDING_INITIALIZED';
      id: string;
      timestamp: Date;
      startDate: Date;
    }
  | {
      kind: 'ONBOARDING_COMPLETED';
      id: string;
      timestamp: Date;
    };

export function ApplicationTimeline({
  initialStatus,
  appliedAt,
  history,
  interviews = [],
  assessments = [],
  offers = [],
  onboarding = null,
}: ApplicationTimelineProps) {
  // Assemble presentation-only unified timeline
  const events: UnifiedTimelineEvent[] = [
    {
      kind: 'INITIAL_APPLIED',
      timestamp: new Date(appliedAt),
      status: initialStatus,
    },
  ];

  for (const h of history) {
    events.push({
      kind: 'STATUS_TRANSITION',
      id: h.id,
      timestamp: new Date(h.createdAt),
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedBy: h.changedBy,
    });
  }

  for (const iv of interviews) {
    events.push({
      kind: 'INTERVIEW_SCHEDULED',
      id: `sched-${iv.id}`,
      timestamp: new Date(iv.createdAt),
      scheduledAt: new Date(iv.scheduledAt),
      type: iv.type,
      interviewer: iv.interviewer,
    });

    if (
      iv.status === InterviewStatus.COMPLETED ||
      iv.status === InterviewStatus.CANCELLED ||
      iv.status === InterviewStatus.NO_SHOW
    ) {
      events.push({
        kind: 'INTERVIEW_STATUS',
        id: `status-${iv.id}`,
        timestamp: new Date(iv.updatedAt),
        status: iv.status,
        type: iv.type,
        interviewer: iv.interviewer,
      });
    }

    if (iv.evaluation) {
      events.push({
        kind: 'EVALUATION_SUBMITTED',
        id: `eval-${iv.id}`,
        timestamp: new Date(iv.evaluation.createdAt),
        overallScore: iv.evaluation.overallScore,
        recommendation: iv.evaluation.recommendation,
        evaluatedBy: iv.evaluation.evaluatedBy,
      });
    }
  }

  for (const a of assessments) {
    events.push({
      kind: 'ASSESSMENT_ASSIGNED',
      id: `ass-assign-${a.id}`,
      timestamp: new Date(a.createdAt),
      title: a.title,
      type: a.type,
      evaluatorName: a.evaluator?.name,
    });

    if (
      (a.status === AssessmentStatus.PASSED || a.status === AssessmentStatus.FAILED) &&
      a.score !== null &&
      a.evaluatedAt
    ) {
      events.push({
        kind: 'ASSESSMENT_RESULT',
        id: `ass-result-${a.id}`,
        timestamp: new Date(a.evaluatedAt),
        title: a.title,
        status: a.status,
        score: a.score,
        maxScore: a.maxScore ?? 100,
        evaluatorName: a.evaluator?.name,
      });
    }
  }

  for (const off of offers) {
    events.push({
      kind: 'OFFER_CREATED',
      id: `off-create-${off.id}`,
      timestamp: new Date(off.createdAt),
      salary: off.salary,
      payFrequency: off.payFrequency,
      status: off.status,
      createdByName: off.createdBy.name,
    });

    if (off.status !== OfferStatus.DRAFT && new Date(off.updatedAt) > new Date(off.createdAt)) {
      events.push({
        kind: 'OFFER_STATUS',
        id: `off-status-${off.id}`,
        timestamp: new Date(off.updatedAt),
        status: off.status,
        approvedByName: off.approvedBy?.name,
      });
    }
  }

  if (onboarding) {
    events.push({
      kind: 'ONBOARDING_INITIALIZED',
      id: `onb-init-${onboarding.id}`,
      timestamp: new Date(onboarding.createdAt),
      startDate: new Date(onboarding.startDate),
    });

    if (onboarding.status === 'COMPLETED' && onboarding.completedAt) {
      events.push({
        kind: 'ONBOARDING_COMPLETED',
        id: `onb-done-${onboarding.id}`,
        timestamp: new Date(onboarding.completedAt),
      });
    }
  }

  // Sort chronologically ascending
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider dark:text-slate-400 flex items-center gap-2">
          <History className="h-4 w-4 text-[#181A1C] dark:text-white" /> Candidate Activity & Audit Timeline
        </h3>
        <span className="text-[10px] font-bold text-[#181A1C] dark:text-slate-200 bg-[#F8F9FA] border border-[#E8EAED] dark:bg-slate-800 px-2 py-0.5 rounded-lg">
          {events.length} Timeline Events
        </span>
      </div>

      <div className="relative pl-5 space-y-5 border-l-2 border-[#E8EAED] dark:border-slate-800 ml-2">
        {events.map((event) => {
          if (event.kind === 'INITIAL_APPLIED') {
            return (
              <div key="initial" className="relative space-y-1">
                <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#181A1C] shadow-xs dark:border-slate-900 dark:bg-white" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#181A1C] dark:text-slate-100">
                    Application Created ({ApplicationStatus.APPLIED})
                  </span>
                  <span className="rounded-md bg-[#F8F9FA] border border-[#E8EAED] px-1.5 py-0.5 text-[9px] font-bold text-[#181A1C] dark:bg-slate-800 dark:text-slate-300">
                    Initial Submission
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Submitted by candidate on {event.timestamp.toLocaleString()}
                </p>
              </div>
            );
          }

          if (event.kind === 'STATUS_TRANSITION') {
            return (
              <div key={event.id} className="relative space-y-1">
                <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-600 shadow-xs dark:border-slate-900 dark:bg-emerald-400" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    ATS Stage Transition: <span className="text-slate-500 line-through">{event.fromStatus}</span> →{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{event.toStatus}</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <UserCheck className="h-3 w-3 text-slate-400" /> Updated by {event.changedBy.name} ({event.changedBy.role.replace('_', ' ')}) on{' '}
                  {event.timestamp.toLocaleString()}
                </p>
              </div>
            );
          }

          if (event.kind === 'INTERVIEW_SCHEDULED') {
            return (
              <div key={event.id} className="relative space-y-1">
                <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#181A1C] shadow-xs dark:border-slate-900 dark:bg-white" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#181A1C] dark:text-slate-100">
                    Interview Scheduled: {event.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-[#181A1C] dark:text-slate-300" /> Scheduled for {event.scheduledAt.toLocaleString()} with {event.interviewer.name}
                </p>
              </div>
            );
          }

          if (event.kind === 'INTERVIEW_STATUS') {
            const isCompleted = event.status === InterviewStatus.COMPLETED;
            const isCancelled = event.status === InterviewStatus.CANCELLED;
            return (
              <div key={event.id} className="relative space-y-1">
                <div
                  className={`absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs dark:border-slate-900 ${
                    isCompleted
                      ? 'bg-emerald-600 dark:bg-emerald-400'
                      : isCancelled
                      ? 'bg-slate-400'
                      : 'bg-rose-500'
                  }`}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Interview {event.status.replace('_', ' ')}: {event.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  {isCompleted ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : isCancelled ? (
                    <XCircle className="h-3 w-3 text-slate-400" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-rose-500" />
                  )}
                  Interview with {event.interviewer.name} recorded as {event.status} on {event.timestamp.toLocaleString()}
                </p>
              </div>
            );
          }

          if (event.kind === 'EVALUATION_SUBMITTED') {
            return (
              <div key={event.id} className="relative space-y-1">
                <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-purple-600 shadow-xs dark:border-slate-900 dark:bg-purple-400" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Interview Evaluation Submitted: {event.overallScore.toFixed(1)} / 5.0 ({event.recommendation.replace('_', ' ')})
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Award className="h-3 w-3 text-purple-500" /> Evaluated by {event.evaluatedBy.name} on {event.timestamp.toLocaleString()}
                </p>
              </div>
            );
          }

          if (event.kind === 'ASSESSMENT_ASSIGNED') {
            return (
              <div key={event.id} className="relative space-y-1">
                <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#181A1C] shadow-xs dark:border-slate-900 dark:bg-white" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#181A1C] dark:text-slate-100">
                    Assessment Assigned: {event.title} ({event.type})
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 flex items-center gap-1">
                  <Award className="h-3 w-3 text-[#181A1C] dark:text-slate-300" /> Assigned on {event.timestamp.toLocaleString()}
                  {event.evaluatorName ? ` • Reviewer: ${event.evaluatorName}` : ''}
                </p>
              </div>
            );
          }

          if (event.kind === 'ASSESSMENT_RESULT') {
            const isPassed = event.status === AssessmentStatus.PASSED;
            return (
              <div key={event.id} className="relative space-y-1">
                <div
                  className={`absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs dark:border-slate-900 ${
                    isPassed ? 'bg-emerald-600' : 'bg-rose-500'
                  }`}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Assessment Outcome: {event.status} ({event.score} / {event.maxScore} pts)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  {isPassed ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-rose-500" />
                  )}
                  {event.title} result finalized on {event.timestamp.toLocaleString()}
                  {event.evaluatorName ? ` by ${event.evaluatorName}` : ''}
                </p>
              </div>
            );
          }

          if (event.kind === 'OFFER_CREATED') {
            const freqCfg = PAY_FREQUENCY_CONFIG[event.payFrequency];
            return (
              <div key={event.id} className="relative space-y-1">
                <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#181A1C] shadow-xs dark:border-slate-900 dark:bg-white" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#181A1C] dark:text-slate-100">
                    Offer Package Prepared: ₱{event.salary.toLocaleString()}{freqCfg.suffix} ({event.status})
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-[#181A1C] dark:text-slate-300" /> Created by {event.createdByName} on {event.timestamp.toLocaleString()}
                </p>
              </div>
            );
          }

          if (event.kind === 'OFFER_STATUS') {
            const isAccepted = event.status === OfferStatus.ACCEPTED;
            return (
              <div key={event.id} className="relative space-y-1">
                <div
                  className={`absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs dark:border-slate-900 ${
                    isAccepted ? 'bg-emerald-600' : 'bg-[#181A1C]'
                  }`}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#181A1C] dark:text-slate-100">
                    Offer Stage Updated: {event.status}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 flex items-center gap-1">
                  <FileText className="h-3 w-3 text-[#181A1C] dark:text-slate-300" /> Status modified on {event.timestamp.toLocaleString()}
                  {event.approvedByName ? ` • Approved by ${event.approvedByName}` : ''}
                </p>
              </div>
            );
          }

          if (event.kind === 'ONBOARDING_INITIALIZED') {
            return (
              <div key={event.id} className="relative space-y-1">
                <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#181A1C] shadow-xs dark:border-slate-900 dark:bg-white" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#181A1C] dark:text-slate-100">
                    Employee Onboarding Checklist Initialized
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 flex items-center gap-1">
                  <UserCheck className="h-3 w-3 text-[#181A1C] dark:text-slate-300" /> Checklist generated for start date on {event.startDate.toLocaleDateString()}
                </p>
              </div>
            );
          }

          if (event.kind === 'ONBOARDING_COMPLETED') {
            return (
              <div key={event.id} className="relative space-y-1">
                <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-600 shadow-xs dark:border-slate-900 dark:bg-emerald-400" />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Onboarding 100% Completed & Verified
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> All required pre-employment documents verified on {event.timestamp.toLocaleString()}
                </p>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

