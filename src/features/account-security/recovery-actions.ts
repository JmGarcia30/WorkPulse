'use server';
import { prisma } from '@/lib/db/prisma';
import { requireRequestTenant } from '@/lib/tenant/server';
import { AccountSecurityError } from './profile';
import { RECOVERY_RESPONSE, requestStaffPasswordReset, resetStaffPassword } from './recovery';
import type { AccountFormState } from './actions';
import { after } from 'next/server';

export async function forgotPasswordAction(_state: AccountFormState, form: FormData): Promise<AccountFormState> {
  const started = Date.now();
  const tenant = await requireRequestTenant();
  try { await requestStaffPasswordReset(prisma, tenant.organizationId, form.get('email'), async work => { after(work); }); } catch { /* Same public response on lookup/delivery/configuration failures. */ }
  // Delivery runs after the response, and ordinary lookup branches share a response floor.
  await new Promise(resolve => setTimeout(resolve, Math.max(0, 1000 - (Date.now() - started))));
  return { success: RECOVERY_RESPONSE };
}
export async function resetPasswordAction(_state: AccountFormState, form: FormData): Promise<AccountFormState> {
  const tenant = await requireRequestTenant();
  try { await resetStaffPassword(prisma, tenant.organizationId, { token: form.get('token'), password: form.get('password'), confirmation: form.get('confirmation') }); return { success: 'Password reset complete. All previous sessions were revoked. Sign in with your new password.' }; }
  catch (error) { return { error: error instanceof AccountSecurityError ? error.message : 'The password could not be reset. Request a new link or try again later.' }; }
}
