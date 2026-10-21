import 'server-only';

import { headers } from 'next/headers';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { resolveRequestTenant } from '@/lib/tenant/server';
import { databaseSlugForTenant, parsePlatformHost } from '@/lib/tenant/host';

// Preserve action validation results while enforcing the same current-user and
// request-tenant boundary as the recruitment workspace and download handlers.
export async function getDocumentStaffContext() {
  try {
    return await requireBackOfficeContext();
  } catch (error) {
    if (error instanceof Error && ['UNAUTHENTICATED', 'FORBIDDEN'].includes(error.message)) return null;
    throw error;
  }
}

// Public careers paths also exist on the platform host. A tenant host, when
// present, must never be overridden with a caller-supplied organization slug.
// This validates tenancy, not candidate identity; the latter remains a policy
// decision until a candidate credential mechanism is established.
export async function candidatePortalMatchesRequestTenant(organizationSlug: string) {
  const tenant = await resolveRequestTenant();
  return tenant ? tenant.slug === databaseSlugForTenant(organizationSlug) : isPublicCareersHost();
}

export async function candidateDocumentMatchesRequestTenant(organizationId: string) {
  const tenant = await resolveRequestTenant();
  return tenant ? tenant.organizationId === organizationId : isPublicCareersHost();
}

async function isPublicCareersHost() {
  const requestHeaders = await headers();
  return parsePlatformHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '').kind === 'public';
}

// Older records may contain client-supplied active MIME types. Never serve
// those as executable same-origin HTML/SVG, even from private blob storage.
export function safeCandidateDocumentContentType(contentType: string | undefined) {
  const type = contentType?.split(';')[0].trim().toLowerCase();
  return type && ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp'].includes(type) ? type : 'application/octet-stream';
}
