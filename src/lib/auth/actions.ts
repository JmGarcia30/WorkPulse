'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { createSession, destroySession, getSession } from './session';
import { authenticateStaff, StaffCredentialsChanged } from './staff-security';
import { landingPathForRole } from './routing';
import { requireRequestTenant, requestWorkspacePath } from '@/lib/tenant/server';

export async function loginAction(formData: FormData) {
  const tenant = await requireRequestTenant();
  const email = formData.get('email');
  const password = formData.get('password');

  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  const user = await authenticateStaff(prisma, tenant.organizationId, email, password);
  if (!user) return { error: 'Invalid email or password, or too many attempts. Try again in 15 minutes if you have made several attempts.' };

  try { await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  }, user.passwordHash); }
  catch (error) {
    if (error instanceof StaffCredentialsChanged) return { error: error.message };
    throw error;
  }

  redirect(await requestWorkspacePath(landingPathForRole(user.role)));
}

export async function logoutAction() {
  const destination = await requestWorkspacePath('/login');
  await destroySession();
  redirect(destination);
}

export async function getCurrentUser() {
  return await getSession();
}
