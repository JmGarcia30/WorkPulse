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

export type OnboardingSectionType =
  | 'PRE_EMPLOYMENT_CREDENTIALS'
  | 'ONBOARDING_ACTIVITIES';

export interface DefaultOnboardingTaskTemplate {
  title: string;
  description: string;
  type: OnboardingTaskType;
  isRequired: boolean;
  section?: OnboardingSectionType;
  matchedRecruitmentDocType?: string;
}

/**
 * Returns SAGA institutional onboarding tasks tailored by employment category.
 * - Separates TOR and Diploma as distinct requirements.
 * - Mandates LET for Faculty (TEACHING).
 * - Makes Professional License conditional for Staff (NON_TEACHING).
 * - Explicitly demarcates pre-employment credentials from institutional onboarding activities.
 */
export function getSagaOnboardingTaskTemplates(
  category: 'TEACHING' | 'NON_TEACHING'
): DefaultOnboardingTaskTemplate[] {
  const isTeaching = category === 'TEACHING';

  return [
    // ==========================================
    // SECTION A: PRE-EMPLOYMENT CREDENTIALS
    // ==========================================
    {
      title: 'Transcript of Records (TOR)',
      description:
        'Official authenticated copy of collegiate / post-graduate transcript of records (TOR).',
      type: OnboardingTaskType.DOCUMENT,
      isRequired: true,
      section: 'PRE_EMPLOYMENT_CREDENTIALS',
      matchedRecruitmentDocType: 'TRANSCRIPT_OF_RECORDS',
    },
    {
      title: 'Photocopy of Diploma',
      description:
        'Authenticated copy of Bachelor’s, Master’s, or highest educational degree diploma.',
      type: OnboardingTaskType.DOCUMENT,
      isRequired: true,
      section: 'PRE_EMPLOYMENT_CREDENTIALS',
      matchedRecruitmentDocType: 'DIPLOMA',
    },
    ...(isTeaching
      ? [
          {
            title:
              'Photocopy of Board Licensure Examination for Teachers (LET - Basic Education)',
            description:
              'PRC Board Professional Teacher license card or Certificate of Good Standing.',
            type: OnboardingTaskType.DOCUMENT,
            isRequired: true,
            section: 'PRE_EMPLOYMENT_CREDENTIALS' as OnboardingSectionType,
            matchedRecruitmentDocType: 'LET_BASIC_EDUCATION',
          },
        ]
      : [
          {
            title: 'Photocopy of Professional License (if applicable)',
            description:
              'PRC license for professional non-teaching roles (e.g. Guidance Counselor, Psychometrician, CPA, Librarian, Nurse).',
            type: OnboardingTaskType.DOCUMENT,
            isRequired: false,
            section: 'PRE_EMPLOYMENT_CREDENTIALS' as OnboardingSectionType,
            matchedRecruitmentDocType: 'PROFESSIONAL_LICENSE',
          },
        ]),
    {
      title: 'Valid NBI Clearance',
      description:
        'Valid, unexpired National Bureau of Investigation clearance without derogatory record.',
      type: OnboardingTaskType.DOCUMENT,
      isRequired: true,
      section: 'PRE_EMPLOYMENT_CREDENTIALS',
      matchedRecruitmentDocType: 'NBI_CLEARANCE',
    },
    {
      title: 'Government Identification (SSS, PhilHealth, Pag-IBIG, TIN)',
      description:
        'Upload scanned copies or verified government registration member numbers for SSS, PhilHealth, Pag-IBIG, and TIN.',
      type: OnboardingTaskType.DOCUMENT,
      isRequired: true,
      section: 'PRE_EMPLOYMENT_CREDENTIALS',
    },
    {
      title: 'Medical Fitness & Fit-to-Work Clearance',
      description:
        'Submit comprehensive medical examination results including chest X-ray and licensed physician Fit-to-Work certification.',
      type: OnboardingTaskType.DOCUMENT,
      isRequired: true,
      section: 'PRE_EMPLOYMENT_CREDENTIALS',
    },

    // ==========================================
    // SECTION B: ONBOARDING & INDUCTION ACTIVITIES
    // ==========================================
    {
      title: 'Institutional Employment Contract Execution & Signing',
      description:
        'Formal execution and signing of the institutional appointment contract by the President and employee.',
      type: OnboardingTaskType.ADMIN,
      isRequired: true,
      section: 'ONBOARDING_ACTIVITIES',
    },
    {
      title: 'Institutional Email & System Portal Access Provisioning',
      description:
        'Set up official institutional work email account (@saga.edu.ph), faculty/staff portal access, and system credentials.',
      type: OnboardingTaskType.ADMIN,
      isRequired: true,
      section: 'ONBOARDING_ACTIVITIES',
    },
    {
      title: 'Faculty / Staff ID Badge & Campus Keycard',
      description:
        'Issue official institutional ID card, RFID gate access badge, and department building keys.',
      type: OnboardingTaskType.EQUIPMENT,
      isRequired: true,
      section: 'ONBOARDING_ACTIVITIES',
    },
    {
      title: 'SAGA Institutional Policies, Rules & Regulations Orientation',
      description:
        'Attend mandatory institutional welcome orientation, faculty/staff handbook review, and SAGA rules and regulations briefing.',
      type: OnboardingTaskType.ORIENTATION,
      isRequired: true,
      section: 'ONBOARDING_ACTIVITIES',
    },
  ];
}

export const DEFAULT_INSTITUTIONAL_ONBOARDING_TASKS: DefaultOnboardingTaskTemplate[] =
  getSagaOnboardingTaskTemplates('TEACHING');

/**
 * Mapping between RecruitmentDocumentType and corresponding Onboarding task title patterns.
 * Supports both modern distinct titles and legacy unified titles for backward compatibility.
 */
export const RECRUITMENT_DOC_TO_ONBOARDING_TITLE_MAP: Record<string, string[]> = {
  TRANSCRIPT_OF_RECORDS: [
    'Transcript of Records (TOR)',
    'Official Transcript of Records (TOR)',
    'Official Transcript of Records (TOR) & Diploma',
  ],
  DIPLOMA: [
    'Photocopy of Diploma',
    'College / Post-Graduate Diploma',
    'Official Transcript of Records (TOR) & Diploma',
  ],
  LET_BASIC_EDUCATION: [
    'Photocopy of Board Licensure Examination for Teachers (LET - Basic Education)',
    'PRC Board Certification & License Credentials',
  ],
  PROFESSIONAL_LICENSE: [
    'Photocopy of Professional License (if applicable)',
    'Photocopy of Professional License',
    'PRC Board Certification & License Credentials',
  ],
  NBI_CLEARANCE: [
    'Valid NBI Clearance',
    'NBI Clearance',
    'NBI / Police Clearance Certificate',
  ],
};

/**
 * Categorizes an onboarding task into its institutional section.
 */
export function getOnboardingTaskSection(taskTitle: string, taskType: OnboardingTaskType): OnboardingSectionType {
  const titleLower = taskTitle.toLowerCase();
  if (
    taskType === OnboardingTaskType.DOCUMENT ||
    titleLower.includes('transcript') ||
    titleLower.includes('diploma') ||
    titleLower.includes('prc') ||
    titleLower.includes('license') ||
    titleLower.includes('let') ||
    titleLower.includes('nbi') ||
    titleLower.includes('government') ||
    titleLower.includes('medical') ||
    titleLower.includes('fit-to-work')
  ) {
    return 'PRE_EMPLOYMENT_CREDENTIALS';
  }
  return 'ONBOARDING_ACTIVITIES';
}

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
