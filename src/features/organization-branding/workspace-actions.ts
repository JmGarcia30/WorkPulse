'use server';

import { prisma } from '@/lib/db/prisma';
import { databaseSlugForTenant } from '@/lib/tenant/host';

export async function workspaceExists(slug: string) {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) return { ok: false as const, message: 'Enter a valid workspace name.' };
  const organization = await prisma.organization.findUnique({ where: { slug: databaseSlugForTenant(normalized) }, select: { id: true } });
  return organization ? { ok: true as const, slug: normalized } : { ok: false as const, message: 'We could not find that workspace.' };
}
