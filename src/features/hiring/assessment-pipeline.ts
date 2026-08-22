import { AssessmentStatus, AssessmentType } from '@prisma/client';

export const ACTIVE_ASSESSMENT_STATUSES: AssessmentStatus[] = [
  AssessmentStatus.ASSIGNED,
  AssessmentStatus.IN_PROGRESS,
  AssessmentStatus.SUBMITTED,
  AssessmentStatus.UNDER_REVIEW,
];

export const TERMINAL_ASSESSMENT_STATUSES: AssessmentStatus[] = [
  AssessmentStatus.PASSED,
  AssessmentStatus.FAILED,
  AssessmentStatus.EXPIRED,
  AssessmentStatus.CANCELLED,
];

export const ALLOWED_ASSESSMENT_TRANSITIONS: Record<AssessmentStatus, AssessmentStatus[]> = {
  [AssessmentStatus.ASSIGNED]: [
    AssessmentStatus.IN_PROGRESS,
    AssessmentStatus.CANCELLED,
    AssessmentStatus.EXPIRED,
  ],
  [AssessmentStatus.IN_PROGRESS]: [
    AssessmentStatus.SUBMITTED,
    AssessmentStatus.CANCELLED,
    AssessmentStatus.EXPIRED,
  ],
  [AssessmentStatus.SUBMITTED]: [
    AssessmentStatus.UNDER_REVIEW,
    AssessmentStatus.PASSED,
    AssessmentStatus.FAILED,
    AssessmentStatus.CANCELLED,
  ],
  [AssessmentStatus.UNDER_REVIEW]: [
    AssessmentStatus.PASSED,
    AssessmentStatus.FAILED,
    AssessmentStatus.CANCELLED,
  ],
  [AssessmentStatus.PASSED]: [],
  [AssessmentStatus.FAILED]: [],
  [AssessmentStatus.EXPIRED]: [],
  [AssessmentStatus.CANCELLED]: [],
};

export function isValidAssessmentTransition(
  fromStatus: AssessmentStatus,
  toStatus: AssessmentStatus
): boolean {
  if (fromStatus === toStatus) return false;
  const allowed = ALLOWED_ASSESSMENT_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

export function getAvailableAssessmentTransitions(
  fromStatus: AssessmentStatus
): AssessmentStatus[] {
  return ALLOWED_ASSESSMENT_TRANSITIONS[fromStatus] || [];
}

export const ASSESSMENT_STAGE_CONFIG: Record<
  AssessmentStatus,
  { label: string; badgeBg: string; badgeText: string; borderColor: string }
> = {
  [AssessmentStatus.ASSIGNED]: {
    label: 'Assigned',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
  },
  [AssessmentStatus.IN_PROGRESS]: {
    label: 'In Progress',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  [AssessmentStatus.SUBMITTED]: {
    label: 'Submitted',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/60',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
  },
  [AssessmentStatus.UNDER_REVIEW]: {
    label: 'Under Review',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  [AssessmentStatus.PASSED]: {
    label: 'Passed',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  [AssessmentStatus.FAILED]: {
    label: 'Failed',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
  [AssessmentStatus.EXPIRED]: {
    label: 'Expired',
    badgeBg: 'bg-orange-50 dark:bg-orange-950/60',
    badgeText: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  [AssessmentStatus.CANCELLED]: {
    label: 'Cancelled',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-600 dark:text-slate-400',
    borderColor: 'border-slate-200 dark:border-slate-800',
  },
};

export const ASSESSMENT_TYPE_CONFIG: Record<
  AssessmentType,
  { label: string; badgeBg: string; badgeText: string }
> = {
  [AssessmentType.TECHNICAL]: {
    label: 'Technical',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-700 dark:text-purple-300',
  },
  [AssessmentType.SKILLS]: {
    label: 'Skills',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
  },
  [AssessmentType.COGNITIVE]: {
    label: 'Cognitive',
    badgeBg: 'bg-teal-50 dark:bg-teal-950/60',
    badgeText: 'text-teal-700 dark:text-teal-300',
  },
  [AssessmentType.BEHAVIORAL]: {
    label: 'Behavioral',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  [AssessmentType.ROLE_SPECIFIC]: {
    label: 'Role-Specific',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
  },
  [AssessmentType.OTHER]: {
    label: 'Other',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
  },
};
