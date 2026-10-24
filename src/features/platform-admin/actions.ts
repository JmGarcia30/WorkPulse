'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { PLATFORM_COOKIE, requirePlatformAdministrator, requirePlatformHost } from './session';
import { authenticatePlatformAdministrator, PLATFORM_SESSION_SECONDS, revokePlatformSession, updatePlatformAccount } from './service';
import type { PlatformFormState } from './credentials';

export async function platformLoginAction(_previous: PlatformFormState, form: FormData): Promise<PlatformFormState> {
  await requirePlatformHost();
  const session = await authenticatePlatformAdministrator(prisma, form.get('email'), form.get('password'));
  if (!session) return { error: 'Sign-in failed. Check your credentials, or try again in 15 minutes if you have made several attempts.' };
  const jar = await cookies();
  // Revoke this browser's previous session, preventing session accumulation/fixation.
  await revokePlatformSession(prisma, jar.get(PLATFORM_COOKIE)?.value);
  jar.set(PLATFORM_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: PLATFORM_SESSION_SECONDS, expires: session.expiresAt });
  redirect('/platform');
}

export async function platformLogoutAction() {
  await requirePlatformHost();
  const jar = await cookies();
  await revokePlatformSession(prisma, jar.get(PLATFORM_COOKIE)?.value);
  jar.delete(PLATFORM_COOKIE);
  redirect('/platform/login');
}

export async function platformAccountAction(_previous: PlatformFormState, form: FormData): Promise<PlatformFormState> {
  await requirePlatformAdministrator();
  const jar = await cookies();
  const result = await updatePlatformAccount(prisma, jar.get(PLATFORM_COOKIE)!.value, {
    name: form.get('name'), currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword'),
  });
  if ('reauthenticate' in result) {
    jar.delete(PLATFORM_COOKIE);
    redirect('/platform/login');
  }
  revalidatePath('/platform', 'layout');
  return result;
}
