import 'server-only';

import { Role } from '@prisma/client';
import { cache } from 'react';
import { getSession, type UserSessionPayload } from './session';
import { requireRequestTenant } from '@/lib/tenant/server';

const BACK_OFFICE_ROLES: Role[] = [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN, Role.HIRING_MANAGER];

// React render-pass memoization only. Mutations keep using the uncached guard below.
export const getBackOfficeReadContext = cache(requireBackOfficeContext);

export async function requireBackOfficeContext(): Promise<UserSessionPayload> {
  const [session, tenant] = await Promise.all([getSession(), requireRequestTenant()]);
  if (!session) throw new Error('UNAUTHENTICATED');
  if (session.organizationId !== tenant.organizationId) throw new Error('FORBIDDEN');
  // getSession verifies the current persisted role and organization before
  // returning. Keep that check at the shared boundary for every session consumer.
  if (!BACK_OFFICE_ROLES.includes(session.role)) throw new Error('FORBIDDEN');
  return session;
}
