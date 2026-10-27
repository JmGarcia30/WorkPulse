import 'server-only';
import { hash } from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { organizationCreation, type OrganizationCreationInput } from './onboarding-schema';
import { platformName, platformPassword } from './credentials';
import { tokenHash } from './service';
import { createEmployeeInvitation, hashActivationToken, isActivationTokenFormatValid } from '@/features/employee-self-service/activation';
import { sendOrganizationAdministratorActivationEmail } from '@/lib/email';
import { normalizeHostname, parsePlatformHost, publicOrigin, rootDomain, tenantOrigin, usesTemporaryPathTenancy } from '@/lib/tenant/host';

export class OrganizationOnboardingError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
function fail(code: string, message: string): never { throw new OrganizationOnboardingError(code, message); }
type DeliveryInput = Parameters<typeof sendOrganizationAdministratorActivationEmail>[0];
export type InvitationSender = (input: DeliveryInput) => Promise<{ success: boolean }>;
const transactionOptions = { maxWait: 10000, timeout: 20000 };

async function lock(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}
async function assertActor(tx: Prisma.TransactionClient, actorId: string) {
  if (!await tx.platformAdministrator.findFirst({ where: { id: actorId, disabledAt: null }, select: { id: true } })) fail('FORBIDDEN', 'Platform administrator authorization is required.');
}
export function workspaceActivationOrigin(slug: string) {
  const root = rootDomain();
  if (!process.env.PLATFORM_ROOT_DOMAIN) fail('SETUP_REQUIRED', 'Configure the platform root before creating organizations.');
  if (usesTemporaryPathTenancy(root)) {
    // Stable HTTPS single-host demo: /saga for the legacy school, /w/:slug for new organizations.
    // Every request remains scoped to a signed proxy context and verified tenant session.
    const publicUrl = new URL(publicOrigin());
    if (publicUrl.host !== root || publicUrl.protocol !== 'https:') fail('SETUP_REQUIRED', 'Configure matching HTTPS public and root hosts.');
    const path = slug === 'st-aloysius' || slug === 'saga' ? '/saga' : '/w/' + slug;
    return publicUrl.origin + path;
  }
  if (normalizeHostname(root).endsWith('.vercel.app')) fail('SETUP_REQUIRED', 'Use the canonical Vercel domain for temporary path tenancy, or configure a custom root domain.');
  const origin = tenantOrigin(slug);
  let url: URL;
  try { url = new URL(origin); } catch { return fail('SETUP_REQUIRED', 'Configure an absolute tenant origin.'); }
  const parsed = parsePlatformHost(url.host);
  if (parsed.kind !== 'tenant' || parsed.slug !== slug || url.pathname !== '/' || url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && normalizeHostname(root) !== 'localhost')) fail('SETUP_REQUIRED', 'Configure HTTPS tenant subdomains (localhost is supported for isolated testing).');
  return url.origin;
}

/** Shared tenant initializer. Call only inside an authorized/verified transaction. */
export async function initializeOrganization(tx: Prisma.TransactionClient, raw: Omit<OrganizationCreationInput, 'requestKey'>, administrator: { name: string; passwordHash: string | null }) {
  const input = organizationCreation.omit({ requestKey: true }).parse(raw);
  workspaceActivationOrigin(input.slug);
  await lock(tx, 'tenant-login-email:' + input.administratorEmail);
  await lock(tx, 'workspace-slug:' + input.slug);
  if (await tx.organization.findFirst({ where: { slug: { equals: input.slug, mode: 'insensitive' } }, select: { id: true } })) fail('DUPLICATE_WORKSPACE', 'This workspace identifier is already registered. Choose another slug.');
  if (await tx.user.findFirst({ where: { email: { equals: input.administratorEmail, mode: 'insensitive' } }, select: { id: true } })) fail('EMAIL_IN_USE', 'This HR administrator email is already assigned to a workspace. Use a different email; existing accounts cannot be reassigned.');
  const org = await tx.organization.create({ data: { name: input.name, slug: input.slug, contactEmail: input.contactEmail, timeZone: input.timeZone, careersEnabled: false } });
  const user = await tx.user.create({ data: { organizationId: org.id, email: input.administratorEmail, name: platformName.parse(administrator.name), role: 'HR_ADMIN', passwordHash: administrator.passwordHash } });
  return { org, user };
}

