import 'server-only';

import { getBackOfficeReadContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { requireOrganizationFeature } from '@/features/subscriptions/entitlements';
import type { AnalyticsFilters } from './date-range';
import { readAnalytics } from './read-model';

// The only request entry point: filters cannot choose a tenant or actor.
export async function getAnalytics(filters: AnalyticsFilters = {}) {
  const actor = await getBackOfficeReadContext();
  await requireOrganizationFeature(actor.organizationId, 'advancedAnalytics');
  return readAnalytics(actor, prisma, filters);
}
