import 'server-only';

import { getBackOfficeReadContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { requireOrganizationFeature } from '@/features/subscriptions/entitlements';
import type { AnalyticsFilters } from './date-range';
import { readAnalytics, readBasicAnalytics } from './read-model';
import { hasFeature } from '@/features/subscriptions/domain';

// The only request entry point: filters cannot choose a tenant or actor.
export async function getAnalytics(filters: AnalyticsFilters = {}) {
  const actor = await getBackOfficeReadContext();
  await requireOrganizationFeature(actor.organizationId, 'advancedAnalytics');
  return readAnalytics(actor, prisma, filters);
}

export async function getAnalyticsPageData(filters:AnalyticsFilters={}) {
  const actor=await getBackOfficeReadContext();
  const subscription=await prisma.organizationSubscription.findUnique({where:{organizationId:actor.organizationId},include:{plan:true}});
  return hasFeature(subscription,'advancedAnalytics') ? readAnalytics(actor,prisma,filters) : readBasicAnalytics(actor,prisma,filters);
}
