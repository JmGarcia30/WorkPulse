'use server';

import { compare } from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { createSession, destroySession, getSession } from './session';

export async function loginAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });

  if (!user) {
    return { error: 'Invalid email or password.' };
  }

  const isValidPassword = await compare(password, user.passwordHash);
  if (!isValidPassword) {
    return { error: 'Invalid email or password.' };
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  });

  redirect('/dashboard');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

export async function getCurrentUser() {
  return await getSession();
}
