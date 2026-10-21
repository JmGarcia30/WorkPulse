import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { COOKIE_NAME } from '@/lib/auth/session';
import { candidateDocumentMatchesRequestTenant, candidatePortalMatchesRequestTenant } from '@/features/hiring/document-access';
import { databaseSlugForTenant, publicOrigin } from '@/lib/tenant/host';
import { sendEmail } from '@/lib/email';

export const candidateCookie = process.env.NODE_ENV === 'production' ? '__Host-workpulse_candidate' : 'workpulse_candidate';
export const hashCredential = (secret: string) => createHash('sha256').update(secret).digest('hex');
const secret = () => randomBytes(32).toString('hex');
export const validCandidateId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const validSlug = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,100}$/.test(value);
// The lifecycle predicate is evaluated on every request, including downloads.
export const candidateLifecycle = {
  status: { notIn: ['REJECTED', 'WITHDRAWN'] as ('REJECTED' | 'WITHDRAWN')[] },
  NOT: { status: 'HIRED' as const, onboarding: { is: { status: 'COMPLETED' as const } } },
};

// Include this in the final upload UPDATE so revocation during storage work
// cannot authorize a subsequent database mutation.
export async function candidateWriteScope() {
  const credential = (await cookies()).get(candidateCookie)?.value || '';
  return { ...candidateLifecycle, candidateAccess: { is: { revoked: false, sessionHash: hashCredential(credential), sessionExpiresAt: { gt: new Date() } } } };
}

export async function candidateHasAccess(applicationId: string, organizationSlug?: string) {
  if (!validCandidateId(applicationId) || (organizationSlug !== undefined && !validSlug(organizationSlug))) return false;
  const jar = await cookies();
  // Candidate paths never reinterpret a staff session, including invalid cookies.
  if (jar.has(COOKIE_NAME)) return false;
  const credential = jar.get(candidateCookie)?.value;
  if (!credential || !/^[a-f0-9]{64}$/.test(credential)) return false;
  if (organizationSlug && !await candidatePortalMatchesRequestTenant(organizationSlug)) return false;
  const grant = await prisma.candidateAccess.findFirst({
    where: { applicationId, sessionHash: hashCredential(credential), sessionExpiresAt: { gt: new Date() }, revoked: false,
      application: { ...candidateLifecycle, ...(organizationSlug ? { job: { organization: { slug: databaseSlugForTenant(organizationSlug) } } } : {}) } },
    select: { application: { select: { job: { select: { organizationId: true } } } } },
  });
  return !!grant && await candidateDocumentMatchesRequestTenant(grant.application.job.organizationId);
}

// No identity or existence information is returned to the caller.
export async function issueCandidateLink(slug: string, applicationId: string, email?: string) {
  if (!validSlug(slug) || !validCandidateId(applicationId) || (email !== undefined && typeof email !== 'string')) return;
  if (!await candidatePortalMatchesRequestTenant(slug)) return;
  const application = await prisma.application.findFirst({ where: { id: applicationId, ...candidateLifecycle, job: { organization: { slug: databaseSlugForTenant(slug) } } }, select: { applicant: { select: { email: true } } } });
  if (!application || (email !== undefined && application.applicant.email.toLowerCase() !== email.trim().toLowerCase())) return;
  const token = secret(), linkHash = hashCredential(token), now = new Date();
  const reserved = await prisma.$transaction(async tx => {
    await tx.candidateAccess.upsert({ where: { applicationId }, create: { applicationId }, update: {} });
    await tx.$queryRaw`SELECT "applicationId" FROM "CandidateAccess" WHERE "applicationId" = ${applicationId} FOR UPDATE`;
    const row = await tx.candidateAccess.findUniqueOrThrow({ where: { applicationId } });
    const reset = now.getTime() - row.windowStartedAt.getTime() >= 3600000;
    if (row.revoked || (row.lastSentAt && now.getTime() - row.lastSentAt.getTime() < 60000) || (!reset && row.sendCount >= 5)) return false;
    await tx.candidateAccess.update({ where: { applicationId }, data: { linkHash, linkExpiresAt: new Date(now.getTime() + 900000), delivered: false, lastSentAt: now, sendCount: reset ? 1 : row.sendCount + 1, ...(reset ? { windowStartedAt: now } : {}) } });
    return true;
  });
  if (!reserved) return;
  // Configured canonical origin, never a caller-controlled Host header.
  const url = `${publicOrigin()}/careers/${encodeURIComponent(slug)}/portal/${encodeURIComponent(applicationId)}/verify#token=${token}`;
  let delivered = false;
  try {
    const result = await sendEmail({ to: application.applicant.email, subject: 'Verify your WorkPulse application', sensitive: true, text: `Verify email ownership to access your application. This one-time link expires in 15 minutes: ${url}`, html: `<p>Verify email ownership to access your application.</p><p><a href="${url}">Verify application</a></p><p>This one-time link expires in 15 minutes.</p>` });
    delivered = result.success && result.mode === 'smtp';
  } finally {
    await prisma.candidateAccess.updateMany({ where: { applicationId, linkHash, revoked: false }, data: delivered ? { delivered: true } : { linkHash: null, linkExpiresAt: null, delivered: false } });
  }
}

export async function consumeCandidateLink(slug: string, applicationId: string, token: string) {
  if (!validSlug(slug) || !validCandidateId(applicationId) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !await candidatePortalMatchesRequestTenant(slug) || (await cookies()).has(COOKIE_NAME)) return false;
  const credential = secret(), expires = new Date(Date.now() + 86400000);
  const updated = await prisma.candidateAccess.updateMany({
    where: { applicationId, linkHash: hashCredential(token), delivered: true, linkExpiresAt: { gt: new Date() }, revoked: false,
      application: { ...candidateLifecycle, job: { organization: { slug: databaseSlugForTenant(slug) } } } },
    data: { linkHash: null, linkExpiresAt: null, delivered: false, sessionHash: hashCredential(credential), sessionExpiresAt: expires },
  });
  if (updated.count !== 1) return false;
  (await cookies()).set(candidateCookie, credential, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 86400, expires });
  return true;
}
