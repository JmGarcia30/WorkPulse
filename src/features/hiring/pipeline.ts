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

export interface StageStyleConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  headerPillBg: string;
  headerPillText: string;
  headerCountBg: string;
  headerCountText: string;
  dotColor: string;
}

export const STAGE_CONFIG: Record<ApplicationStatus, StageStyleConfig> = {
  [ApplicationStatus.APPLIED]: {
    label: 'Applied',
    badgeBg: 'bg-slate-100 border border-slate-200/80',
    badgeText: 'text-slate-700',
    borderColor: 'border-slate-300',
    headerPillBg: 'bg-slate-600',
    headerPillText: 'text-white',
    headerCountBg: 'bg-white',
    headerCountText: 'text-slate-800',
    dotColor: 'bg-slate-400',
  },
  [ApplicationStatus.SCREENING]: {
    label: 'Screening',
    badgeBg: 'bg-amber-50 border border-amber-200/80',
    badgeText: 'text-amber-800',
    borderColor: 'border-amber-300',
    headerPillBg: 'bg-amber-600',
    headerPillText: 'text-white',
    headerCountBg: 'bg-white',
    headerCountText: 'text-amber-900',
    dotColor: 'bg-amber-500',
  },
  [ApplicationStatus.SHORTLISTED]: {
    label: 'Shortlisted',
    badgeBg: 'bg-teal-50 border border-teal-200/80',
    badgeText: 'text-teal-800',
    borderColor: 'border-teal-300',
    headerPillBg: 'bg-teal-600',
    headerPillText: 'text-white',
    headerCountBg: 'bg-white',
    headerCountText: 'text-teal-900',
    dotColor: 'bg-teal-500',
  },
  [ApplicationStatus.INTERVIEW]: {
    label: 'Interview',
    badgeBg: 'bg-purple-50 border border-purple-200/80',
    badgeText: 'text-purple-700',
    borderColor: 'border-purple-300',
    headerPillBg: 'bg-purple-600',
    headerPillText: 'text-white',
    headerCountBg: 'bg-white',
    headerCountText: 'text-purple-900',
    dotColor: 'bg-purple-500',
  },
  [ApplicationStatus.ASSESSMENT]: {
    label: 'Assessment',
    badgeBg: 'bg-blue-50 border border-blue-200/80',
    badgeText: 'text-blue-700',
    borderColor: 'border-blue-300',
    headerPillBg: 'bg-blue-600',
    headerPillText: 'text-white',
    headerCountBg: 'bg-white',
    headerCountText: 'text-blue-900',
    dotColor: 'bg-blue-500',
  },
  [ApplicationStatus.OFFER]: {
    label: 'Offer',
    badgeBg: 'bg-amber-50 border border-amber-200/80',
    badgeText: 'text-amber-800',
    borderColor: 'border-amber-300',
    headerPillBg: 'bg-amber-500',
    headerPillText: 'text-white',
    headerCountBg: 'bg-white',
    headerCountText: 'text-amber-950',
    dotColor: 'bg-amber-500',
  },
  [ApplicationStatus.HIRED]: {
    label: 'Hired',
    badgeBg: 'bg-emerald-50 border border-emerald-200/80',
    badgeText: 'text-emerald-800',
    borderColor: 'border-emerald-300',
    headerPillBg: 'bg-emerald-600',
    headerPillText: 'text-white',
    headerCountBg: 'bg-white',
    headerCountText: 'text-emerald-950',
    dotColor: 'bg-emerald-500',
  },
  [ApplicationStatus.REJECTED]: {
    label: 'Rejected',
    badgeBg: 'bg-rose-50 border border-rose-200/80',
    badgeText: 'text-rose-700',
    borderColor: 'border-rose-300',
    headerPillBg: 'bg-rose-600',
    headerPillText: 'text-white',
    headerCountBg: 'bg-white',
    headerCountText: 'text-rose-950',
    dotColor: 'bg-rose-500',
  },
  [ApplicationStatus.WITHDRAWN]: {
    label: 'Withdrawn',
    badgeBg: 'bg-slate-100 border border-slate-200/80',
    badgeText: 'text-slate-600',
    borderColor: 'border-slate-300',
    headerPillBg: 'bg-slate-500',
    headerPillText: 'text-white',
    headerCountBg: 'bg-white',
    headerCountText: 'text-slate-800',
    dotColor: 'bg-slate-400',
  },
};
