import 'server-only';

import { Role } from '@prisma/client';
import { getSession, type UserSessionPayload } from './session';
import { prisma } from '@/lib/db/prisma';
import { requireRequestTenant } from '@/lib/tenant/server';
import { measureDevelopment } from '@/lib/performance/diagnostics';

const BACK_OFFICE_ROLES: Role[] = [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN, Role.HIRING_MANAGER];

export async function requireBackOfficeContext(): Promise<UserSessionPayload> {
  const [session, tenant] = await Promise.all([getSession(), requireRequestTenant()]);
  if (!session) throw new Error('UNAUTHENTICATED');
  if (session.organizationId !== tenant.organizationId) throw new Error('FORBIDDEN');
  const user = await measureDevelopment('session validation', () => prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, organizationId: true },
  }));
  if (!user || !BACK_OFFICE_ROLES.includes(user.role) || user.role !== session.role || user.organizationId !== session.organizationId) throw new Error('FORBIDDEN');
  return { userId: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId };
}
