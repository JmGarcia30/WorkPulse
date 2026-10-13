'use client';

import React from 'react';
import { ApplicationStatus, EmploymentCategory } from '@prisma/client';
import {
  FileText,
  Search,
  CheckCircle2,
  Calendar,
  ClipboardCheck,
  Award,
  BadgePercent,
  ListTodo,
  ShieldCheck,
  UserCheck,
  XCircle,
  GraduationCap,
  Users,
  Building,
} from 'lucide-react';

interface CandidateLifecycleStepperProps {
  currentStatus: ApplicationStatus;
  category?: EmploymentCategory | 'TEACHING' | 'NON_TEACHING';
  documentsSatisfied?: boolean;
  writtenExamPassed?: boolean;
  teachingDemoSatisfactory?: boolean;
  hodInterviewCompleted?: boolean;
  presidentInterviewCompleted?: boolean;
  hasInterviews?: boolean;
  hasEvaluations?: boolean;
  hasAssessments?: boolean;
  assessmentsPassed?: boolean;
  hasOffer?: boolean;
  offerAccepted?: boolean;
  isOnboarding?: boolean;
  onboardingCompleted?: boolean;
  isReadyToHire?: boolean;
}

interface StepDef {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TEACHING_STEPS: StepDef[] = [
  {
    key: 'APPLIED',
    label: 'Application',
    shortLabel: 'Applied',
    icon: FileText,
    description: 'Initial faculty application submission',
  },
  {
    key: 'DOCUMENTS',
    label: 'Required Documents',
    shortLabel: 'Documents',
    icon: ClipboardCheck,
    description: 'All mandatory credentials submitted to HOD',
  },
  {
    key: 'WRITTEN_EXAM',
    label: 'Written Examination',
    shortLabel: 'Exam',
    icon: Award,
    description: 'Subject-matter & pedagogy written examination',
  },
  {
    key: 'TEACHING_DEMO',
    label: 'Teaching Demonstration',
    shortLabel: 'Demo',
    icon: GraduationCap,
    description: 'Classroom teaching demonstration evaluation',
  },
  {
    key: 'HOD_INTERVIEW',
    label: 'HOD Interview',
    shortLabel: 'HOD',
    icon: Users,
    description: 'Interview with the Head of the Department',
  },
  {
    key: 'PRESIDENT_INTERVIEW',
    label: 'President Final Interview',
    shortLabel: 'President',
    icon: Building,
    description: 'Endorsement to President for final interview',
  },
  {
    key: 'CONTRACT',
    label: 'Employment Contract',
    shortLabel: 'Contract',
    icon: BadgePercent,
    description: 'Contract execution (1 school year probationary)',
  },
  {
    key: 'ORIENTATION',
    label: 'Orientation',
    shortLabel: 'Orientation',
    icon: ListTodo,
    description: 'Orientation on school policies and regulations',
  },
  {
    key: 'READY_TO_HIRE',
    label: 'Ready to Hire',
    shortLabel: 'Ready',
    icon: ShieldCheck,
    description: 'All institutional hiring prerequisites satisfied',
  },
  {
    key: 'HIRED',
    label: 'Hired',
    shortLabel: 'Hired',
    icon: UserCheck,
    description: 'Official faculty hire conversion complete',
  },
];

const NON_TEACHING_STEPS: StepDef[] = [
  {
    key: 'APPLIED',
    label: 'Application',
    shortLabel: 'Applied',
    icon: FileText,
    description: 'Initial candidate application submission',
  },
  {
    key: 'DOCUMENTS',
    label: 'Required Documents',
    shortLabel: 'Documents',
    icon: ClipboardCheck,
    description: 'All mandatory credentials submitted to HOD',
  },
  {
    key: 'WRITTEN_EXAM',
    label: 'Written Examination',
    shortLabel: 'Exam',
    icon: Award,
    description: 'Institutional non-teaching written examination',
  },
  {
    key: 'HOD_INTERVIEW',
    label: 'HOD Interview',
    shortLabel: 'HOD',
    icon: Users,
    description: 'Interview with the Head of the Department',
  },
  {
    key: 'PRESIDENT_INTERVIEW',
    label: 'President Final Interview',
    shortLabel: 'President',
    icon: Building,
    description: 'Endorsement to President for final interview',
  },
  {
    key: 'CONTRACT',
    label: 'Employment Contract',
    shortLabel: 'Contract',
    icon: BadgePercent,
    description: 'Contract execution (6 months probationary)',
  },
  {
    key: 'ORIENTATION',
    label: 'Orientation',
    shortLabel: 'Orientation',
    icon: ListTodo,
    description: 'Orientation on school policies and regulations',
  },
  {
    key: 'READY_TO_HIRE',
    label: 'Ready to Hire',
    shortLabel: 'Ready',
    icon: ShieldCheck,
    description: 'All institutional hiring prerequisites satisfied',
  },
  {
    key: 'HIRED',
    label: 'Hired',
    shortLabel: 'Hired',
    icon: UserCheck,
    description: 'Official non-teaching hire conversion complete',
  },
];

export function CandidateLifecycleStepper({
  currentStatus,
  category,
  documentsSatisfied = false,
  writtenExamPassed = false,
  teachingDemoSatisfactory = false,
  hodInterviewCompleted = false,
  presidentInterviewCompleted = false,
  hasOffer = false,
  offerAccepted = false,
  isOnboarding = false,
  onboardingCompleted = false,
  isReadyToHire = false,
}: CandidateLifecycleStepperProps) {
  const isTeaching = category === 'TEACHING';
  const steps = isTeaching ? TEACHING_STEPS : NON_TEACHING_STEPS;

  let activeIndex = 0;

  if (currentStatus === ApplicationStatus.HIRED) {
    activeIndex = steps.length - 1;
  } else if (isReadyToHire) {
    activeIndex = steps.length - 2; // READY_TO_HIRE
  } else if (isOnboarding || onboardingCompleted) {
    activeIndex = steps.findIndex((s) => s.key === 'ORIENTATION');
  } else if (hasOffer || offerAccepted) {
    activeIndex = steps.findIndex((s) => s.key === 'CONTRACT');
  } else if (presidentInterviewCompleted) {
    activeIndex = steps.findIndex((s) => s.key === 'CONTRACT');
  } else if (hodInterviewCompleted) {
    activeIndex = steps.findIndex((s) => s.key === 'PRESIDENT_INTERVIEW');
  } else if (isTeaching && teachingDemoSatisfactory) {
    activeIndex = steps.findIndex((s) => s.key === 'HOD_INTERVIEW');
  } else if (writtenExamPassed) {
    activeIndex = steps.findIndex(
      (s) => s.key === (isTeaching ? 'TEACHING_DEMO' : 'HOD_INTERVIEW')
    );
  } else if (documentsSatisfied) {
    activeIndex = steps.findIndex((s) => s.key === 'WRITTEN_EXAM');
  } else if (
    currentStatus !== ApplicationStatus.APPLIED &&
    currentStatus !== ApplicationStatus.REJECTED &&
    currentStatus !== ApplicationStatus.WITHDRAWN
  ) {
    activeIndex = steps.findIndex((s) => s.key === 'DOCUMENTS');
  } else {
    activeIndex = 0;
  }

  if (activeIndex === -1) activeIndex = 0;

  const isTerminal =
    currentStatus === ApplicationStatus.REJECTED ||
    currentStatus === ApplicationStatus.WITHDRAWN;

  return (
    <div className="rounded-lg border border-[var(--wp-border)] bg-white p-6">
      {/* Terminal State Alert */}
      {isTerminal && (
        <div
          className={`mb-4 flex items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold ${
            currentStatus === ApplicationStatus.REJECTED
              ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 '
              : 'bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] ring-1 ring-[#E8EAED] '
          }`}
        >
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            <span>
              Candidate application marked as{' '}
              <strong className="uppercase">{currentStatus}</strong>. Pipeline lifecycle is closed.
            </span>
          </div>
          <span className="text-xs opacity-75">Terminal Stage</span>
        </div>
      )}

      {/* Stepper Header */}
      <div className="mb-4 flex items-center justify-between border-b border-[var(--wp-border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--wp-text-muted)]">
            Institutional Lifecycle ({isTeaching ? 'Faculty / Teaching' : 'Non-Teaching'})
          </span>
          <span className="inline-flex items-center rounded-lg bg-[var(--wp-surface-subtle)] border border-[var(--wp-border)] px-2 py-0.5 text-xs font-bold text-[var(--wp-text)]">
            Stage {activeIndex + 1} of {steps.length}
          </span>
        </div>

        {/* Current Stage Highlight */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--wp-text-muted)]">
            Current Stage:
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
              currentStatus === ApplicationStatus.HIRED
                ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-500/30'
                : isReadyToHire
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30 animate-pulse'
                : isTerminal
                ? 'bg-rose-50 text-rose-700 '
                : 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] '
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {isReadyToHire
              ? 'Ready to Hire'
              : steps[activeIndex]?.label || currentStatus}
          </span>
        </div>
      </div>

