import type { SubscriptionBillingInterval } from '@prisma/client';

export function isCurrentEntitlement(
  record: { status: string; startsAt: Date | null; endsAt: Date | null } | null,
  now = new Date(),
) {
  return !!record && record.status === 'ACTIVE' &&
    (!record.startsAt || record.startsAt.getTime() <= now.getTime()) &&
    (!record.endsAt || record.endsAt.getTime() > now.getTime());
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