/** Email is a post-commit side effect. No bearer token is returned to the platform client. */
async function deliver(db: PrismaClient, input: { id: string; organizationId: string; actorId: string; version: number; email: string; organizationName: string; slug: string; token: string; expiresAt: Date }, sender: InvitationSender) {
  let sent = false;
  try {
    sent = (await sender({ to: input.email, organizationName: input.organizationName, activationUrl: `${workspaceActivationOrigin(input.slug)}/activate/organization-admin#token=${encodeURIComponent(input.token)}`, expiresAt: input.expiresAt })).success;
  } catch { /* Delivery failures are persisted without retaining the secret or provider error. */ }
  await db.$transaction(async tx => {
    const updated = await tx.organizationAdministratorInvitation.updateMany({ where: { id: input.id, version: input.version, tokenHash: hashActivationToken(input.token), status: 'PENDING', deliveryStatus: 'PENDING' }, data: { deliveryStatus: sent ? 'SENT' : 'FAILED' } });
    if (updated.count) await tx.platformOrganizationAudit.create({ data: { organizationId: input.organizationId, actorAdministratorId: input.actorId, action: sent ? 'INVITATION_SENT' : 'INVITATION_DELIVERY_FAILED', invitationVersion: input.version } });
  }, transactionOptions);
  return sent ? undefined : 'Organization created; invitation email was not delivered. Configure SMTP and resend the pending invitation. No password or activation link is exposed here.';
}

export async function createOrganization(db: PrismaClient, actorId: string, raw: OrganizationCreationInput, sender: InvitationSender = sendOrganizationAdministratorActivationEmail) {
  const validated = organizationCreation.safeParse(raw);
  if (!validated.success) fail('INVALID_INPUT', validated.error.issues[0]?.message ?? 'Review the organization details.');
  const input = validated.data;
  workspaceActivationOrigin(input.slug);
  const requestHash = tokenHash(JSON.stringify([input.name, input.slug, input.contactEmail, input.timeZone, input.administratorEmail]));
  const invitation = createEmployeeInvitation();
  try {
    const result = await db.$transaction(async tx => {
      await assertActor(tx, actorId);
      await lock(tx, 'organization-create:' + input.requestKey);
      const previous = await tx.organizationAdministratorInvitation.findUnique({ where: { creationKey: input.requestKey } });
      if (previous) {
        if (previous.requestHash !== requestHash || previous.createdById !== actorId) fail('IDEMPOTENCY_CONFLICT', 'This request was already used for different organization details. Start a new create form.');
        return { organizationId: previous.organizationId, delivery: null };
      }
      const { org, user } = await initializeOrganization(tx, input, { name: 'HR Administrator', passwordHash: null });
      const record = await tx.organizationAdministratorInvitation.create({ data: { organizationId: org.id, userId: user.id, email: input.administratorEmail, createdById: actorId, creationKey: input.requestKey, requestHash, tokenHash: invitation.hash, expiresAt: invitation.expiresAt } });
      await tx.platformOrganizationAudit.createMany({ data: [
        { organizationId: org.id, actorAdministratorId: actorId, action: 'ORGANIZATION_CREATED' },
        { organizationId: org.id, actorAdministratorId: actorId, action: 'INVITATION_ISSUED', invitationVersion: 1 },
      ] });
      return { organizationId: org.id, delivery: { id: record.id, organizationId: org.id, actorId, version: 1, email: input.administratorEmail, organizationName: org.name, slug: org.slug, token: invitation.token, expiresAt: invitation.expiresAt } };
    }, transactionOptions);
    const warning = result.delivery ? await deliver(db, result.delivery, sender) : undefined;
    return { organizationId: result.organizationId, warning };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') fail('CONFLICT', 'The workspace or administrator email was just registered. Review the organization list before retrying.');
    throw error;
  }
}