      {/* Stepper Steps Row */}
      <div className="relative">
        <div className="flex items-center justify-between overflow-x-auto pb-2 pt-1 scrollbar-none">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = !isTerminal && idx < activeIndex;
            const isCurrent = !isTerminal && idx === activeIndex;
            const isGate = step.key === 'READY_TO_HIRE';

            return (
              <div key={step.key} className="flex flex-1 items-center last:flex-none min-w-[72px]">
                {/* Step Node */}
                <div className="flex flex-col items-center group relative cursor-default">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                      isCompleted
                        ? 'border-emerald-600 bg-emerald-600 text-white '
                        : isCurrent
                        ? 'border-[#181A1C] bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] ring-4 ring-slate-100 '
                        : isGate
                        ? 'border-dashed border-amber-300 bg-amber-50/50 text-amber-600 '
                        : 'border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] '
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`mt-1.5 text-xs font-bold text-center leading-tight whitespace-nowrap ${
                      isCurrent
                        ? 'text-[var(--wp-text)] font-semibold'
                        : isCompleted
                        ? 'text-emerald-700 '
                        : 'text-[var(--wp-text-muted)] '
                    }`}
                  >
                    {step.shortLabel}
                  </span>

                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap rounded-lg bg-[var(--tenant-primary)] px-2 py-1 text-xs text-[var(--tenant-primary-foreground)] shadow-lg">
                    {step.description}
                  </div>
                </div>

                {/* Connecting Track Line */}
                {idx < steps.length - 1 && (
                  <div
                    className={`h-[2px] flex-1 mx-1.5 transition-colors ${
                      idx < activeIndex
                        ? 'bg-emerald-600'
                        : 'bg-[#E8EAED] '
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
