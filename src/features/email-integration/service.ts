import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';
import { platformEmail } from '@/features/platform-admin/credentials';
import { workspaceActivationOrigin } from '@/features/platform-admin/onboarding';
import { databaseSlugForTenant, parsePlatformHost, publicOrigin } from '@/lib/tenant/host';
import { encryptSecret, decryptSecret } from './crypto';
import { emailMessage } from './messages';
import { organizationTestEmail } from './test-email-template';
import type { EmailInlineLogo } from './google';
import { authorizationUrl, composeGmailMessage, EmailIntegrationError, googleConfiguration, googleProvider, type Credentials, type GmailProvider, type GoogleGrant } from './google';

export type EmailActor = { organizationId: string; userId: string };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const opaque = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);
const options = { maxWait: 10000, timeout: 60000 };
async function lock(tx: Prisma.TransactionClient, id: string) { await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'organization-email:' + id}, 0))::text`; }
async function actorContext(tx: Prisma.TransactionClient, actor: EmailActor) {
  const user = await tx.user.findFirst({ where: { id: actor.userId, organizationId: actor.organizationId, role: { in: ['HR_ADMIN', 'ORGANIZATION_ADMIN'] } }, select: { email: true, organization: { select: { slug: true, name: true } } } });
  if (!user) throw new EmailIntegrationError('FORBIDDEN');
  return user;
}
export async function integrationStatus(db: PrismaClient, actor: EmailActor) {
  const user = await actorContext(db as unknown as Prisma.TransactionClient, actor);
  const status = await db.organizationEmailIntegration.findUnique({ where: { organizationId: actor.organizationId }, select: { email: true, status: true, lastError: true, retryAt: true, lastSentAt: true, testedAt: true, recruitmentGmailActive: true } });
  return { legacySaga: user.organization.slug === 'st-aloysius', connection: status };
}
function workspaceBase(slug: string, supplied?: string) {
  if (!supplied) return workspaceActivationOrigin(slug);
  const url = new URL(supplied), host = parsePlatformHost(url.host);
  const validTenant = host.kind === 'tenant' && databaseSlugForTenant(host.slug) === slug && url.pathname === '/';
  const validSagaPath = slug === 'st-aloysius' && host.kind === 'public' && url.pathname === '/saga';
  if ((!validTenant && !validSagaPath) || url.protocol !== new URL(publicOrigin()).protocol || url.username || url.password || url.search || url.hash) throw new EmailIntegrationError('FORBIDDEN');
  return validSagaPath ? url.origin + '/saga' : url.origin;
}
function tenantUrl(slug: string, step: string, state: string, supplied?: string) { return workspaceBase(slug, supplied).replace(/\/saga$/, '') + '/api/email-integration/google/' + step + '?state=' + encodeURIComponent(state); }
async function attempt(tx: Prisma.TransactionClient, state: string, stage: string) {
  if (!opaque(state)) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
  const row = await tx.organizationEmailOAuthAttempt.findUnique({ where: { stateHash: hash(state) } });
  if (!row || row.stage !== stage || row.expiresAt <= new Date()) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
  const connection = await tx.organizationEmailIntegration.findUnique({ where: { organizationId: row.organizationId }, select: { generation: true } });
  if (!connection || connection.generation !== row.generation) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
  return row;
}
async function attemptOrg(db: PrismaClient, state: string) {
  if (!opaque(state)) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
  const row = await db.organizationEmailOAuthAttempt.findUnique({ where: { stateHash: hash(state) }, select: { organizationId: true } });
  if (!row) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
  return row.organizationId;
}

export async function beginConnection(db: PrismaClient, actor: EmailActor, tenantProof: string, origin?: string) {
  const config = googleConfiguration();
  if (!opaque(tenantProof)) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
  return db.$transaction(async tx => {
    await lock(tx, actor.organizationId); const user = await actorContext(tx, actor);
    const workspaceOrigin = workspaceBase(user.organization.slug, origin);
    const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
    const connection = await tx.organizationEmailIntegration.upsert({ where: { organizationId: actor.organizationId }, create: { organizationId: actor.organizationId, generation: 1 }, update: { generation: { increment: 1 } } });
    await tx.organizationEmailOAuthAttempt.deleteMany({ where: { organizationId: actor.organizationId } });
    await tx.organizationEmailOAuthAttempt.create({ data: { stateHash: hash(state), organizationId: actor.organizationId, actorId: actor.userId, tenantProofHash: hash(tenantProof), verifierCipher: encryptSecret({ verifier, workspaceOrigin }, actor.organizationId + ':oauth:' + hash(state)), generation: connection.generation, expiresAt: new Date(Date.now() + 600000) } });
    return { url: config.origin + '/api/email-integration/google/start?state=' + state };
  }, options);
}
// Central cookie + round trip to the authenticated tenant binds BOTH hosts to
// the same initiating browser. A forwarded authorization link cannot bind a mailbox.
export async function bridgeConnection(db: PrismaClient, state: string, publicProof: string) {
  if (!opaque(publicProof)) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
  const orgId = await attemptOrg(db, state);
  return db.$transaction(async tx => {
    await lock(tx, orgId); const row = await attempt(tx, state, 'CREATED');
    const user = await actorContext(tx, { organizationId: orgId, userId: row.actorId });
    const { workspaceOrigin } = decryptSecret<{ workspaceOrigin?: string }>(row.verifierCipher, orgId + ':oauth:' + row.stateHash);
    await tx.organizationEmailOAuthAttempt.update({ where: { stateHash: row.stateHash }, data: { publicProofHash: hash(publicProof), stage: 'BRIDGED' } });
    return tenantUrl(user.organization.slug, 'authorize', state, workspaceOrigin);
  }, options);
}
export async function authorizeConnection(db: PrismaClient, actor: EmailActor, state: string, tenantProof: string) {
  return db.$transaction(async tx => {
    await lock(tx, actor.organizationId); await actorContext(tx, actor);
    const row = await attempt(tx, state, 'BRIDGED');
    if (row.organizationId !== actor.organizationId || row.actorId !== actor.userId || !opaque(tenantProof) || row.tenantProofHash !== hash(tenantProof)) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
    const { verifier } = decryptSecret<{ verifier: string }>(row.verifierCipher, actor.organizationId + ':oauth:' + row.stateHash);
    await tx.organizationEmailOAuthAttempt.update({ where: { stateHash: row.stateHash }, data: { stage: 'AUTHORIZED' } });
    return authorizationUrl(state, createHash('sha256').update(verifier).digest('base64url'));
  }, options);
}
export async function receiveGoogleCallback(db: PrismaClient, state: string, publicProof: string, code: string, provider: GmailProvider = googleProvider) {
  if (!opaque(publicProof) || !code || code.length > 4096) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
  const orgId = await attemptOrg(db, state);
  return db.$transaction(async tx => {
    await lock(tx, orgId); const row = await attempt(tx, state, 'AUTHORIZED');
    if (row.publicProofHash !== hash(publicProof)) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
    const user = await actorContext(tx, { organizationId: orgId, userId: row.actorId });
    const { verifier, workspaceOrigin } = decryptSecret<{ verifier: string; workspaceOrigin?: string }>(row.verifierCipher, orgId + ':oauth:' + row.stateHash);
    const grant = await provider.exchange(code, verifier);
    if (!grant.refreshToken || !grant.accessToken || !grant.email || !grant.subject) throw new EmailIntegrationError('CONSENT_REQUIRED');
    await tx.organizationEmailOAuthAttempt.update({ where: { stateHash: row.stateHash }, data: { pendingCipher: encryptSecret({ ...grant, workspaceOrigin }, orgId + ':pending:' + row.stateHash), verifierCipher: '', stage: 'READY' } });
    return tenantUrl(user.organization.slug, 'complete', state, workspaceOrigin);
  }, options);
}
export async function completeConnection(db: PrismaClient, actor: EmailActor, state: string, tenantProof: string) {
  return db.$transaction(async tx => {
    await lock(tx, actor.organizationId); const user = await actorContext(tx, actor);
    const row = await attempt(tx, state, 'READY');
    if (row.organizationId !== actor.organizationId || row.actorId !== actor.userId || !opaque(tenantProof) || row.tenantProofHash !== hash(tenantProof) || !row.pendingCipher) throw new EmailIntegrationError('INVALID_OAUTH_STATE');
    const grant = decryptSecret<GoogleGrant & { workspaceOrigin?: string }>(row.pendingCipher, actor.organizationId + ':pending:' + row.stateHash);
    // Serialize mailbox ownership across organizations; disconnect revocation must
    // never invalidate another tenant's connection to the same Google grant.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'email-google-subject:' + grant.subject}, 0))::text`;
    const other = await tx.organizationEmailIntegration.findUnique({ where: { googleSubject: grant.subject }, select: { organizationId: true } });
    if (other && other.organizationId !== actor.organizationId) throw new EmailIntegrationError('MAILBOX_ALREADY_CONNECTED');
    await tx.organizationEmailIntegration.update({ where: { organizationId: actor.organizationId }, data: { credentials: encryptSecret({ accessToken: grant.accessToken, refreshToken: grant.refreshToken, expiresAt: grant.expiresAt }, actor.organizationId + ':connection'), email: grant.email, googleSubject: grant.subject, accessExpiresAt: new Date(grant.expiresAt), status: 'CONNECTED', lastError: null, retryAt: null, testedAt: null, recruitmentGmailActive: false } });
    await tx.organizationEmailOAuthAttempt.delete({ where: { stateHash: row.stateHash } });
    return workspaceBase(user.organization.slug, grant.workspaceOrigin) + '/dashboard/settings/email-integration?email=CONNECTED';
  }, options);
}

