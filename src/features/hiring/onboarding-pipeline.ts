import {
  OnboardingStatus,
  OnboardingTaskType,
  OnboardingTaskStatus,
} from '@prisma/client';

export const ALLOWED_TASK_TRANSITIONS: Record<
  OnboardingTaskStatus,
  OnboardingTaskStatus[]
> = {
  [OnboardingTaskStatus.PENDING]: [
    OnboardingTaskStatus.IN_PROGRESS,
    OnboardingTaskStatus.SUBMITTED,
    OnboardingTaskStatus.WAIVED,
  ],
  [OnboardingTaskStatus.IN_PROGRESS]: [
    OnboardingTaskStatus.SUBMITTED,
    OnboardingTaskStatus.WAIVED,
  ],
  [OnboardingTaskStatus.SUBMITTED]: [
    OnboardingTaskStatus.VERIFIED,
    OnboardingTaskStatus.REJECTED,
    OnboardingTaskStatus.WAIVED,
  ],
  [OnboardingTaskStatus.REJECTED]: [
    OnboardingTaskStatus.IN_PROGRESS,
    OnboardingTaskStatus.SUBMITTED,
    OnboardingTaskStatus.WAIVED,
  ],
  [OnboardingTaskStatus.VERIFIED]: [
    OnboardingTaskStatus.IN_PROGRESS, // Allowed only when authorized HR reopens task
  ],
  [OnboardingTaskStatus.WAIVED]: [
    OnboardingTaskStatus.PENDING,
  ],
};

