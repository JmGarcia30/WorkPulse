import 'server-only';

import { getBackOfficeReadContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import type { AnalyticsFilters } from './date-range';
import { readAnalytics } from './read-model';

// The only request entry point: filters cannot choose a tenant or actor.
export async function getAnalytics(filters: AnalyticsFilters = {}) {
  return readAnalytics(await getBackOfficeReadContext(), prisma, filters);
}
