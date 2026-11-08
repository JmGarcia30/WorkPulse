import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { hasFeature } from './domain';
import { isCurrentEntitlement } from './domain';

export type PaidFeature = 'aiResumeParsing' | 'advancedAnalytics' | 'gmailIntegration' | 'customBranding';
export { isCurrentEntitlement, subscriptionTerm } from './domain';
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
  if (!hasFeature(data, feature)) {
    throw new Error('SUBSCRIPTION_FEATURE_UNAVAILABLE');
  }
  return data;
}
export const paidFeatureLabels: Record<PaidFeature, string> = {
  aiResumeParsing: 'AI resume parsing',
  advancedAnalytics: 'Advanced analytics',
  gmailIntegration: 'Gmail integration',
  customBranding: 'Custom branding',
};
