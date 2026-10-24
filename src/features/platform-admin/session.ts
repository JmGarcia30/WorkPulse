import 'server-only';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { classifyRequestHost } from '@/lib/tenant/host';
import { ROUTING_CONTEXT_HEADER } from '@/lib/tenant/routing-context';
import { findPlatformAdministrator } from './service';

export const PLATFORM_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-workpulse_platform' : 'workpulse_platform';

export async function requirePlatformHost() {
  const requestHeaders = await headers();
  if (classifyRequestHost(requestHeaders).kind !== 'public' || requestHeaders.has('x-workpulse-tenant-slug') || requestHeaders.has(ROUTING_CONTEXT_HEADER)) notFound();
}

export async function requirePlatformAdministrator() {
  await requirePlatformHost();
  const token = (await cookies()).get(PLATFORM_COOKIE)?.value;
  const administrator = await findPlatformAdministrator(prisma, token);
  if (!administrator) redirect('/platform/login');
  return administrator;
}
