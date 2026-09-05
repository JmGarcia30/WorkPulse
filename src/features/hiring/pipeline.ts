import { ApplicationStatus } from '@prisma/client';

export const ACTIVE_PIPELINE_STAGES: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.SCREENING,
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.ASSESSMENT,
  ApplicationStatus.OFFER,
  ApplicationStatus.HIRED,
];

export const TERMINAL_STAGES: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
];

export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.APPLIED]: [
    ApplicationStatus.SCREENING,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.SCREENING]: [
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.SHORTLISTED]: [
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.INTERVIEW]: [
    ApplicationStatus.ASSESSMENT,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.ASSESSMENT]: [
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.OFFER]: [
    ApplicationStatus.HIRED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.HIRED]: [],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.WITHDRAWN]: [],
};

export function isValidStatusTransition(
  fromStatus: ApplicationStatus,
  toStatus: ApplicationStatus
): boolean {
  if (fromStatus === toStatus) return false;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

export function getAvailableNextStatuses(fromStatus: ApplicationStatus): ApplicationStatus[] {
  return ALLOWED_TRANSITIONS[fromStatus] || [];
}

export const STAGE_CONFIG: Record<
  ApplicationStatus,
  { label: string; badgeBg: string; badgeText: string; borderColor: string }
> = {
  [ApplicationStatus.APPLIED]: {
    label: 'Applied',
    badgeBg: 'bg-[#F8F9FA] dark:bg-slate-800',
    badgeText: 'text-[#181A1C] dark:text-slate-100',
    borderColor: 'border-[#E8EAED] dark:border-slate-700',
  },
  [ApplicationStatus.SCREENING]: {
    label: 'Screening',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-800 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  [ApplicationStatus.SHORTLISTED]: {
    label: 'Shortlisted',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  [ApplicationStatus.INTERVIEW]: {
    label: 'Interview',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  [ApplicationStatus.ASSESSMENT]: {
    label: 'Assessment',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  [ApplicationStatus.OFFER]: {
    label: 'Offer',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  [ApplicationStatus.HIRED]: {
    label: 'Hired',
    badgeBg: 'bg-teal-50 dark:bg-teal-950/60',
    badgeText: 'text-teal-700 dark:text-teal-300',
    borderColor: 'border-teal-200 dark:border-teal-800',
  },
  [ApplicationStatus.REJECTED]: {
    label: 'Rejected',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
  [ApplicationStatus.WITHDRAWN]: {
    label: 'Withdrawn',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-600 dark:text-slate-400',
    borderColor: 'border-slate-200 dark:border-slate-800',
  },
};
