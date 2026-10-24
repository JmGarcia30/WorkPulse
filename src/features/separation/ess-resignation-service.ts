import 'server-only';
import { getSession } from '@/lib/auth/session';
import { requireRequestTenant } from '@/lib/tenant/server';
import { prisma } from '@/lib/db/prisma';
import { createEmployeeResignationService } from './ess-resignation';

const service = createEmployeeResignationService(prisma, async () => {
  const [session, tenant] = await Promise.all([getSession(), requireRequestTenant()]);
  return { session, tenant };
});
export const { getMyResignations, submitEmployeeResignation } = service;
