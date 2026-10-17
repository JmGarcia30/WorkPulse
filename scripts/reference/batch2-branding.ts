import type { Prisma } from '@prisma/client';




import { brandColorSchema, readableForeground } from '@/features/organization-branding/schema';

const DEFAULT_PRIMARY = '#17324D';
const DEFAULT_ACCENT = '#167D77';

function safeColor(value: string | null | undefined, fallback: string) {
  const parsed = brandColorSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export async function getOrganizationBranding(organizationId: string, db: Prisma.TransactionClient) {
  const organization = await db.organization.findUnique({
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
    hasLogo: Boolean(organization.branding?.logoStorageKey),
    hasLoginImage: Boolean(organization.branding?.loginImageStorageKey),
    legacyLogoUrl: organization.logoUrl?.startsWith('/') ? organization.logoUrl : null,
    address: organization.branding?.address ?? null,
    contactEmail: organization.branding?.contactEmail ?? null,
    contactPhone: organization.branding?.contactPhone ?? null,
    updatedAt: organization.branding?.updatedAt?.toISOString() ?? organization.id,
  };
}

export type OrganizationBrandingView = NonNullable<Awaited<ReturnType<typeof getOrganizationBranding>>>;
