import 'server-only';

import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { measureDevelopment } from '@/lib/performance/diagnostics';
import { databaseSlugForTenant } from '@/lib/tenant/host';
import { readOrganizationBranding } from './data';

export const getOrganizationBranding = cache(async (organizationId: string) =>
  measureDevelopment('branding read', () => readOrganizationBranding(prisma, { id: organizationId })));

export const getOrganizationBrandingBySlug = cache(async (slug: string) =>
  measureDevelopment('branding read', () => readOrganizationBranding(prisma, { slug: databaseSlugForTenant(slug) })));

export type OrganizationBrandingView = NonNullable<Awaited<ReturnType<typeof getOrganizationBranding>>>;