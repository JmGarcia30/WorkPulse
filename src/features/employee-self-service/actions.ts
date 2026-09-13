'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import {
  activateEmployeeAccount,
  disableEmployeeAccount,
  EmployeeAccountError,
  enableEmployeeAccount,
  provisionEmployeeAccount,
  resendEmployeeInvitation,
} from './accounts';

function failure(error: unknown) {
  if (error instanceof EmployeeAccountError) return { error: error.message, code: error.code };
  console.error('Employee account operation failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
  return { error: 'Employee account operation failed. No unsafe changes were made.' };
}

export async function provisionEmployeeAccountAction(employeeId: string, confirmed: boolean) {
  const user = await getSession();
  if (!user || !confirmed) return { error: confirmed ? 'Unauthorized.' : 'Confirmation is required.' };
  try {
    const result = await provisionEmployeeAccount({ organizationId: user.organizationId, employeeId, actorUserId: user.userId });
    revalidatePath(`/dashboard/employees/${employeeId}`);
    return { success: true as const, ...result };
  } catch (error) { return failure(error); }
}

export async function resendEmployeeInvitationAction(accountId: string, employeeId: string, confirmed: boolean) {
  const user = await getSession();
  if (!user || !confirmed) return { error: confirmed ? 'Unauthorized.' : 'Confirmation is required.' };
  try {
    const result = await resendEmployeeInvitation({ organizationId: user.organizationId, accountId, actorUserId: user.userId });
    revalidatePath(`/dashboard/employees/${employeeId}`);
    return { success: true as const, ...result };
  } catch (error) { return failure(error); }
}

export async function disableEmployeeAccountAction(accountId: string, employeeId: string, reason: string, confirmed: boolean) {
  const user = await getSession();
  if (!user || !confirmed) return { error: confirmed ? 'Unauthorized.' : 'Confirmation is required.' };
  try {
    await disableEmployeeAccount({ organizationId: user.organizationId, accountId, actorUserId: user.userId, reason });
    revalidatePath(`/dashboard/employees/${employeeId}`);
    return { success: true as const };
  } catch (error) { return failure(error); }
}

export async function enableEmployeeAccountAction(accountId: string, employeeId: string, confirmed: boolean) {
  const user = await getSession();
  if (!user || !confirmed) return { error: confirmed ? 'Unauthorized.' : 'Confirmation is required.' };
  try {
    const result = await enableEmployeeAccount({ organizationId: user.organizationId, accountId, actorUserId: user.userId });
    revalidatePath(`/dashboard/employees/${employeeId}`);
    return { success: true as const, ...result };
  } catch (error) { return failure(error); }
}

export async function activateEmployeeAccountAction(input: { token: string; password: string; passwordConfirmation: string }) {
  try {
    await activateEmployeeAccount(input);
  } catch (error) {
    if (error instanceof EmployeeAccountError && (error.code === 'PASSWORD_MISMATCH' || error.code === 'INVALID_PASSWORD')) return failure(error);
    return { error: 'This activation link is invalid or expired.', code: 'INVALID_ACTIVATION' };
  }
  redirect('/login?activated=1');
}
