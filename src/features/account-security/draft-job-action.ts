'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { COOKIE_NAME } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { deleteUnusedDraftJob } from './draft-job';
import { AccountSecurityError } from './profile';

export async function deleteDraftJobAction(jobId: string, _previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const actor = await requireBackOfficeContext();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return { error: 'Sign in again.' };
  try { await deleteUnusedDraftJob(prisma, { organizationId: actor.organizationId, userId: actor.userId, token }, jobId, form.get('confirmation')); }
  catch (error) { return { error: error instanceof AccountSecurityError ? error.message : 'The draft could not be deleted.' }; }
  revalidatePath('/dashboard/hiring/jobs');
  redirect('/dashboard/hiring/jobs');
}