export function isValidTaskTransition(
  fromStatus: OnboardingTaskStatus,
  toStatus: OnboardingTaskStatus
): boolean {
  if (fromStatus === toStatus) return false;
  const allowed = ALLOWED_TASK_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

export function getAvailableTaskTransitions(
  fromStatus: OnboardingTaskStatus
): OnboardingTaskStatus[] {
  return ALLOWED_TASK_TRANSITIONS[fromStatus] || [];
}

export interface DefaultOnboardingTaskTemplate {
  title: string;
  description: string;
  type: OnboardingTaskType;
  isRequired: boolean;
}

export const DEFAULT_INSTITUTIONAL_ONBOARDING_TASKS: DefaultOnboardingTaskTemplate[] = [
  {
    title: 'Government Identification (SSS, PhilHealth, Pag-IBIG, TIN)',
    description:
      'Upload scanned copies or verified government member numbers for SSS, PhilHealth, Pag-IBIG, and TIN.',
    type: OnboardingTaskType.DOCUMENT,
    isRequired: true,
  },
  {
    title: 'PRC Board Certification & License Credentials',
    description:
      'Upload PRC Professional Teacher/Specialist license card and board rating certificate for verification.',
    type: OnboardingTaskType.DOCUMENT,
    isRequired: true,
  },
  {
    title: 'Medical Fitness & Fit-to-Work Clearance',
    description:
      'Submit comprehensive medical examination results including chest X-ray and physician Fit-to-Work certificate.',
    type: OnboardingTaskType.DOCUMENT,
    isRequired: true,
  },
  {
    title: 'NBI / Police Clearance Certificate',
    description:
      'Submit a valid, unexpired NBI clearance or police clearance certificate.',
    type: OnboardingTaskType.DOCUMENT,
    isRequired: true,
  },
  {
    title: 'Official Transcript of Records (TOR) & Diploma',
    description:
      'Submit authenticated copies of official transcript of records and college/graduate diploma.',
    type: OnboardingTaskType.DOCUMENT,
    isRequired: true,
  },
  {
    title: 'Institutional Email & System Portal Access Provisioning',
    description:
      'Set up official institutional work email account, faculty/staff portal access, and institutional system credentials.',
    type: OnboardingTaskType.ADMIN,
    isRequired: true,
  },
  {
    title: 'Faculty / Staff ID Badge & Campus Keycard',
    description:
      'Issue official institutional ID card, RFID gate access badge, and department building keys.',
    type: OnboardingTaskType.EQUIPMENT,
    isRequired: true,
  },
  {
    title: 'New Hire Institutional Orientation & Department Induction',
    description:
      'Attend mandatory welcome orientation, department briefing, and institutional policy overview session.',
    type: OnboardingTaskType.ORIENTATION,
    isRequired: true,
  },
];

/**
 * An onboarding process may only complete when EVERY required task is VERIFIED or WAIVED.
 */
export function canCompleteOnboarding(
  tasks: Array<{ isRequired: boolean; status: OnboardingTaskStatus }>
): boolean {
  if (!tasks || tasks.length === 0) return false;
  const requiredTasks = tasks.filter((t) => t.isRequired);
  return requiredTasks.every(
    (t) =>
      t.status === OnboardingTaskStatus.VERIFIED ||
      t.status === OnboardingTaskStatus.WAIVED
  );
}

export function calculateOnboardingProgress(
  tasks: Array<{ isRequired: boolean; status: OnboardingTaskStatus }>
) {
  const totalTasks = tasks.length;
  if (totalTasks === 0) {
    return {
      totalTasks: 0,
      completedTasks: 0,
      percentComplete: 0,
      verifiedCount: 0,
      submittedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      waivedCount: 0,
    };
  }

  const verifiedCount = tasks.filter(
    (t) => t.status === OnboardingTaskStatus.VERIFIED
  ).length;
  const waivedCount = tasks.filter(
    (t) => t.status === OnboardingTaskStatus.WAIVED
  ).length;
  const submittedCount = tasks.filter(
    (t) => t.status === OnboardingTaskStatus.SUBMITTED
  ).length;
  const rejectedCount = tasks.filter(
    (t) => t.status === OnboardingTaskStatus.REJECTED
  ).length;
  const pendingCount = tasks.filter(
    (t) =>
      t.status === OnboardingTaskStatus.PENDING ||
      t.status === OnboardingTaskStatus.IN_PROGRESS
  ).length;

  const completedTasks = verifiedCount + waivedCount;
  const percentComplete = Math.round((completedTasks / totalTasks) * 100);

  return {
    totalTasks,
    completedTasks,
    percentComplete,
    verifiedCount,
    submittedCount,
    pendingCount,
    rejectedCount,
    waivedCount,
  };
}

export const ONBOARDING_STATUS_CONFIG: Record<
  OnboardingStatus,
  { label: string; badgeBg: string; badgeText: string; borderColor: string }
> = {
  [OnboardingStatus.NOT_STARTED]: {
    label: 'Not Started',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-600 dark:text-slate-400',
    borderColor: 'border-slate-200 dark:border-slate-800',
  },
  [OnboardingStatus.IN_PROGRESS]: {
    label: 'In Progress',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  [OnboardingStatus.COMPLETED]: {
    label: 'Completed',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  [OnboardingStatus.CANCELLED]: {
    label: 'Cancelled',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
};

export const TASK_STATUS_CONFIG: Record<
  OnboardingTaskStatus,
  { label: string; badgeBg: string; badgeText: string }
> = {
  [OnboardingTaskStatus.PENDING]: {
    label: 'Pending',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-600 dark:text-slate-400',
  },
  [OnboardingTaskStatus.IN_PROGRESS]: {
    label: 'In Progress',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  [OnboardingTaskStatus.SUBMITTED]: {
    label: 'Awaiting Review',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-700 dark:text-purple-300',
  },
  [OnboardingTaskStatus.VERIFIED]: {
    label: 'Verified',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  [OnboardingTaskStatus.REJECTED]: {
    label: 'Revision Needed',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
  },
  [OnboardingTaskStatus.WAIVED]: {
    label: 'Waived',
    badgeBg: 'bg-slate-200 dark:bg-slate-700',
    badgeText: 'text-slate-700 dark:text-slate-300',
  },
};

export const TASK_TYPE_CONFIG: Record<
  OnboardingTaskType,
  { label: string; badgeBg: string; badgeText: string }
> = {
  [OnboardingTaskType.DOCUMENT]: {
    label: 'Document',
    badgeBg: 'bg-[#F8F9FA] dark:bg-slate-800',
    badgeText: 'text-[#181A1C] dark:text-slate-200',
  },
  [OnboardingTaskType.EQUIPMENT]: {
    label: 'Equipment & Access',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-700 dark:text-purple-300',
  },
  [OnboardingTaskType.ADMIN]: {
    label: 'Administrative & IT',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  [OnboardingTaskType.ORIENTATION]: {
    label: 'Orientation',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  [OnboardingTaskType.OTHER]: {
    label: 'General',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-600 dark:text-slate-400',
  },
};
