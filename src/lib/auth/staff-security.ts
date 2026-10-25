import 'server-only';
import { createHash } from 'node:crypto';
import { compare } from 'bcryptjs';
import { EmployeeAccountStatus, EmployeeStatus, Prisma, PrismaClient, Role } from '@prisma/client';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';
import type { UserSessionPayload } from './session';

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

export async function authenticateStaff(db: PrismaClient, organizationId: string, emailInput: unknown, password: unknown) {
  if (typeof emailInput !== 'string' || typeof password !== 'string') return null;
  const email = emailInput.trim().toLowerCase();
  if (!email || email.length > 254 || !password || Buffer.byteLength(password, 'utf8') > 72) return null;
  // Commit budgets independently of credential validation/session issuance. Unknown
  // identities share the tenant cap, preventing unbounded random-identity rows.
  const allowed = await db.$transaction(async tx => {
    if (!await consumeAuthenticationAttempt(tx, `staff-login-tenant:${organizationId}`, 200)) return false;
    return consumeAuthenticationAttempt(tx, `staff-login-identity:${organizationId}:${email}`, 5);
  }, transactionOptions);
  if (!allowed) return null;
  const user = await db.user.findFirst({ where: { email, organizationId }, select: { ...staffUserSelection, passwordHash: true } });
  const valid = await compare(password, user?.passwordHash ?? dummyHash);
  if (!valid || !user?.passwordHash || !staffAccountAvailable(user)) return null;
  return { ...user, passwordHash: user.passwordHash };
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
