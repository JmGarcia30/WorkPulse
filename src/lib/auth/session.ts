import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { measureDevelopment } from '@/lib/performance/diagnostics';
import { resolveRequestTenant } from '@/lib/tenant/server';

// Memoized only within a Server Component render, never across requests.
// Server Actions and Route Handlers execute a fresh lookup.
const getCurrentSessionUser = cache(async (userId: string) => measureDevelopment('session validation', () => prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, name: true, email: true, role: true, organizationId: true },
})));

function sessionSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters.');
  }
  return new TextEncoder().encode('workpulse_development_only_session_secret_32bytes');
}

export const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-workpulse_session' : 'workpulse_session';
const EXPIRATION_TIME = '7d';

export interface UserSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
}

export async function createSession(payload: UserSessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRATION_TIME)
    .sign(sessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return token;
}

export async function getSession(): Promise<UserSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let payload;
  try {
    ({ payload } = await jwtVerify(token, sessionSecret()));
  } catch {
    return null;
  }
  if (typeof payload.userId !== 'string' || typeof payload.organizationId !== 'string' || typeof payload.role !== 'string') return null;
  // A valid JWT is still unusable outside its persisted request workspace. This
  // applies to every session consumer, including legacy document/API handlers.
  const tenant = await resolveRequestTenant();
  if (!tenant || tenant.organizationId !== payload.organizationId) return null;
  // A signed JWT authenticates its issuance, not today's permissions. Preserve
  // the existing guard policy: role/membership changes require a fresh login.
  // Database failures propagate rather than silently becoming anonymous access.
  const user = await getCurrentSessionUser(payload.userId);
  if (!user || user.role !== payload.role || user.organizationId !== payload.organizationId) return null;
  return { userId: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
