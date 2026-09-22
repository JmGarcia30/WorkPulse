import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';
import { getOrganizationBranding } from '@/features/organization-branding/read-model';
import { measureDevelopment } from '@/lib/performance/diagnostics';
import { databaseSlugForTenant, parsePlatformHost } from './host';

export const resolveRequestTenant = cache(async () => measureDevelopment('tenant resolution', async () => {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '';
  const parsed = parsePlatformHost(host);
  if (parsed.kind !== 'tenant') return null;
  const branding = await getOrganizationBrandingBySlug(parsed.slug);
  return branding;
}));

export const getOrganizationBrandingBySlug = cache(async (slug: string) => {
  const { prisma } = await import('@/lib/db/prisma');
  const organization = await prisma.organization.findUnique({ where: { slug: databaseSlugForTenant(slug) }, select: { id: true } });
  return organization ? getOrganizationBranding(organization.id) : null;
});

export async function requireRequestTenant() {
  const tenant = await resolveRequestTenant();
  if (!tenant) throw new Error('TENANT_NOT_FOUND');
  return tenant;
}
