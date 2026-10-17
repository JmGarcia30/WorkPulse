import { Prisma } from '@prisma/client';
import { brandColorSchema, readableForeground } from './schema';

type OrganizationRow = {
  id: string; slug: string; name: string; description: string | null;
  logoUrl: string | null; timeZone: string; careersEnabled: boolean;
  brandingUpdatedAt: Date | null;
  branding: null | {
    primaryColor: string | null; accentColor: string | null; displayName: string | null;
    tagline: string | null; logoStorageKey: string | null; loginImageStorageKey: string | null;
    address: string | null; contactEmail: string | null; contactPhone: string | null; updatedAt: string;
  };
};

function safeColor(value: string | null | undefined, fallback: string) {
  const parsed = brandColorSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

// Public branding only. Callers own request-scoped memoization; no global cache.
export async function readOrganizationBranding(db: Pick<Prisma.TransactionClient, '$queryRaw'>, key: { id: string } | { slug: string }) {
  const predicate = 'id' in key ? Prisma.sql`o."id" = ${key.id}` : Prisma.sql`o."slug" = ${key.slug}`;
  const [organization] = await db.$queryRaw<OrganizationRow[]>(Prisma.sql`
    SELECT o."id", o."slug", o."name", o."description", o."logoUrl", o."timeZone", o."careersEnabled",
      to_jsonb(b) AS "branding", b."updatedAt" AS "brandingUpdatedAt"
    FROM "Organization" o LEFT JOIN "OrganizationBranding" b ON b."organizationId" = o."id"
    WHERE ${predicate}
  `);
  if (!organization) return null;
  const primary = safeColor(organization.branding?.primaryColor, '#17324D');
  const accent = safeColor(organization.branding?.accentColor, '#167D77');
  return {
    organizationId: organization.id, slug: organization.slug, canonicalName: organization.name,
    displayName: organization.branding?.displayName || organization.name,
    tagline: organization.branding?.tagline || organization.description,
    timeZone: organization.timeZone, careersEnabled: organization.careersEnabled,
    primary, primaryForeground: readableForeground(primary), accent, accentForeground: readableForeground(accent),
    hasLogo: Boolean(organization.branding?.logoStorageKey), hasLoginImage: Boolean(organization.branding?.loginImageStorageKey),
    legacyLogoUrl: organization.logoUrl?.startsWith('/') ? organization.logoUrl : null,
    address: organization.branding?.address ?? null, contactEmail: organization.branding?.contactEmail ?? null,
    contactPhone: organization.branding?.contactPhone ?? null,
    updatedAt: organization.brandingUpdatedAt?.toISOString() ?? organization.id,
  };
}
