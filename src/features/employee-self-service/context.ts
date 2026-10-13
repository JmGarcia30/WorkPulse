import 'server-only';

import { cache } from 'react';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { requireRequestTenant } from '@/lib/tenant/server';
import { resolveEmployeeSelfContext } from './access';
export { EmployeeSelfAccessError } from './access';
export type { EmployeeSelfContext } from './access';

export const requireEmployeeSelfContext = cache(async () => {
  const [session, tenant] = await Promise.all([getSession(), requireRequestTenant()]);
  return resolveEmployeeSelfContext(session, tenant, prisma);
});
