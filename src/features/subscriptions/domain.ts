import type { SubscriptionBillingInterval } from '@prisma/client';
import { approvedPlans } from './approved-plans';

export function isCurrentEntitlement(
  record: { status: string; startsAt: Date | null; endsAt: Date | null } | null,
  now = new Date(),
) {
  return !!record && record.status === 'ACTIVE' &&
    (!record.startsAt || record.startsAt.getTime() <= now.getTime()) &&
    (!record.endsAt || record.endsAt.getTime() > now.getTime());
}
export function subscriptionTerm(from: Date, interval: SubscriptionBillingInterval) {
  return subscriptionMonths(from, interval === 'YEARLY' ? 12 : 1);
}

export function subscriptionMonths(from: Date, months: number) {
  if (!Number.isInteger(months) || months < 1 || months > 120 || !Number.isFinite(from.getTime())) {
    throw new Error('SUBSCRIPTION_INVALID_DURATION');
  }
  const to = new Date(from);
  const originDay = to.getUTCDate();
  // Clamp month rollover rather than silently making a one-month plan 33 days.
  to.setUTCDate(1);
  to.setUTCMonth(to.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)).getUTCDate();
  to.setUTCDate(Math.min(originDay, lastDay));
  return to;
}

export type PaidFeature = 'aiResumeParsing' | 'advancedAnalytics' | 'gmailIntegration' | 'customBranding';
export const paidFeatureLabels: Record<PaidFeature, string> = {
  aiResumeParsing: 'AI resume parsing', advancedAnalytics: 'Advanced analytics',
  gmailIntegration: 'Gmail integration', customBranding: 'Custom branding',
};

export function hasFeature(record: {
  status: string; startsAt: Date | null; endsAt: Date | null; legacyAccess: boolean;
  plan: Record<PaidFeature, boolean>;
  planTier?: 'BASIC' | 'PRO';
} | null, feature: PaidFeature, now = new Date()) {
  return !!record && (record.legacyAccess || (isCurrentEntitlement(record, now) &&
    (record.planTier ? approvedPlans[record.planTier][feature] : record.plan[feature])));
}

// Pending requests never participate in this decision. Existing over-limit jobs
// are retained; the mutation boundary blocks only increases in published jobs.
export function activeJobLimit(record: { planTier: 'BASIC'|'PRO'; status:string; startsAt:Date|null; endsAt:Date|null; legacyAccess:boolean } | null, now=new Date()) {
  return record?.planTier === 'PRO' && (isCurrentEntitlement(record,now) || record.legacyAccess) ? null : approvedPlans.BASIC.maxActiveJobs;
}

export function effectiveSubscriptionStatus(record: Parameters<typeof isCurrentEntitlement>[0], now = new Date()) {
  if (!record) return 'UNASSIGNED';
  if (record.status === 'ACTIVE' && record.endsAt && record.endsAt <= now) return 'EXPIRED';
  if (record.status === 'ACTIVE' && record.startsAt && record.startsAt > now) return 'PENDING';
  return record.status;
}
