import 'server-only';
import { randomBytes } from 'node:crypto';
import { hash, compare } from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { createEmployeeInvitation, hashActivationToken, isActivationTokenFormatValid } from '@/features/employee-self-service/activation';
import { initializeOrganization, OrganizationOnboardingError, workspaceActivationOrigin } from '@/features/platform-admin/onboarding';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';
import { platformEmail } from '@/features/platform-admin/credentials';
import { workspaceSlug } from '@/features/platform-admin/onboarding-schema';
import { parsePlatformHost, publicOrigin } from '@/lib/tenant/host';
import { sendCompanyRegistrationVerificationEmail } from '@/lib/email';
import { companyRegistration, companySlugBase, type RegistrationInput } from './schema';

export class RegistrationError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
function fail(code: string, message: string): never { throw new RegistrationError(code, message); }
type Sender = typeof sendCompanyRegistrationVerificationEmail;
const options = { maxWait: 10000, timeout: 20000 };
const pendingMessage = 'Check your email for a verification link. If you already have an account, sign in to your workspace. Open the link in this browser.';

function verificationOrigin() {
  workspaceActivationOrigin('registration-check');
  let url: URL;
  try { url = new URL(publicOrigin()); } catch { return fail('SETUP_REQUIRED', 'Company registration is not configured. Please try again later.'); }
  if (parsePlatformHost(url.host).kind !== 'public' || url.pathname !== '/' || url.search || url.hash || url.username || url.password || (url.protocol !== 'https:' && !(url.hostname === 'localhost' && url.protocol === 'http:'))) {
    fail('SETUP_REQUIRED', 'Company registration is not configured. Please try again later.');
  }
  return url.origin;
}

async function budget(db: PrismaClient, purpose: 'submit' | 'verify', identity: string) {
  // Commit budgets independently: failed validation/verification cannot roll them back.
  const allowed = await db.$transaction(async tx => {
    if (!await consumeAuthenticationAttempt(tx, 'company-registration:' + purpose + ':global', purpose === 'submit' ? 200 : 500)) return false;
    return consumeAuthenticationAttempt(tx, 'company-registration:' + purpose + ':' + identity, purpose === 'submit' ? 5 : 20);
  }, options);
  if (!allowed) fail('RATE_LIMITED', 'Too many attempts. Please try again in 15 minutes.');
}

async function emailProof(db: PrismaClient, record: { id: string; email: string; companyName: string }, invitation: ReturnType<typeof createEmployeeInvitation>, sender: Sender) {
  let success = false;
  try {
    success = (await sender({ to: record.email, organizationName: record.companyName, expiresAt: invitation.expiresAt,
      activationUrl: verificationOrigin() + '/register/verify#token=' + encodeURIComponent(invitation.token) })).success;
  } catch { /* Never retain provider errors or secret-bearing message content. */ }
  await db.companyRegistration.updateMany({ where: { id: record.id, tokenHash: invitation.hash, verifiedAt: null }, data: { deliveryStatus: success ? 'SENT' : 'FAILED' } });
  if (!success) fail('DELIVERY_FAILED', 'We could not send your verification email. Your workspace has not been created. Try sending again after 60 seconds.');
}

