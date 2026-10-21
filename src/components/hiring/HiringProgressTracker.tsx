'use client';

import React from 'react';
import { ApplicationStatus, EmploymentCategory } from '@prisma/client';
import { Check, XCircle } from 'lucide-react';

interface HiringProgressTrackerProps {
  isSaga: boolean;
  currentStatus: ApplicationStatus;
  category?: EmploymentCategory | 'TEACHING' | 'NON_TEACHING';
  documentsSatisfied?: boolean;
  writtenExamPassed?: boolean;
  teachingDemoSatisfactory?: boolean;
  hodInterviewCompleted?: boolean;
  presidentInterviewCompleted?: boolean;
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
  description: string;
}

const TEACHING_STEPS: StepDef[] = [
  { key: 'APPLIED', label: 'Application', shortLabel: 'Applied', description: 'Application submitted' },
  { key: 'DOCUMENTS', label: 'Required Documents', shortLabel: 'Documents', description: 'Mandatory credentials verification' },
  { key: 'WRITTEN_EXAM', label: 'Written Examination', shortLabel: 'Exam', description: 'Subject & pedagogy exam' },
  { key: 'TEACHING_DEMO', label: 'Teaching Demonstration', shortLabel: 'Demo', description: 'Classroom teaching demonstration' },
  { key: 'HOD_INTERVIEW', label: 'HOD Interview', shortLabel: 'HOD', description: 'Department Head interview' },
  { key: 'PRESIDENT_INTERVIEW', label: 'President Interview', shortLabel: 'President', description: 'Final institutional endorsement interview' },
  { key: 'CONTRACT', label: 'Employment Contract', shortLabel: 'Contract', description: 'Probationary contract execution' },
  { key: 'ORIENTATION', label: 'Orientation', shortLabel: 'Orientation', description: 'School policies and regulations orientation' },
  { key: 'READY_TO_HIRE', label: 'Ready to Hire', shortLabel: 'Ready', description: 'All institutional hiring prerequisites verified' },
  { key: 'HIRED', label: 'Hired', shortLabel: 'Hired', description: 'Official employee conversion complete' },
];

const NON_TEACHING_STEPS: StepDef[] = [
  { key: 'APPLIED', label: 'Application', shortLabel: 'Applied', description: 'Application submitted' },
  { key: 'DOCUMENTS', label: 'Required Documents', shortLabel: 'Documents', description: 'Mandatory credentials verification' },
  { key: 'WRITTEN_EXAM', label: 'Written Examination', shortLabel: 'Exam', description: 'Institutional written examination' },
  { key: 'HOD_INTERVIEW', label: 'HOD Interview', shortLabel: 'HOD', description: 'Department Head interview' },
  { key: 'PRESIDENT_INTERVIEW', label: 'President Interview', shortLabel: 'President', description: 'Final institutional interview' },
  { key: 'CONTRACT', label: 'Employment Contract', shortLabel: 'Contract', description: 'Probationary contract execution' },
  { key: 'ORIENTATION', label: 'Orientation', shortLabel: 'Orientation', description: 'School policies orientation' },
  { key: 'READY_TO_HIRE', label: 'Ready to Hire', shortLabel: 'Ready', description: 'All hiring prerequisites verified' },
  { key: 'HIRED', label: 'Hired', shortLabel: 'Hired', description: 'Official employee conversion complete' },
];

export function HiringProgressTracker({
  isSaga,
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
}: HiringProgressTrackerProps) {
  const isTeaching = category === 'TEACHING';
  const steps = isSaga ? (isTeaching ? TEACHING_STEPS : NON_TEACHING_STEPS) : [
    TEACHING_STEPS[0], TEACHING_STEPS[1],
    { key: 'WRITTEN_EXAM', label: 'Assessments & Interviews', shortLabel: 'Review', description: 'Assigned assessments and interviews' },
    { ...TEACHING_STEPS[6], description: 'Offer acceptance' },
    { ...TEACHING_STEPS[7], description: 'Organization onboarding' },
    { ...TEACHING_STEPS[8], description: 'Hiring prerequisites cleared' }, TEACHING_STEPS[9],
  ];

  // Calculate active stage index dynamically from verified workflow state
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

  const currentStep = steps[activeIndex];
  const currentStageLabel = isTerminal
    ? currentStatus === ApplicationStatus.REJECTED ? 'Rejected' : 'Withdrawn'
    : isReadyToHire
    ? 'Ready to Hire'
    : currentStep?.shortLabel || currentStatus;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition space-y-4">
      {/* Terminal Alert (if applicable) */}
      {isTerminal && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2 text-xs font-semibold text-rose-700">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>
            Candidate application is <strong>{currentStatus}</strong>. Institutional hiring pipeline is closed.
          </span>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-slate-800">
            Hiring Progress
          </span>
          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            Stage {activeIndex + 1} of {steps.length}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Current Stage:</span>
          <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-0.5 font-bold text-white shadow-xs">
            {currentStageLabel}
          </span>
        </div>
      </div>

      {/* Stepper Track */}
      <div className="overflow-x-auto pb-1.5 pt-1 scrollbar-none">
        <div className="flex items-center justify-between min-w-[700px] sm:min-w-0">
          {steps.map((step, idx) => {
            const isCompleted = !isTerminal && idx < activeIndex;
            const isCurrent = !isTerminal && idx === activeIndex;

            return (
              <div key={step.key} className="flex flex-1 items-center last:flex-none">
                {/* Step Node */}
                <div className="flex flex-col items-center group relative cursor-default">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isCurrent
                        ? 'bg-slate-900 text-white ring-4 ring-slate-100 shadow-xs'
                        : 'bg-slate-100 text-slate-400 border border-slate-200/80'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Stage Label Below Circle */}
                  <span
                    className={`mt-2 text-[11px] leading-tight text-center whitespace-nowrap transition-colors ${
                      isCurrent
                        ? 'font-bold text-slate-900'
                        : isCompleted
                        ? 'font-medium text-emerald-700'
                        : 'font-normal text-slate-400'
                    }`}
                  >
                    {step.shortLabel}
                  </span>

                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg">
                    {step.description}
                  </div>
                </div>

                {/* Connecting Track Line */}
                {idx < steps.length - 1 && (
                  <div
                    className={`h-[1.5px] flex-1 mx-1.5 transition-colors ${
                      idx < activeIndex ? 'bg-emerald-600' : 'bg-slate-200'
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
