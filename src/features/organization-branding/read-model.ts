import 'server-only';

import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { measureDevelopment } from '@/lib/performance/diagnostics';
import { brandColorSchema, readableForeground } from './schema';

const DEFAULT_PRIMARY = '#17324D';
const DEFAULT_ACCENT = '#167D77';

function safeColor(value: string | null | undefined, fallback: string) {
  const parsed = brandColorSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export const getOrganizationBranding = cache(async (organizationId: string) => measureDevelopment('branding read', async () => {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, slug: true, name: true, description: true, logoUrl: true, timeZone: true, careersEnabled: true, branding: true },
  });
  if (!organization) return null;
  const primary = safeColor(organization.branding?.primaryColor, DEFAULT_PRIMARY);
  const accent = safeColor(organization.branding?.accentColor, DEFAULT_ACCENT);
  return {
    organizationId: organization.id,
    slug: organization.slug,
    canonicalName: organization.name,
    displayName: organization.branding?.displayName || organization.name,
    tagline: organization.branding?.tagline || organization.description,
    timeZone: organization.timeZone,
    careersEnabled: organization.careersEnabled,
    primary,
    primaryForeground: readableForeground(primary),
    accent,
    accentForeground: readableForeground(accent),
    hasLogo: Boolean(organization.branding?.logoStorageKey || organization.logoUrl),
    hasLoginImage: Boolean(organization.branding?.loginImageStorageKey),
    legacyLogoUrl: organization.logoUrl?.startsWith('/') ? organization.logoUrl : null,
    address: organization.branding?.address ?? null,
    contactEmail: organization.branding?.contactEmail ?? null,
    contactPhone: organization.branding?.contactPhone ?? null,
    updatedAt: organization.branding?.updatedAt?.toISOString() ?? organization.id,
  };
}));

export type OrganizationBrandingView = NonNullable<Awaited<ReturnType<typeof getOrganizationBranding>>>;
