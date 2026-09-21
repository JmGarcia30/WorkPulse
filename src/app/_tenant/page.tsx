import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/routing';
import { requireRequestTenant } from '@/lib/tenant/server';

export default async function TenantEntryPage() {
  const tenant = await requireRequestTenant();
  const session = await getSession();
  if (!session || session.organizationId !== tenant.organizationId) redirect('/login');
  redirect(landingPathForRole(session.role));
}
