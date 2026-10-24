import 'server-only';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { requirePlatformHost } from '@/features/platform-admin/session';
import { headers } from 'next/headers';
import { requestAuthority, publicOrigin } from '@/lib/tenant/host';
import { EmailIntegrationError } from './google';

export async function requireEmailAdministrator() {
  const user = await requireBackOfficeContext();
  if (user.role !== 'HR_ADMIN' && user.role !== 'ORGANIZATION_ADMIN') throw new EmailIntegrationError('FORBIDDEN');
  return { organizationId: user.organizationId, userId: user.userId };
}
export async function requirePublicEmailHost() {
  await requirePlatformHost();
  if (requestAuthority(await headers()) !== new URL(publicOrigin()).host) throw new EmailIntegrationError('FORBIDDEN');
}