export async function manageAdministratorInvitation(db: PrismaClient, actorId: string, input: { organizationId: string; requestKey: string; action: 'RESEND' | 'REVOKE' }, sender: InvitationSender = sendOrganizationAdministratorActivationEmail) {
  if (!/^[a-f0-9-]{36}$/i.test(input.requestKey) || !input.organizationId || !['RESEND', 'REVOKE'].includes(input.action)) fail('INVALID_INPUT', 'A valid invitation action and request identifier are required.');
  const result = await db.$transaction(async tx => {
    await assertActor(tx, actorId);
    await lock(tx, 'invitation-operation:' + input.requestKey);
    const previous = await tx.platformOrganizationAudit.findUnique({ where: { operationKey: input.requestKey } });
    if (previous) {
      if (previous.organizationId !== input.organizationId || previous.actorAdministratorId !== actorId || previous.action !== 'INVITATION_' + input.action) fail('IDEMPOTENCY_CONFLICT', 'This request identifier was already used for another action.');
      return null;
    }
    await tx.$queryRaw`SELECT id FROM "OrganizationAdministratorInvitation" WHERE "organizationId" = ${input.organizationId} FOR UPDATE`;
    const record = await tx.organizationAdministratorInvitation.findUnique({ where: { organizationId: input.organizationId }, include: { organization: { select: { name: true, slug: true } } } });
    if (!record || record.status !== 'PENDING') fail('NOT_PENDING', 'Only pending invitations can be resent or revoked. Activated accounts are unchanged.');
    let delivery = null;
    if (input.action === 'REVOKE') {
      await tx.organizationAdministratorInvitation.update({ where: { id: record.id }, data: { status: 'REVOKED', revokedAt: new Date(), tokenHash: null } });
    } else {
      workspaceActivationOrigin(record.organization.slug);
      if (Date.now() - record.lastIssuedAt.getTime() < 60000) fail('INVITATION_COOLDOWN', 'Wait 60 seconds between invitation issues, then resend.');
      const invitation = createEmployeeInvitation();
      await tx.organizationAdministratorInvitation.update({ where: { id: record.id }, data: { tokenHash: invitation.hash, expiresAt: invitation.expiresAt, lastIssuedAt: new Date(), version: { increment: 1 }, deliveryStatus: 'PENDING' } });
      delivery = { id: record.id, organizationId: record.organizationId, actorId, version: record.version + 1, email: record.email, organizationName: record.organization.name, slug: record.organization.slug, token: invitation.token, expiresAt: invitation.expiresAt };
    }
    await tx.platformOrganizationAudit.create({ data: { organizationId: record.organizationId, actorAdministratorId: actorId, action: 'INVITATION_' + input.action, operationKey: input.requestKey, invitationVersion: record.version + (input.action === 'RESEND' ? 1 : 0) } });
    return delivery;
  }, transactionOptions);
  return { warning: result ? await deliver(db, result, sender) : undefined };
}

export async function activateOrganizationAdministrator(db: PrismaClient, organizationId: string, input: { token: string; name: string; password: string; passwordConfirmation: string }) {
  if (typeof input.token !== 'string' || !isActivationTokenFormatValid(input.token)) fail('INVALID_ACTIVATION', 'This activation link is invalid or expired. Request a new invitation.');
  const name = platformName.safeParse(input.name), password = platformPassword.safeParse(input.password);
  if (!name.success || !password.success || input.password !== input.passwordConfirmation) fail('INVALID_INPUT', 'Enter your name and matching passwords of 14–72 characters, at most 72 UTF-8 bytes.');
  // Reject unknown/expired tokens before expensive password hashing. The locked
  // check below remains authoritative when activation races resend or revocation.
  if (!await db.organizationAdministratorInvitation.findFirst({ where: { tokenHash: hashActivationToken(input.token), organizationId, status: 'PENDING', expiresAt: { gt: new Date() } }, select: { id: true } })) fail('INVALID_ACTIVATION', 'This activation link is invalid or expired. Request a new invitation.');
  const passwordHash = await hash(password.data, 12);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "OrganizationAdministratorInvitation" WHERE "tokenHash" = ${hashActivationToken(input.token)} FOR UPDATE`;
    const record = await tx.organizationAdministratorInvitation.findUnique({ where: { tokenHash: hashActivationToken(input.token) }, include: { user: true } });
    if (!record || record.organizationId !== organizationId || record.status !== 'PENDING' || record.expiresAt <= new Date() || record.user.organizationId !== organizationId || record.user.role !== 'HR_ADMIN' || record.user.email !== record.email || record.user.passwordHash !== null) fail('INVALID_ACTIVATION', 'This activation link is invalid or expired. Request a new invitation.');
    await tx.user.update({ where: { id: record.userId }, data: { name: name.data, passwordHash } });
    await tx.organizationAdministratorInvitation.update({ where: { id: record.id }, data: { status: 'ACTIVATED', activatedAt: new Date(), tokenHash: null } });
    await tx.platformOrganizationAudit.create({ data: { organizationId, action: 'INVITATION_ACTIVATED', invitationVersion: record.version } });
    return { activated: true };
  }, transactionOptions);
}
