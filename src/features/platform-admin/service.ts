import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { platformEmail, platformName, platformPassword } from './credentials';

type Db = PrismaClient;
export const PLATFORM_SESSION_SECONDS = 8 * 60 * 60;
const WINDOW_MS = 15 * 60 * 1000;
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
// Valid bcrypt hash ensures unknown identities perform the same expensive comparison.
const dummyHash = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

async function lockAdministrator(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "PlatformAdministrator" WHERE id = ${id} FOR UPDATE`;
}

async function attempt(tx: Prisma.TransactionClient, identifier: string, limit = 5) {
  const key = tokenHash(identifier);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  const now = new Date();
  const previous = await tx.platformAuthenticationAttempt.findUnique({ where: { key } });
  if (previous && now.getTime() - previous.windowStart.getTime() < WINDOW_MS) {
    if (previous.attempts >= limit) return false;
    await tx.platformAuthenticationAttempt.update({ where: { key }, data: { attempts: { increment: 1 } } });
  } else {
    await tx.platformAuthenticationAttempt.upsert({ where: { key }, create: { key, attempts: 1, windowStart: now }, update: { attempts: 1, windowStart: now } });
  }
  return true;
}

// Purpose-prefixed callers share persistent, transactionally serialized budgets.
export { attempt as consumeAuthenticationAttempt };

/** Operator-only bootstrap. Deliberately not a Server Action or public registration API. */
export async function provisionInitialAdministrator(db: Db, input: { email: string; name: string; password: string }) {
  const email = platformEmail.parse(input.email), name = platformName.parse(input.name);
  const passwordHash = await hash(platformPassword.parse(input.password), 12);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(734210991)::text`;
    if (await tx.platformAdministrator.count() !== 0) throw Error('PLATFORM_ALREADY_PROVISIONED');
    return tx.platformAdministrator.create({ data: { email, name, passwordHash }, select: { id: true, email: true } });
  });
}

export async function authenticatePlatformAdministrator(db: Db, emailInput: unknown, password: unknown) {
  const parsed = platformEmail.safeParse(emailInput);
  if (!parsed.success || typeof password !== 'string' || password.length === 0 || Buffer.byteLength(password) > 72) return null;
  return db.$transaction(async tx => {
    // Global budget also limits random-identity attacks and unbounded throttle rows.
    if (!await attempt(tx, 'platform-login-global', 200)) return null;
    if (!await attempt(tx, 'login:' + parsed.data)) return null;
    const initial = await tx.platformAdministrator.findUnique({ where: { email: parsed.data } });
    if (initial) await lockAdministrator(tx, initial.id);
    const admin = initial ? await tx.platformAdministrator.findUnique({ where: { id: initial.id } }) : null;
    const valid = await compare(password, admin?.passwordHash ?? dummyHash);
    if (!valid || !admin || admin.disabledAt) return null;
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PLATFORM_SESSION_SECONDS * 1000);
    await tx.platformAdministratorSession.create({ data: { tokenHash: tokenHash(token), administratorId: admin.id, expiresAt } });
    return { token, expiresAt };
  }, { timeout: 15000 });
}

export async function findPlatformAdministrator(db: Db, token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.platformAdministratorSession.findUnique({ where: { tokenHash: tokenHash(token) }, select: {
    expiresAt: true, administrator: { select: { id: true, email: true, name: true, disabledAt: true } },
  } });
  if (!session || session.expiresAt <= new Date() || session.administrator.disabledAt) return null;
  const { id, email, name } = session.administrator;
  return { id, email, name };
}

export async function revokePlatformSession(db: Db, token: string | undefined) {
  if (token && /^[a-f0-9]{64}$/.test(token)) await db.platformAdministratorSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
}

export async function updatePlatformAccount(db: Db, token: string, input: { name: unknown; currentPassword: unknown; newPassword: unknown }) {
  const name = platformName.safeParse(input.name);
  const password = input.newPassword === '' ? null : platformPassword.safeParse(input.newPassword);
  if (!name.success || (password && !password.success)) return { error: 'Enter a name (2–100 characters) and a new password of 14–72 characters, at most 72 UTF-8 bytes.' };
  if (typeof input.currentPassword !== 'string' || Buffer.byteLength(input.currentPassword) > 72) return { error: 'Enter your current password.' };
  return db.$transaction(async tx => {
    const session = await tx.platformAdministratorSession.findUnique({ where: { tokenHash: tokenHash(token) } });
    if (!session) return { error: 'Session expired. Sign in again.' };
    if (!await attempt(tx, 'settings:' + session.administratorId)) return { error: 'Too many attempts. Try again in 15 minutes.' };
    await lockAdministrator(tx, session.administratorId);
    // Recheck after locking: password changes/logout may have revoked this session.
    const current = await tx.platformAdministratorSession.findUnique({ where: { tokenHash: session.tokenHash }, include: { administrator: true } });
    if (!current || current.expiresAt <= new Date() || current.administrator.disabledAt) return { error: 'Session expired. Sign in again.' };
    if (!await compare(input.currentPassword as string, current.administrator.passwordHash)) return { error: 'Current password is incorrect.' };
    await tx.platformAdministrator.update({ where: { id: current.administratorId }, data: {
      name: name.data, ...(password?.success ? { passwordHash: await hash(password.data, 12) } : {}),
    } });
    if (password?.success) await tx.platformAdministratorSession.deleteMany({ where: { administratorId: current.administratorId } });
    return password?.success ? { reauthenticate: true } : { success: 'Account settings saved.' };
  }, { timeout: 15000 });
}

// A deliberate metadata allowlist: never select tenant users, employees or documents.
export const organizationMetadata = { id: true, name: true, slug: true, careersEnabled: true, timeZone: true, createdAt: true } satisfies Prisma.OrganizationSelect;
export async function listPlatformOrganizations(db: Db, page: number) {
  return db.organization.findMany({ select: organizationMetadata, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * 25, take: 25 });
}
