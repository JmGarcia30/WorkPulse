'use server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { consumeCandidateLink, issueCandidateLink, validCandidateId } from './candidate-access';
import { getDocumentStaffContext } from '@/features/hiring/document-access';
import { prisma } from '@/lib/db/prisma';

export async function requestCandidateVerification(slug: string, id: string, form: FormData) {
  try { await issueCandidateLink(slug, id, String(form.get('email') || '')); }
  catch { /* Same response for unavailable delivery and unknown application. */ }
  redirect(`/careers/${encodeURIComponent(slug)}/portal/${encodeURIComponent(id)}?sent=1`);
}

export async function verifyCandidateEmail(slug: string, id: string, token: string) {
  if ((await cookies()).has(COOKIE_NAME)) return { error: 'You are signed in to WorkPulse as staff. Open this email link in a private/incognito window to verify as an applicant.' };
  if (!await consumeCandidateLink(slug, id, token)) return { error: 'Link unavailable or expired. Request a new verification email.' };
  redirect(`/careers/${encodeURIComponent(slug)}/portal/${encodeURIComponent(id)}`);
}

export async function setCandidateAccessRevoked(id: string, revoked: boolean) {
  if (!validCandidateId(id) || typeof revoked !== 'boolean') throw Error('FORBIDDEN');
  const actor = await getDocumentStaffContext();
  if (!actor || !['ORGANIZATION_ADMIN', 'HR_ADMIN'].includes(actor.role)) throw Error('FORBIDDEN');
  await prisma.$transaction(async tx => {
    const application = await tx.application.findFirst({ where: { id, job: { organizationId: actor.organizationId } }, select: { id: true } });
    if (!application) throw Error('FORBIDDEN');
    const data = { revoked, linkHash: null, linkExpiresAt: null, delivered: false, sessionHash: null, sessionExpiresAt: null };
    await tx.candidateAccess.upsert({ where: { applicationId: id }, create: { applicationId: id, ...data }, update: data });
  });
  revalidatePath(`/dashboard/hiring/applicants/${id}`);
}