export async function disconnectConnection(db: PrismaClient, actor: EmailActor, provider: GmailProvider = googleProvider) {
  return db.$transaction(async tx => {
    await lock(tx, actor.organizationId); await actorContext(tx, actor);
    const record = await tx.organizationEmailIntegration.findUnique({ where: { organizationId: actor.organizationId } });
    let revoked = true;
    if (record?.credentials) {
      try { const credentials = decryptSecret<Credentials>(record.credentials, actor.organizationId + ':connection'); revoked = await provider.revoke(credentials.refreshToken); }
      catch { revoked = false; }
    }
    await tx.organizationEmailOAuthAttempt.deleteMany({ where: { organizationId: actor.organizationId } });
    await tx.organizationEmailIntegration.upsert({ where: { organizationId: actor.organizationId }, create: { organizationId: actor.organizationId }, update: { credentials: null, email: null, googleSubject: null, accessExpiresAt: null, status: 'DISCONNECTED', generation: { increment: 1 }, retryAt: null, lastError: null, testedAt: null, recruitmentGmailActive: false } });
    return { revoked };
  }, options);
}

export type CompanyEmail = { to: string; subject: string; html: string; text?: string; inlineLogo?: EmailInlineLogo; expectedSender?: { mode: 'gmail' | 'legacy'; email: string } };
async function sendInTransaction(tx: Prisma.TransactionClient, organizationId: string, input: CompanyEmail, provider: GmailProvider, testActor?: EmailActor) {
    await lock(tx, organizationId);
    if (testActor) {
      if (testActor.organizationId !== organizationId) throw new EmailIntegrationError('FORBIDDEN');
      await actorContext(tx, testActor);
    }
    const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { name: true, slug: true } });
    if (!org) return { success: false, code: 'NOT_CONNECTED' };
    const record = await tx.organizationEmailIntegration.findUnique({ where: { organizationId } });
    if (input.expectedSender && (input.expectedSender.mode !== 'gmail' || input.expectedSender.email !== record?.email)) return { success: false, code: 'STALE_PREVIEW' };
    if (org.slug === 'st-aloysius' && !testActor && !record?.recruitmentGmailActive) return { success: false, code: 'SAGA_GMAIL_NOT_ACTIVE' };
    if (!record?.credentials || !record.email) return { success: false, code: record?.status === 'RECONNECT_REQUIRED' ? 'RECONNECT_REQUIRED' : 'NOT_CONNECTED' };
    if (record.retryAt && record.retryAt > new Date()) return { success: false, code: 'SENDING_LIMIT' };
    try {
      let credentials = decryptSecret<Credentials>(record.credentials, organizationId + ':connection');
      const refresh = async () => {
        const next = await provider.refresh(credentials.refreshToken);
        credentials = { ...credentials, ...next, refreshToken: next.refreshToken || credentials.refreshToken };
        await tx.organizationEmailIntegration.update({ where: { organizationId }, data: { credentials: encryptSecret(credentials, organizationId + ':connection'), accessExpiresAt: new Date(credentials.expiresAt) } });
      };
      if (credentials.expiresAt <= Date.now() + 60000) await refresh();
      const raw = await composeGmailMessage({ ...input, from: record.email, organizationName: org.name });
      try { await provider.send(credentials.accessToken, raw); }
      catch (error) { if (error instanceof EmailIntegrationError && error.code === 'ACCESS_EXPIRED') { await refresh(); await provider.send(credentials.accessToken, raw); } else throw error; }
      await tx.organizationEmailIntegration.update({ where: { organizationId }, data: { status: 'CONNECTED', lastError: null, retryAt: null, lastSentAt: new Date(), ...(testActor ? { testedAt: new Date() } : {}) } });
      return { success: true, code: 'SENT' };
    } catch (error) {
      const code = error instanceof EmailIntegrationError ? error.code : 'CREDENTIALS_UNAVAILABLE';
      const reconnect = ['RECONNECT_REQUIRED', 'ACCESS_EXPIRED'].includes(code);
      await tx.organizationEmailIntegration.update({ where: { organizationId }, data: { status: reconnect ? 'RECONNECT_REQUIRED' : code === 'SENDING_LIMIT' ? 'THROTTLED' : 'ERROR', lastError: code, retryAt: code === 'SENDING_LIMIT' ? new Date(Date.now() + ((error as EmailIntegrationError).retrySeconds || 900) * 1000) : null, ...(reconnect ? { credentials: null, accessExpiresAt: null, testedAt: null } : {}) } });
      return { success: false, code };
    }
}
export async function sendOrganizationEmail(db: PrismaClient, organizationId: string, input: CompanyEmail, provider: GmailProvider = googleProvider) {
  return db.$transaction(tx => sendInTransaction(tx, organizationId, input, provider), options);
}
export async function setSagaRecruitmentSender(db: PrismaClient, actor: EmailActor, useGmail: boolean) {
  return db.$transaction(async tx => {
    await lock(tx, actor.organizationId);
    const user = await actorContext(tx, actor);
    if (user.organization.slug !== 'st-aloysius') throw new EmailIntegrationError('SAGA_ONLY');
    const record = await tx.organizationEmailIntegration.findUnique({ where: { organizationId: actor.organizationId } });
    if (useGmail && (!record?.testedAt || !record.credentials || !record.email || record.status !== 'CONNECTED')) throw new EmailIntegrationError('SUCCESSFUL_TEST_REQUIRED');
    await tx.organizationEmailIntegration.upsert({ where: { organizationId: actor.organizationId }, create: { organizationId: actor.organizationId, recruitmentGmailActive: false }, update: { recruitmentGmailActive: useGmail } });
  }, options);
}
export async function sendSagaRecruitmentEmail(db: PrismaClient, organizationId: string, input: CompanyEmail, legacySender: () => Promise<{ success: boolean; mode: 'smtp' | 'preview_log'; id: string }>, provider: GmailProvider = googleProvider) {
  const delivery = await db.$transaction(async tx => {
    await lock(tx, organizationId);
    const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { slug: true } });
    if (org?.slug !== 'st-aloysius') throw new EmailIntegrationError('SAGA_ONLY');
    const record = await tx.organizationEmailIntegration.findUnique({ where: { organizationId } });
    if (input.expectedSender && (input.expectedSender.mode === 'gmail') !== !!record?.recruitmentGmailActive) return { success: false, code: 'STALE_PREVIEW' };
    if (!record?.recruitmentGmailActive) return null;
    return sendInTransaction(tx, organizationId, input, provider);
  }, options);
  // Already selected legacy mail may finish in flight during a switch. Gmail
  // failures never silently switch the sender back to legacy.
  return delivery ? { success: delivery.success, mode: 'gmail_api' as const, id: '', code: delivery.code, ...(delivery.success ? {} : { warning: emailMessage(delivery.code) }) } : legacySender();
}
export async function testConnection(db: PrismaClient, actor: EmailActor, recipient: unknown, provider: GmailProvider = googleProvider): Promise<{ success: boolean; code: string; recipient?: string }> {
  await actorContext(db as unknown as Prisma.TransactionClient, actor);
  const validated = platformEmail.safeParse(recipient);
  if (!validated.success) return { success: false, code: 'INVALID_TEST_RECIPIENT' };
  const allowed = await db.$transaction(tx => consumeAuthenticationAttempt(tx, 'email-integration-test:' + actor.organizationId, 5));
  if (!allowed) return { success: false, code: 'TEST_LIMIT' };
  const result = await db.$transaction(async tx => {
    const message = await organizationTestEmail(tx, actor.organizationId);
    return sendInTransaction(tx, actor.organizationId, { ...message, to: validated.data }, provider, actor);
  }, options);
  return { ...result, recipient: validated.data };
}
