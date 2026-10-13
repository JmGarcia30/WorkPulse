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
import { EmployeeSelfAccessError, resolveEmployeeSelfContext } from '../src/features/employee-self-service/access';
import { getMyAttendance, getMyDashboard, getMyProfile, getOwnLeaveRequest } from '../src/features/employee-self-service/read-model';
import { getFinalizedPayslipForEmployee, listFinalizedPayslipsForEmployee } from '../src/features/payroll/payslip';

const rollback = Symbol('rollback');
const marker = `h4-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const session = (role: Role) => ({ userId: 'test', email: 'test@example.invalid', name: 'Test', role, organizationId: 'test-org' });

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function fixture(tx: Prisma.TransactionClient, suffix: string, organizationId?: string) {
  const organization = organizationId ? await tx.organization.findUniqueOrThrow({ where: { id: organizationId } }) : await tx.organization.create({ data: { name: `H4 ${suffix}`, slug: `${marker}-${suffix}`, timeZone: 'Asia/Manila' } });
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
  await testH7();
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
    }, { timeout: 30_000 });
  } catch (error) { if (error !== rollback) throw error; }

  console.log('✓ H4 Employee role isolation');
  console.log('✓ H4 account schema and email identity independence');
  console.log('✓ H4 cross-tenant link rejection');
  console.log('✓ H4 append-only audit enforcement');
  console.log('✓ H4 fragment capture survives URL cleanup and Strict Mode replay');
  console.log('✓ H4 activation, expiry, rotation, one-time use, and secret hygiene');
}

async function testH7() {
  const denied = async (operation: () => Promise<unknown>, code: string) => {
    try { await operation(); return false; } catch (error) { return error instanceof Error && 'code' in error && error.code === code; }
  };
  try {
    await prisma.$transaction(async tx => {
      const own = await fixture(tx, 'h7-own');
      // A second employee in the SAME tenant verifies ownership independently of tenant checks.
      const otherBase = await fixture(tx, 'h7-other', own.organization.id);
      const otherTenant = await fixture(tx, 'h7-other-tenant');
      const user = await tx.user.create({ data: { organizationId: own.organization.id, name: 'H7 Employee', email: `${marker}-h7@test.invalid`, role: Role.EMPLOYEE, passwordHash: 'h7-test-hash' } });
      const account = await tx.employeeAccount.create({ data: { organizationId: own.organization.id, employeeId: own.employee.id, userId: user.id, status: EmployeeAccountStatus.ACTIVE, activatedAt: new Date(), createdById: own.actor.id } });
      const payload = { userId: user.id, organizationId: own.organization.id, role: Role.EMPLOYEE, email: user.email, name: user.name };
      const tenant = { organizationId: own.organization.id };
      const context = await resolveEmployeeSelfContext(payload, tenant, tx);
      assert(context.employee.id === own.employee.id, 'H7 active account must resolve its linked employee.');
      assert(await denied(() => resolveEmployeeSelfContext(null, tenant, tx), 'UNAUTHENTICATED'), 'H7 unauthenticated access accepted.');
      assert(await denied(() => resolveEmployeeSelfContext(payload, { organizationId: otherTenant.organization.id }, tx), 'FORBIDDEN'), 'H7 tenant mismatch accepted.');

      const profile = await getMyProfile(context, tx);
      assert(profile?.employee.employeeNumber === own.employee.employeeNumber && profile.employee.employmentRecords[0]?.jobTitle === 'H4 Job', 'H7 employment must belong to the authenticated employee.');
      assert(!JSON.stringify(profile).includes('salary'), 'H7 confidential contractual salary exposed.');
      const manipulatedProfile = await getMyProfile({ ...context, employee: { ...context.employee, id: otherBase.employee.id }, organization: { ...context.organization, id: otherTenant.organization.id } }, tx);
      assert(manipulatedProfile === null, 'H7 employment tenant boundary failed.');
      const empty = await getMyDashboard(context, tx);
      assert(empty.latestPayroll === null && empty.attendance === null && empty.monthSummary.recordedDays === 0 && empty.leave.requests.length === 0, 'H7 missing data dashboard must have safe empty states.');
      const noEmployment = await getMyDashboard(context, tx, new Date('2000-01-01T00:00:00Z'));
      assert(noEmployment.profile?.employee.employmentRecords.length === 0 && noEmployment.profile.schedule === null, 'H7 missing employment/schedule dashboard must remain usable.');

      const day = new Date(`${empty.today}T00:00:00Z`);
      const ownEmployment = await tx.employmentRecord.findFirstOrThrow({ where: { employeeId: own.employee.id } });
      const otherEmployment = await tx.employmentRecord.findFirstOrThrow({ where: { employeeId: otherBase.employee.id } });
      await tx.employmentRecord.update({ where: { id: otherEmployment.id }, data: { jobTitle: 'PRIVATE OTHER POSITION' } });
      for (const [employeeId, employmentRecordId, lateSeconds] of [[own.employee.id, ownEmployment.id, 300], [otherBase.employee.id, otherEmployment.id, 900]] as const) {
        await tx.dailyAttendanceRecord.create({ data: { organizationId: own.organization.id, employeeId, employmentRecordId, attendanceDate: day, timeZoneSnapshot: 'Asia/Manila', attendanceStatus: 'PRESENT', lateSeconds, lastCalculatedAt: new Date() } });
      }
      // Extra client parameters are ignored: month filters never choose an employee or record.
      const rows = await getMyAttendance(context, tx, { from: empty.today, to: empty.today, employeeId: otherBase.employee.id } as { from: string; to: string });
      assert(rows.length === 1 && rows[0].lateSeconds === 300, 'H7 attendance employeeId manipulation leaked another employee.');
      let rangeRejected = false;
      try { await getMyAttendance(context, tx, { from: '2026-01-01', to: '2026-12-31' }); } catch { rangeRejected = true; }
      assert(rangeRejected, 'H7 attendance range limit missing.');
      const ownProfile = await getMyProfile(context, tx);
      assert(!JSON.stringify(ownProfile).includes('PRIVATE OTHER POSITION'), 'H7 another employment record exposed.');

      const type = await tx.leaveType.create({ data: { organizationId: own.organization.id, code: `${marker}-H7`, name: 'H7 Leave', countingMode: 'SCHEDULED_WORK_DAYS', policyReference: 'H7 test' } });
      const leaveInput = { organizationId: own.organization.id, leaveTypeId: type.id, requestedStartDate: day, requestedEndDate: day, reason: 'H7 request', policySnapshot: {}, leaveTypeCodeSnapshot: type.code, leaveTypeNameSnapshot: type.name, leavePaidSnapshot: false, countingModeSnapshot: type.countingMode };
      const ownLeave = await tx.leaveRequest.create({ data: { ...leaveInput, employeeId: own.employee.id } });
      const otherLeave = await tx.leaveRequest.create({ data: { ...leaveInput, employeeId: otherBase.employee.id } });
      assert((await getOwnLeaveRequest(context, tx, ownLeave.id))?.id === ownLeave.id, 'H7 own leave inaccessible.');
      assert(await getOwnLeaveRequest(context, tx, otherLeave.id) === null, 'H7 leave URL manipulation exposed another employee request.');
      assert(await getOwnLeaveRequest(context, tx, 'missing-request') === null, 'H7 unknown leave ID should return no data.');

      const compensation = await tx.employeeCompensation.create({ data: { organizationId: own.organization.id, employeeId: own.employee.id, compensationType: 'MONTHLY', baseRate: 12345, payFrequency: 'MONTHLY', effectiveFrom: day } });
      const otherCompensation = await tx.employeeCompensation.create({ data: { organizationId: own.organization.id, employeeId: otherBase.employee.id, compensationType: 'MONTHLY', baseRate: 12345, payFrequency: 'MONTHLY', effectiveFrom: day } });
      const payrollInput = { organizationId: own.organization.id, userId: user.id };
      async function payroll(name: string, payDate: Date, employeeId: string, finalized: boolean) {
        const period = await tx.payrollPeriod.create({ data: { organizationId: own.organization.id, name, periodStart: day, periodEnd: day, payDate, status: finalized ? 'FINALIZED' : 'DRAFT', finalizedAt: finalized ? new Date() : null, finalizedById: finalized ? own.actor.id : null } });
        return tx.payrollEntry.create({ data: {
          organizationId: own.organization.id, employeeId, payrollPeriodId: period.id, employeeCompensationId: employeeId === own.employee.id ? compensation.id : otherCompensation.id, status: finalized ? 'FINALIZED' : 'DRAFT',
          calculationSnapshot: { payrollPeriod: { id: period.id, start: empty.today, end: empty.today, payDate: payDate.toISOString().slice(0, 10) }, employee: { id: employeeId }, compensation: { type: 'MONTHLY', rate: '12345.00', payFrequency: 'MONTHLY', currency: 'PHP' }, calculation: { baseAmount: '12345.00', grossAmount: '12345.00', totalDeductions: '345.00', netAmount: '12000.00' } },
        } });
      }
      const older = await payroll('H7 older finalized', day, own.employee.id, true);
      const latest = await payroll('H7 latest finalized', new Date(day.getTime() + 86400000), own.employee.id, true);
      const foreign = await payroll('H7 other employee', day, otherBase.employee.id, true);
      const draft = await payroll('H7 newer draft', new Date(day.getTime() + 172800000), own.employee.id, false);
      assert((await getFinalizedPayslipForEmployee({ ...payrollInput, entryId: latest.id }, tx)).calculation.netPay === '12000.00', 'H7 payroll must use finalized snapshot amounts.');
      assert(await denied(() => getFinalizedPayslipForEmployee({ ...payrollInput, entryId: foreign.id }, tx), 'NOT_FOUND'), 'H7 payroll URL manipulation accepted.');
      assert(await denied(() => getFinalizedPayslipForEmployee({ ...payrollInput, entryId: draft.id }, tx), 'NOT_FOUND'), 'H7 draft payroll exposed.');
      const list = await listFinalizedPayslipsForEmployee(payrollInput, tx);
      assert(list.length === 2 && list[0].entryId === latest.id && list[1].entryId === older.id && list[0].totalDeductions === '345.00', 'H7 finalized payroll list order/amounts incorrect.');
      const populated = await getMyDashboard(context, tx);
      assert(populated.latestPayroll?.entryId === latest.id && populated.monthSummary.presentDays === 1 && populated.monthSummary.lateOccurrences === 1 && populated.leave.requests.length === 1, 'H7 dashboard latest payroll and own summaries incorrect.');
      await tx.dailyAttendanceRecord.update({ where: { id: rows[0].id }, data: { disposition: 'APPROVED_LEAVE', attendanceStatus: 'ABSENT' } });
      const onLeave = await getMyDashboard(context, tx);
      assert(onLeave.monthSummary.approvedLeaveDays === 1 && onLeave.monthSummary.presentDays === 0, 'H7 approved leave summary must respect stored disposition.');

      for (const role of [Role.HR_ADMIN, Role.HIRING_MANAGER, Role.ORGANIZATION_ADMIN]) {
        const staff = await tx.user.create({ data: { organizationId: own.organization.id, name: role, email: `${marker}-${role}-h7@test.invalid`, role } });
        assert(await denied(() => resolveEmployeeSelfContext({ ...payload, userId: staff.id, role }, tenant, tx), 'FORBIDDEN'), `H7 ${role} accepted by ESS guard.`);
        assert(await denied(() => resolveEmployeeSelfContext({ ...payload, userId: staff.id }, tenant, tx), 'FORBIDDEN'), `H7 ${role} accepted with forged employee role.`);
        assert(await denied(() => getFinalizedPayslipForEmployee({ ...payrollInput, userId: staff.id, entryId: latest.id }, tx), 'FORBIDDEN'), `H7 ${role} bypassed employee payroll guard.`);
      }
      await tx.employeeAccount.update({ where: { id: account.id }, data: { status: 'DISABLED', disabledAt: new Date(), disabledReason: 'H7 test' } });
      assert(await denied(() => resolveEmployeeSelfContext(payload, tenant, tx), 'ACCOUNT_UNAVAILABLE'), 'H7 disabled account accepted.');
      assert(await denied(() => listFinalizedPayslipsForEmployee(payrollInput, tx), 'FORBIDDEN'), 'H7 disabled account payroll accepted.');
      await tx.employeeAccount.update({ where: { id: account.id }, data: { status: 'ACTIVE', disabledAt: null, disabledReason: null } });
      await tx.employee.update({ where: { id: own.employee.id }, data: { employeeStatus: 'INACTIVE' } });
      assert(await denied(() => resolveEmployeeSelfContext(payload, tenant, tx), 'ACCOUNT_UNAVAILABLE'), 'H7 inactive employee accepted.');
      assert(await denied(() => listFinalizedPayslipsForEmployee(payrollInput, tx), 'FORBIDDEN'), 'H7 inactive employee payroll accepted.');
      assert(EmployeeSelfAccessError.prototype instanceof Error, 'H7 access error contract missing.');
      throw rollback;
    }, { timeout: 60_000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log('✓ H7 account guard, tenant/employee ownership, ID manipulation, finalized dashboard, missing data, and staff isolation');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
