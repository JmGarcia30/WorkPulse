'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { COOKIE_NAME, destroySession } from '@/lib/auth/session';
import { requestWorkspacePath } from '@/lib/tenant/server';
import { AccountSecurityError, changeOwnPassword, updateOwnName } from './profile';

export type AccountFormState = { error?: string; success?: string };
async function context() {
  const user = await requireBackOfficeContext();
  return { organizationId: user.organizationId, userId: user.userId, token: (await cookies()).get(COOKIE_NAME)?.value ?? '' };
}
const failure = (error: unknown) => ({ error: error instanceof AccountSecurityError ? error.message : 'The change could not be saved. Sign in again if your session expired.' });
export async function ownNameAction(_state: AccountFormState, form: FormData): Promise<AccountFormState> {
  try { await updateOwnName(prisma, await context(), form.get('name')); revalidatePath('/dashboard', 'layout'); return { success: 'Your name was updated.' }; }
  catch (error) { return failure(error); }
}
export async function ownPasswordAction(_state: AccountFormState, form: FormData): Promise<AccountFormState> {
  try { await changeOwnPassword(prisma, await context(), { currentPassword: form.get('currentPassword'), password: form.get('password'), confirmation: form.get('confirmation') }); }
  catch (error) { return failure(error); }
  await destroySession();
  redirect(await requestWorkspacePath('/login?passwordChanged=1'));
}
