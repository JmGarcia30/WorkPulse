import { createHash } from 'node:crypto';
import {
  ApplicationStatus,
  EmployeeAccountAuditAction,
  EmployeeAccountStatus,
  EmployeeStatus,
  EmploymentCategory,
  JobStatus,
  PayFrequency,
  Prisma,
  Role,
} from '@prisma/client';
import { prisma } from '../src/lib/db/prisma';
import { canAccessBackOffice, canAccessEmployeeSelfService, canCorrectAttendance, canManageSchedules, canViewEmployees, canViewHiringData, canViewOwnAttendance, canViewOwnProfile } from '../src/lib/permissions/rbac';
import { retainActivationToken } from '../src/features/employee-self-service/activation-fragment';
import { activateEmployeeAccountInTransaction, createEmployeeInvitation, hashActivationToken, INVITATION_LIFETIME_MS } from '../src/features/employee-self-service/activation';

const rollback = Symbol('rollback');
const marker = `h4-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const session = (role: Role) => ({ userId: 'test', email: 'test@example.invalid', name: 'Test', role, organizationId: 'test-org' });

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function fixture(tx: Prisma.TransactionClient, suffix: string) {
  const organization = await tx.organization.create({ data: { name: `H4 ${suffix}`, slug: `${marker}-${suffix}`, timeZone: 'Asia/Manila' } });
  const actor = await tx.user.create({ data: { organizationId: organization.id, name: 'H4 HR', email: `${marker}-${suffix}-hr@test.invalid`, passwordHash: 'test', role: Role.HR_ADMIN } });
  const job = await tx.job.create({ data: { organizationId: organization.id, title: 'H4 Job', slug: `${marker}-${suffix}`, department: 'Test', employmentType: 'Full-Time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', status: JobStatus.CLOSED, category: EmploymentCategory.NON_TEACHING } });
  const applicant = await tx.applicant.create({ data: { firstName: 'Employee', lastName: suffix, email: `${marker}-${suffix}-contact@test.invalid`, phone: '0' } });
  const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: ApplicationStatus.HIRED, coverLetter: 'H4 fixture' } });
  const employee = await tx.employee.create({ data: { organizationId: organization.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `H4-${suffix}`, firstName: 'Employee', lastName: suffix, email: applicant.email, phone: '0', employeeStatus: EmployeeStatus.ACTIVE, createdById: actor.id } });
  await tx.employmentRecord.create({ data: { employeeId: employee.id, jobId: job.id, jobTitle: job.title, department: job.department, employmentCategory: EmploymentCategory.NON_TEACHING, employmentType: 'Full-Time', hireDate: new Date(), startDate: new Date(), salary: new Prisma.Decimal(1), payFrequency: PayFrequency.MONTHLY, effectiveFrom: new Date(), createdById: actor.id } });
  return { organization, actor, employee };
}

async function invitedFixture(tx: Prisma.TransactionClient, suffix: string, tokenHash: string, expiresAt: Date) {
  const base = await fixture(tx, suffix);
  const user = await tx.user.create({ data: { organizationId: base.organization.id, name: `Employee ${suffix}`, email: `${marker}-${suffix}-login@test.invalid`, passwordHash: null, role: Role.EMPLOYEE } });
  const account = await tx.employeeAccount.create({ data: { organizationId: base.organization.id, userId: user.id, employeeId: base.employee.id, status: EmployeeAccountStatus.INVITED, activationTokenHash: tokenHash, activationTokenExpiresAt: expiresAt, createdById: base.actor.id } });
  return { ...base, user, account };
}

async function main() {
  const employeeSession = session(Role.EMPLOYEE);
  assert(canAccessEmployeeSelfService(employeeSession), 'Employee must access ESS.');
  assert(canViewOwnProfile(employeeSession) && canViewOwnAttendance(employeeSession), 'Employee own-view permissions missing.');
  assert(!canAccessBackOffice(employeeSession) && !canViewEmployees(employeeSession) && !canViewHiringData(employeeSession) && !canManageSchedules(employeeSession) && !canCorrectAttendance(employeeSession), 'Employee received a back-office permission.');
  for (const role of [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN, Role.HIRING_MANAGER]) assert(canAccessBackOffice(session(role)), `${role} lost back-office access.`);

  try {
    await prisma.$transaction(async (tx) => {
      const { organization, actor, employee } = await fixture(tx, 'base');
      const user = await tx.user.create({ data: { organizationId: organization.id, name: 'Employee Base', email: `${marker}-login@test.invalid`, passwordHash: null, role: Role.EMPLOYEE } });
      const token = createHash('sha256').update('test-token').digest('hex');
      const account = await tx.employeeAccount.create({ data: { organizationId: organization.id, userId: user.id, employeeId: employee.id, status: EmployeeAccountStatus.INVITED, activationTokenHash: token, activationTokenExpiresAt: new Date(Date.now() + 60_000), createdById: actor.id } });
      await tx.employeeAccountAudit.create({ data: { organizationId: organization.id, employeeAccountId: account.id, actorUserId: actor.id, action: EmployeeAccountAuditAction.ACCOUNT_CREATED } });
      await tx.employee.update({ where: { id: employee.id }, data: { email: `${marker}-changed-contact@test.invalid` } });
      const unchanged = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      assert(unchanged.email === `${marker}-login@test.invalid`, 'Employee contact email silently changed User login email.');
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }

  let crossTenantRejected = false;
  try {
    await prisma.$transaction(async (tx) => {
      const first = await fixture(tx, 'tenant-a');
      const second = await fixture(tx, 'tenant-b');
      const user = await tx.user.create({ data: { organizationId: first.organization.id, name: 'Cross', email: `${marker}-cross@test.invalid`, passwordHash: null, role: Role.EMPLOYEE } });
      await tx.employeeAccount.create({ data: { organizationId: first.organization.id, userId: user.id, employeeId: second.employee.id, activationTokenHash: createHash('sha256').update('cross').digest('hex'), activationTokenExpiresAt: new Date(Date.now() + 60_000), createdById: first.actor.id } });
    });
  } catch { crossTenantRejected = true; }
  assert(crossTenantRejected, 'Cross-tenant link was not rejected.');

  let auditMutationRejected = false;
  try {
    await prisma.$transaction(async (tx) => {
      const { organization, actor, employee } = await fixture(tx, 'immutable');
      const user = await tx.user.create({ data: { organizationId: organization.id, name: 'Immutable', email: `${marker}-immutable@test.invalid`, passwordHash: null, role: Role.EMPLOYEE } });
      const account = await tx.employeeAccount.create({ data: { organizationId: organization.id, userId: user.id, employeeId: employee.id, activationTokenHash: createHash('sha256').update('immutable').digest('hex'), activationTokenExpiresAt: new Date(Date.now() + 60_000), createdById: actor.id } });
      const audit = await tx.employeeAccountAudit.create({ data: { organizationId: organization.id, employeeAccountId: account.id, actorUserId: actor.id, action: EmployeeAccountAuditAction.ACCOUNT_CREATED } });
      await tx.employeeAccountAudit.update({ where: { id: audit.id }, data: { details: { changed: true } } });
    });
  } catch { auditMutationRejected = true; }
  assert(auditMutationRejected, 'Audit mutation was not rejected.');

  const fragmentInvitation = createEmployeeInvitation();
  const firstCapture = retainActivationToken(`#token=${encodeURIComponent(fragmentInvitation.token)}`, '');
  const secondCapture = retainActivationToken('', firstCapture);
  assert(firstCapture.length === 43 && secondCapture === firstCapture, 'Fragment token did not survive immediate URL cleanup and Strict Mode effect replay.');

  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date('2026-09-12T00:00:00.000Z');
      const immediateInvitation = createEmployeeInvitation(now.getTime());
      assert(immediateInvitation.expiresAt.getTime() - now.getTime() === INVITATION_LIFETIME_MS, 'Invitation lifetime is not exactly 24 hours.');
      const immediate = await invitedFixture(tx, 'activate-immediate', immediateInvitation.hash, immediateInvitation.expiresAt);
      const submittedToken = retainActivationToken(`#token=${encodeURIComponent(immediateInvitation.token)}`, '');
      assert(await activateEmployeeAccountInTransaction(tx, { token: submittedToken, passwordHash: 'bcrypt-test-hash', now }), 'A newly submitted invitation token did not activate immediately.');
      const activated = await tx.employeeAccount.findUniqueOrThrow({ where: { id: immediate.account.id }, include: { user: true } });
      assert(activated.status === EmployeeAccountStatus.ACTIVE, 'Successful activation did not set ACTIVE.');
      assert(activated.user.passwordHash === 'bcrypt-test-hash', 'Successful activation did not set passwordHash.');
      assert(activated.activationTokenHash === null && activated.activationTokenExpiresAt === null, 'Successful activation did not clear token fields.');
      assert(!await activateEmployeeAccountInTransaction(tx, { token: submittedToken, passwordHash: 'replay', now }), 'A used token was replayable.');

      const beforeExpiryInvitation = createEmployeeInvitation(now.getTime());
      const beforeExpiry = await invitedFixture(tx, 'before-expiry', beforeExpiryInvitation.hash, beforeExpiryInvitation.expiresAt);
      assert(await activateEmployeeAccountInTransaction(tx, { token: beforeExpiryInvitation.token, passwordHash: 'before-expiry-hash', now: new Date(beforeExpiryInvitation.expiresAt.getTime() - 1) }), 'Token failed just before its 24-hour expiry.');
      assert((await tx.employeeAccount.findUniqueOrThrow({ where: { id: beforeExpiry.account.id } })).status === EmployeeAccountStatus.ACTIVE, 'Just-before-expiry activation did not set ACTIVE.');

      const expiredInvitation = createEmployeeInvitation(now.getTime());
      const expired = await invitedFixture(tx, 'after-expiry', expiredInvitation.hash, expiredInvitation.expiresAt);
      assert(!await activateEmployeeAccountInTransaction(tx, { token: expiredInvitation.token, passwordHash: 'expired-hash', now: new Date(expiredInvitation.expiresAt.getTime() + 1) }), 'Expired token was accepted.');
      assert((await tx.employeeAccount.findUniqueOrThrow({ where: { id: expired.account.id } })).status === EmployeeAccountStatus.INVITED, 'Expired-token attempt changed account state.');

      const oldInvitation = createEmployeeInvitation(now.getTime());
      const resent = await invitedFixture(tx, 'resend', oldInvitation.hash, oldInvitation.expiresAt);
      const newestInvitation = createEmployeeInvitation(now.getTime() + 1_000);
      await tx.employeeAccount.update({ where: { id: resent.account.id }, data: { activationTokenHash: newestInvitation.hash, activationTokenExpiresAt: newestInvitation.expiresAt } });
      assert(!await activateEmployeeAccountInTransaction(tx, { token: oldInvitation.token, passwordHash: 'old-hash', now }), 'Superseded resend token remained valid.');
      assert(await activateEmployeeAccountInTransaction(tx, { token: newestInvitation.token, passwordHash: 'new-hash', now }), 'Newest resend token was rejected.');

      const activationAudits = await tx.employeeAccountAudit.findMany({ where: { employeeAccountId: { in: [immediate.account.id, beforeExpiry.account.id, resent.account.id] } }, select: { details: true } });
      const serializedAudits = JSON.stringify(activationAudits);
      for (const secret of [immediateInvitation.token, beforeExpiryInvitation.token, oldInvitation.token, newestInvitation.token]) {
        assert(!serializedAudits.includes(secret) && !serializedAudits.includes(hashActivationToken(secret)), 'Raw token or token hash appeared in activation audits.');
      }
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }

  console.log('✓ H4 Employee role isolation');
  console.log('✓ H4 account schema and email identity independence');
  console.log('✓ H4 cross-tenant link rejection');
  console.log('✓ H4 append-only audit enforcement');
  console.log('✓ H4 fragment capture survives URL cleanup and Strict Mode replay');
  console.log('✓ H4 activation, expiry, rotation, one-time use, and secret hygiene');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
