import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getOrganizationBrandingBySlug } from '@/features/organization-branding/read-model';
import { measureDevelopment } from '@/lib/performance/diagnostics';
import { classifyRequestHost } from './host';
import { readRoutingContext, ROUTING_CONTEXT_HEADER } from './routing-context';
export { getOrganizationBrandingBySlug } from '@/features/organization-branding/read-model';

export const resolveRequestTenant = cache(async () => measureDevelopment('tenant resolution', async () => {
  const requestHeaders = await headers();
  if (requestHeaders.has(ROUTING_CONTEXT_HEADER)) {
    const context = readRoutingContext(requestHeaders);
    if (!context) return null;
    const branding = await getOrganizationBrandingBySlug(context.slug);
    return branding?.organizationId === context.organizationId ? branding : null;
  }
  // The legacy unsigned tenant header is not evidence of a path rewrite.
  if (requestHeaders.has('x-workpulse-tenant-slug')) return null;
  const parsed = classifyRequestHost(requestHeaders);
  if (parsed.kind !== 'tenant') return null;
  const branding = await getOrganizationBrandingBySlug(parsed.slug);
  return branding;
}));

// Reuse the already-resolved brand, rejecting IDs outside the request tenant.
export async function getRequestOrganizationBranding(organizationId: string) {
  const tenant = await resolveRequestTenant();
  return tenant?.organizationId === organizationId ? tenant : null;
}

export async function requireRequestTenant() {
  const tenant = await resolveRequestTenant();
  if (!tenant) notFound();
  return tenant;
}

// Server Action redirects do not reliably inherit proxy URL prefixes during
// client transitions. Keep the explicitly verified legacy path workspace.
export async function requestWorkspacePath(pathname: string) {
  const context = readRoutingContext(await headers());
  return context?.mode === 'saga-path' ? `/saga${pathname}` : pathname;
}
