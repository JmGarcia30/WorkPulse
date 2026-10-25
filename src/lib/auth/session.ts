import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { measureDevelopment } from '@/lib/performance/diagnostics';
import { resolveRequestTenant } from '@/lib/tenant/server';
import { persistStaffSession, staffAccountAvailable, staffTokenHash, staffUserSelection } from './staff-security';

// Memoized only within a Server Component render, never across requests.
// Server Actions and Route Handlers execute a fresh lookup.
const getCurrentStaffSession = cache(async (tokenHash: string) => measureDevelopment('session validation', () => prisma.staffSession.findUnique({
  where: { tokenHash },
  select: { userId: true, organizationId: true, expiresAt: true, user: { select: staffUserSelection } },
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
const SESSION_SECONDS = 7 * 24 * 60 * 60;

export interface UserSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
}

export async function createSession(payload: UserSessionPayload, expectedPasswordHash?: string): Promise<string> {
  const expiresAt = new Date((Math.floor(Date.now() / 1000) + SESSION_SECONDS) * 1000);
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setJti(randomBytes(32).toString('hex'))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(sessionSecret());

  await persistStaffSession(prisma, payload, token, expiresAt, expectedPasswordHash);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_SECONDS,
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
  if (typeof payload.userId !== 'string' || typeof payload.organizationId !== 'string' || typeof payload.role !== 'string'
    || typeof payload.jti !== 'string' || !/^[a-f0-9]{64}$/.test(payload.jti)) return null;
  // A valid JWT is still unusable outside its persisted request workspace. This
  // applies to every session consumer, including legacy document/API handlers.
  const tenant = await resolveRequestTenant();
  if (!tenant || tenant.organizationId !== payload.organizationId) return null;
  // A signed JWT authenticates its issuance, not today's permissions. Preserve
  // the existing guard policy: role/membership changes require a fresh login.
  // Database failures propagate rather than silently becoming anonymous access.
  const stored = await getCurrentStaffSession(staffTokenHash(token));
  const user = stored?.user;
  if (!stored || stored.expiresAt <= new Date() || stored.userId !== payload.userId || stored.organizationId !== payload.organizationId
    || !user || user.role !== payload.role || user.organizationId !== payload.organizationId || !staffAccountAvailable(user)) return null;
  return { userId: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    // Never revoke another tenant's token. A failed database revocation propagates;
    // logout must not claim success while a copied token remains active.
    const tenant = await resolveRequestTenant();
    if (!tenant) throw new Error('Staff sign-out requires its workspace.');
    await prisma.staffSession.deleteMany({ where: { tokenHash: staffTokenHash(token), organizationId: tenant.organizationId } });
  }
  cookieStore.delete(COOKIE_NAME);
}
