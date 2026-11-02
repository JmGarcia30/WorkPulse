import 'server-only';
import { createHash } from 'node:crypto';
import { compare } from 'bcryptjs';
import { EmployeeAccountStatus, EmployeeStatus, Prisma, PrismaClient, Role } from '@prisma/client';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';
import type { UserSessionPayload } from './session';
import { notifyLoginLockout } from '@/features/account-security/notifications';

export const staffTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const dummyHash = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
const transactionOptions = { maxWait: 10_000, timeout: 30_000 };
export const staffUserSelection = {
  id: true, name: true, email: true, role: true, organizationId: true,
  employeeAccount: { select: { status: true, organizationId: true, employee: { select: { organizationId: true, employeeStatus: true } } } },
} satisfies Prisma.UserSelect;
type StaffUser = Prisma.UserGetPayload<{ select: typeof staffUserSelection }>;

export function staffAccountAvailable(user: StaffUser) {
  if (user.role !== Role.EMPLOYEE) return true;
  const account = user.employeeAccount;
  return !!account && account.status === EmployeeAccountStatus.ACTIVE && account.organizationId === user.organizationId
    && account.employee.organizationId === user.organizationId && account.employee.employeeStatus === EmployeeStatus.ACTIVE;
}

export async function authenticateStaff(db: PrismaClient, organizationId: string, emailInput: unknown, password: unknown, schedule: (work: () => Promise<void>) => Promise<void> = work => work()) {
  if (typeof emailInput !== 'string' || typeof password !== 'string') return null;
  const email = emailInput.trim().toLowerCase();
  if (!email || email.length > 254 || !password || Buffer.byteLength(password, 'utf8') > 72) return null;
  // Commit budgets independently of credential validation/session issuance. Unknown
  // identities share the tenant cap, preventing unbounded random-identity rows.
  const allowed = await db.$transaction(tx => consumeAuthenticationAttempt(tx, `staff-login-tenant:${organizationId}`, 200), transactionOptions);
  if (!allowed) return null;
  const result = await db.$transaction(async tx => {
    // The same lock used by session issuance/password changes prevents stale comparisons.
    await tx.$queryRaw`SELECT id FROM "User" WHERE email=${email} AND "organizationId"=${organizationId} FOR UPDATE`;
    const user = await tx.user.findFirst({ where: { email, organizationId }, select: { ...staffUserSelection, passwordHash: true } });
    const valid = await compare(password, user?.passwordHash ?? dummyHash);
    if (!user?.passwordHash || !staffAccountAvailable(user)) return { user: null, event: null };
    const key = staffTokenHash(`staff-login-identity:${organizationId}:${email}`), now = new Date();
    const prior = await tx.platformAuthenticationAttempt.findUnique({ where: { key } });
    const active = prior && now.getTime() - prior.windowStart.getTime() < 15 * 60 * 1000;
    if (active && prior.attempts >= 5) return { user: null, event: null };
    if (valid) {
      await tx.platformAuthenticationAttempt.deleteMany({ where: { key } });
      return { user: { ...user, passwordHash: user.passwordHash }, event: null };
    }
    const attempts = active ? prior.attempts + 1 : 1;
    const windowStart = attempts === 5 || !active ? now : prior.windowStart;
    await tx.platformAuthenticationAttempt.upsert({ where: { key }, create: { key, attempts, windowStart }, update: { attempts, windowStart } });
    const event = attempts === 5 ? await tx.accountSecurityEvent.create({ data: { organizationId, subjectIdentifier: user.id, action: 'LOGIN_LOCKOUT', success: false, operationKey: `lockout:${user.id}:${now.toISOString()}` } }) : null;
    return { user: null, event };
  }, transactionOptions);
  // Delivery is post-commit. A durable claim prevents repeated/parallel alerts.
  const event = result.event;
  if (event) await schedule(async () => { try { await notifyLoginLockout(db, event); } catch { /* Lockout remains durable if notification infrastructure is unavailable. */ } });
  return result.user;
}

export class StaffCredentialsChanged extends Error {
  constructor() { super('Staff credentials or account access changed. Sign in again.'); }
}

export async function persistStaffSession(db: PrismaClient, input: UserSessionPayload, token: string, expiresAt: Date, expectedPasswordHash?: string) {
  await db.$transaction(async tx => {
    // Serialize issuance with password/role changes. If credentials changed after
    // bcrypt comparison, the old comparison cannot authorize a newly issued token.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} AND "organizationId" = ${input.organizationId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { ...staffUserSelection, passwordHash: true } });
    if (!user || user.organizationId !== input.organizationId || user.role !== input.role || !staffAccountAvailable(user)
      || (expectedPasswordHash !== undefined && user.passwordHash !== expectedPasswordHash)) throw new StaffCredentialsChanged();
    await tx.staffSession.create({ data: { tokenHash: staffTokenHash(token), userId: user.id, organizationId: user.organizationId, expiresAt } });
  }, transactionOptions);
}
