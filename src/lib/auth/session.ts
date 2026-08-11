import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'workpulse_super_secret_jwt_key_32bytes_long_min!'
);

const COOKIE_NAME = 'workpulse_session';
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
    .sign(SECRET_KEY);

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

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as Role,
      organizationId: payload.organizationId as string,
    };
  } catch (error) {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
