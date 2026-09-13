'use server';

import { compare } from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { createSession, destroySession, getSession } from './session';
import { EmployeeAccountStatus, EmployeeStatus, Role } from '@prisma/client';
import { landingPathForRole } from './routing';

export async function loginAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true, employeeAccount: { include: { employee: true } } },
  });

  if (!user) {
    return { error: 'Invalid email or password.' };
  }

  if (!user.passwordHash) {
    return { error: 'Invalid email or password.' };
  }
  const isValidPassword = await compare(password, user.passwordHash);
  if (!isValidPassword) {
    return { error: 'Invalid email or password.' };
  }

  if (user.role === Role.EMPLOYEE) {
    const account = user.employeeAccount;
    if (!account || account.status !== EmployeeAccountStatus.ACTIVE || account.organizationId !== user.organizationId || account.employee.organizationId !== user.organizationId || account.employee.employeeStatus !== EmployeeStatus.ACTIVE) {
      return { error: 'Invalid email or password.' };
    }
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  });

  redirect(landingPathForRole(user.role));
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

export async function getCurrentUser() {
  return await getSession();
}
