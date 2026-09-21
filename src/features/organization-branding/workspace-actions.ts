'use server';

import { prisma } from '@/lib/db/prisma';

export async function workspaceExists(slug: string) {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) return { ok: false as const, message: 'Enter a valid workspace name.' };
  const organization = await prisma.organization.findUnique({ where: { slug: normalized }, select: { id: true } });
  return organization ? { ok: true as const, slug: normalized } : { ok: false as const, message: 'We could not find that workspace.' };
}