export async function registerCompany(db: PrismaClient, raw: RegistrationInput, browserProof: string, sender: Sender = sendCompanyRegistrationVerificationEmail) {
  const parsed = companyRegistration.safeParse(raw);
  if (!parsed.success) fail('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Review your registration details.');
  if (!isActivationTokenFormatValid(browserProof)) fail('INVALID_INPUT', 'Please reload the registration page and try again.');
  verificationOrigin();
  const input = parsed.data;
  await budget(db, 'submit', input.email);
  const passwordHash = await hash(input.password, 12);
  const invitation = createEmployeeInvitation();
  const browserHash = hashActivationToken(browserProof);
  const record = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'tenant-login-email:' + input.email}, 0))::text`;
    if (await tx.user.findFirst({ where: { email: { equals: input.email, mode: 'insensitive' } }, select: { id: true } })) return null;
    const previous = await tx.companyRegistration.findUnique({ where: { email: input.email } });
    if (previous?.verifiedAt) return null;
    // Never replace a live registration's name/password with an unauthenticated retry.
    if (previous && previous.expiresAt > new Date()) return null;
    const data = { companyName: input.companyName, administratorName: input.administratorName, passwordHash, browserHash,
      tokenHash: invitation.hash, expiresAt: invitation.expiresAt, lastIssuedAt: new Date(), deliveryStatus: 'PENDING' as const };
    return tx.companyRegistration.upsert({ where: { email: input.email }, create: { email: input.email, ...data }, update: data });
  }, options);
  if (record) await emailProof(db, record, invitation, sender);
  return { success: pendingMessage, email: input.email };
}

export async function resendCompanyVerification(db: PrismaClient, email: string, browserProof: string, sender: Sender = sendCompanyRegistrationVerificationEmail) {
  const parsed = platformEmail.safeParse(email);
  if (!parsed.success || !isActivationTokenFormatValid(browserProof)) fail('INVALID_INPUT', 'Return to company registration and try again.');
  verificationOrigin();
  await budget(db, 'submit', parsed.data);
  const invitation = createEmployeeInvitation();
  const record = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'tenant-login-email:' + parsed.data}, 0))::text`;
    const previous = await tx.companyRegistration.findUnique({ where: { email: parsed.data } });
    if (!previous || previous.verifiedAt || previous.browserHash !== hashActivationToken(browserProof) || previous.expiresAt <= new Date()) return null;
    if (Date.now() - previous.lastIssuedAt.getTime() < 60000) fail('COOLDOWN', 'Wait 60 seconds before sending another verification email.');
    return tx.companyRegistration.update({ where: { id: previous.id }, data: { tokenHash: invitation.hash, expiresAt: invitation.expiresAt, lastIssuedAt: new Date(), deliveryStatus: 'PENDING' } });
  }, options);
  if (record) await emailProof(db, record, invitation, sender);
  return { success: pendingMessage, email: parsed.data };
}

async function availableSlug(tx: Prisma.TransactionClient, name: string) {
  const base = companySlugBase(name);
  for (let index = 0; index < 8; index++) {
    const slug = workspaceSlug.parse(index === 0 ? base : base + '-' + randomBytes(5).toString('hex'));
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'workspace-slug:' + slug}, 0))::text`;
    if (!await tx.organization.findFirst({ where: { slug: { equals: slug, mode: 'insensitive' } }, select: { id: true } })) return slug;
  }
  return fail('RETRY_REQUIRED', 'We could not reserve your workspace. Please try verification again.');
}

export async function verifyCompanyRegistration(db: PrismaClient, token: string, browserProof: string, registrationPassword = '') {
  if (!isActivationTokenFormatValid(token)) fail('INVALID_VERIFICATION', 'Paste the complete verification link or code from your email.');
  if (Buffer.byteLength(registrationPassword, 'utf8') > 72) fail('INVALID_VERIFICATION', 'Invalid verification credentials.');
  verificationOrigin();
  await budget(db, 'verify', hashActivationToken(browserProof));
  return db.$transaction(async tx => {
    const initial = await tx.companyRegistration.findUnique({ where: { tokenHash: hashActivationToken(token) }, select: { email: true } });
    if (!initial) fail('INVALID_VERIFICATION', 'This verification link is invalid, expired, or already used.');
    // Same email lock/order as manual onboarding and registration/resend.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'tenant-login-email:' + initial.email}, 0))::text`;
    const record = await tx.companyRegistration.findUnique({ where: { tokenHash: hashActivationToken(token) } });
    if (!record || record.verifiedAt || record.expiresAt <= new Date() || !record.passwordHash) {
      fail('INVALID_VERIFICATION', 'This link is invalid or expired. Use the latest verification email.');
    }
    const sameBrowser = isActivationTokenFormatValid(browserProof) && record.browserHash === hashActivationToken(browserProof);
    if (!sameBrowser && !(registrationPassword.length >= 14 && await compare(registrationPassword, record.passwordHash))) {
      fail('INVALID_VERIFICATION', 'Verification requires the original browser or the password used when registering.');
    }
    const slug = await availableSlug(tx, record.companyName);
    let org;
    try {
      ({ org } = await initializeOrganization(tx, { name: record.companyName, slug, contactEmail: record.email, timeZone: 'UTC', administratorEmail: record.email }, { name: record.administratorName, passwordHash: record.passwordHash }));
    } catch (error) {
      if (error instanceof OrganizationOnboardingError && error.code === 'EMAIL_IN_USE') fail('EMAIL_IN_USE', 'This email already has a workspace account. Sign in using your existing workspace.');
      throw error;
    }
    await tx.companyRegistration.update({ where: { id: record.id }, data: { organizationId: org.id, verifiedAt: new Date(), tokenHash: null, passwordHash: null } });
    await tx.platformOrganizationAudit.create({ data: { organizationId: org.id, action: 'SELF_SERVICE_ORGANIZATION_VERIFIED', operationKey: record.id } });
    return { loginUrl: workspaceActivationOrigin(org.slug) + '/login?registered=1' };
  }, options);
}
