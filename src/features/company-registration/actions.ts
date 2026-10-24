'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireRegistrationHost } from './host';
import { isActivationTokenFormatValid } from '@/features/employee-self-service/activation';
import { RegistrationError, registerCompany, resendCompanyVerification, verifyCompanyRegistration } from './service';
import type { RegistrationState } from './schema';

const cookieName = process.env.NODE_ENV === 'production' ? '__Host-workpulse_registration' : 'workpulse_registration';
function failure(error: unknown): RegistrationState {
  return { error: error instanceof RegistrationError ? error.message : 'We could not complete your request. Please try again shortly.' };
}
async function browserProof(create: boolean) {
  const jar = await cookies();
  const previous = jar.get(cookieName)?.value;
  if (previous && isActivationTokenFormatValid(previous) && !create) return previous;
  if (!create) return '';
  const proof = previous && isActivationTokenFormatValid(previous) ? previous : randomBytes(32).toString('base64url');
  jar.set(cookieName, proof, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 24 * 60 * 60 });
  return proof;
}

export async function registerCompanyAction(_state: RegistrationState, form: FormData): Promise<RegistrationState> {
  await requireRegistrationHost();
  const email = String(form.get('email') ?? '');
  try {
    return await registerCompany(prisma, { companyName: String(form.get('companyName') ?? ''), administratorName: String(form.get('administratorName') ?? ''), email, password: String(form.get('password') ?? '') }, await browserProof(true));
  } catch (error) {
    return { ...failure(error), ...(error instanceof RegistrationError && error.code === 'DELIVERY_FAILED' ? { email } : {}) };
  }
}

export async function resendCompanyVerificationAction(_state: RegistrationState, form: FormData): Promise<RegistrationState> {
  await requireRegistrationHost();
  try { return await resendCompanyVerification(prisma, String(form.get('email') ?? ''), await browserProof(false)); }
  catch (error) { return failure(error); }
}

export async function verifyCompanyRegistrationAction(_state: RegistrationState, form: FormData): Promise<RegistrationState> {
  await requireRegistrationHost();
  let loginUrl: string;
  try { ({ loginUrl } = await verifyCompanyRegistration(prisma, String(form.get('token') ?? ''), await browserProof(false))); }
  catch (error) { return failure(error); }
  revalidatePath('/platform');
  redirect(loginUrl);
}
