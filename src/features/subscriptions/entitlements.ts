import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { SubscriptionTier, SubscriptionBillingInterval } from '@prisma/client';

export type PaidFeature = 'aiResumeParsing' | 'advancedAnalytics' | 'gmailIntegration' | 'customBranding';
export function isCurrentEntitlement(
  record: { status: string; startsAt: Date | null; endsAt: Date | null } | null,
  now = new Date(),
) {
  return !!record && record.status === 'ACTIVE' &&
    (!record.startsAt || record.startsAt.getTime() <= now.getTime()) &&
    (!record.endsAt || record.endsAt.getTime() > now.getTime());
}
export async function getOrganizationEntitlement(organizationId: string) {
  const [record, plans] = await Promise.all([
    prisma.organizationSubscription.findUnique({ where: { organizationId }, include: { plan: true } }),
    prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } }),
  ]);
  return { record, plans, active: isCurrentEntitlement(record) };
}
export async function requireOrganizationFeature(organizationId: string, feature: PaidFeature) {
  const data = await prisma.organizationSubscription.findUnique({
    where: { organizationId }, include: { plan: true },
  });
  if (!isCurrentEntitlement(data) || !data?.plan[feature]) {
    throw new Error('SUBSCRIPTION_FEATURE_UNAVAILABLE');
  }
  return data;
}
export function getSubscriptionPrice(
  plan: { active: boolean; monthlyPriceMinor: number | null; yearlyPriceMinor: number | null },
  interval: SubscriptionBillingInterval,
) {
  const amount = interval === 'MONTHLY' ? plan.monthlyPriceMinor : plan.yearlyPriceMinor;
  if (!plan.active || !Number.isSafeInteger(amount) || amount === null || amount <= 0)
    throw new Error('SUBSCRIPTION_PLAN_NOT_FOR_SALE');
  return amount;
}
export function subscriptionTerm(from: Date, interval: SubscriptionBillingInterval) {
  const to = new Date(from);
  const originDay = to.getUTCDate();
  const months = interval === 'YEARLY' ? 12 : 1;
  // Clamp month rollover rather than silently making a one-month plan 33 days.
  to.setUTCDate(1);
  to.setUTCMonth(to.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)).getUTCDate();
  to.setUTCDate(Math.min(originDay, lastDay));
  return to;
}
export const paidFeatureLabels: Record<PaidFeature, string> = {
  aiResumeParsing: 'AI resume parsing',
  advancedAnalytics: 'Advanced analytics',
  gmailIntegration: 'Gmail integration',
  customBranding: 'Custom branding',
};
export const subscriptionTiers: SubscriptionTier[] = ['BASIC', 'PRO'];
