import 'server-only';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { requirePlatformHost } from '@/features/platform-admin/session';
import { publicOrigin, requestAuthority } from '@/lib/tenant/host';

export async function requireRegistrationHost() {
  await requirePlatformHost();
  // Browser proof is host-only, so actions must use the same origin as email links.
  let canonical: string;
  try { canonical = new URL(publicOrigin()).host; } catch { notFound(); }
  if (requestAuthority(await headers()) !== canonical) notFound();
}
