import { OfferStatus, PayFrequency } from '@prisma/client';

export const ACTIVE_OFFER_STATUSES: OfferStatus[] = [
  OfferStatus.DRAFT,
  OfferStatus.PENDING_APPROVAL,
  OfferStatus.APPROVED,
  OfferStatus.SENT,
];

export const TERMINAL_OFFER_STATUSES: OfferStatus[] = [
  OfferStatus.ACCEPTED,
  OfferStatus.REJECTED,
  OfferStatus.WITHDRAWN,
  OfferStatus.EXPIRED,
];

export const ALLOWED_OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  [OfferStatus.DRAFT]: [
    OfferStatus.PENDING_APPROVAL,
    OfferStatus.WITHDRAWN,
  ],
  [OfferStatus.PENDING_APPROVAL]: [
    OfferStatus.APPROVED,
    OfferStatus.REJECTED,
    OfferStatus.WITHDRAWN,
  ],
  [OfferStatus.APPROVED]: [
    OfferStatus.SENT,
    OfferStatus.WITHDRAWN,
  ],
  [OfferStatus.SENT]: [
    OfferStatus.ACCEPTED,
    OfferStatus.REJECTED,
    OfferStatus.WITHDRAWN,
    OfferStatus.EXPIRED,
  ],
  [OfferStatus.ACCEPTED]: [],
  [OfferStatus.REJECTED]: [],
  [OfferStatus.WITHDRAWN]: [],
  [OfferStatus.EXPIRED]: [],
};

export function isValidOfferTransition(
  fromStatus: OfferStatus,
  toStatus: OfferStatus
): boolean {
  if (fromStatus === toStatus) return false;
  const allowed = ALLOWED_OFFER_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

export function getAvailableOfferTransitions(
  fromStatus: OfferStatus
): OfferStatus[] {
  return ALLOWED_OFFER_TRANSITIONS[fromStatus] || [];
}

export function isActiveOfferStatus(status: OfferStatus): boolean {
  return ACTIVE_OFFER_STATUSES.includes(status);
}

export const OFFER_STAGE_CONFIG: Record<
  OfferStatus,
  { label: string; badgeBg: string; badgeText: string; borderColor: string }
> = {
  [OfferStatus.DRAFT]: {
    label: 'Draft',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    borderColor: 'border-slate-200 dark:border-slate-800',
  },
  [OfferStatus.PENDING_APPROVAL]: {
    label: 'Pending Approval',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  [OfferStatus.APPROVED]: {
    label: 'Approved',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  [OfferStatus.SENT]: {
    label: 'Sent to Candidate',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  [OfferStatus.ACCEPTED]: {
    label: 'Accepted',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  [OfferStatus.REJECTED]: {
    label: 'Rejected',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
  [OfferStatus.WITHDRAWN]: {
    label: 'Withdrawn',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-600 dark:text-slate-400',
    borderColor: 'border-slate-200 dark:border-slate-800',
  },
  [OfferStatus.EXPIRED]: {
    label: 'Expired',
    badgeBg: 'bg-orange-50 dark:bg-orange-950/60',
    badgeText: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
};

export const PAY_FREQUENCY_CONFIG: Record<
  PayFrequency,
  { label: string; suffix: string }
> = {
  [PayFrequency.ANNUAL]: {
    label: 'Annual',
    suffix: '/year',
  },
  [PayFrequency.MONTHLY]: {
    label: 'Monthly',
    suffix: '/month',
  },
  [PayFrequency.BIWEEKLY]: {
    label: 'Bi-Weekly',
    suffix: '/bi-week',
  },
  [PayFrequency.WEEKLY]: {
    label: 'Weekly',
    suffix: '/week',
  },
  [PayFrequency.HOURLY]: {
    label: 'Hourly',
    suffix: '/hour',
  },
};
