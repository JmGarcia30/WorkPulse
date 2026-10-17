import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient, Role } from '@prisma/client';
import { SignJWT, jwtVerify } from 'jose';
import { Temporal } from '@js-temporal/polyfill';
import { createSeparationService } from '../src/features/separation/core';
import { SeparationError } from '../src/features/separation/domain';
import { organizationDate } from '../src/features/separation/finalization';
import { resolveEmployeeSelfContext, EmployeeSelfAccessError } from '../src/features/employee-self-service/access';
import { createEmployeeInvitation, activateEmployeeAccountInTransaction } from '../src/features/employee-self-service/activation';
import type { UserSessionPayload } from '../src/lib/auth/session';

if (existsSync('.env')) process.loadEnvFile('.env');
const schema = `h102_test_${randomBytes(12).toString('hex')}`;
let checks = 0;
const ok = (condition: unknown, message: string) => { assert.ok(condition, message); console.log(`PASS ${++checks}: ${message}`); };
async function denied(operation: () => Promise<unknown>, code: string) {
  await assert.rejects(operation, error => error instanceof SeparationError && error.code === code); checks++;
}
const date = (value: string) => new Date(`${value}T00:00:00Z`);

async function integration(db: PrismaClient) {
  const organization = await db.organization.create({ data: { name: 'H10.2 SAGA isolated', slug: 'st-aloysius', timeZone: 'Asia/Manila' } });
  const foreignOrg = await db.organization.create({ data: { name: 'H10.2 foreign', slug: 'other' } });
  const user = (role: Role, organizationId = organization.id) => db.user.create({ data: { organizationId, role, name: role, email: `${organizationId}-${role}@h102.invalid` } });
  const hr = await user('HR_ADMIN'), admin = await user('ORGANIZATION_ADMIN'), manager = await user('HIRING_MANAGER'), foreignHr = await user('HR_ADMIN', foreignOrg.id);
  let trustedNow = new Date('2026-10-17T02:00:00Z');
  const as = (actor: typeof hr) => createSeparationService(db, async () => ({ userId: actor.id, organizationId: actor.organizationId, role: actor.role }), () => trustedNow);
  const service = as(hr);
  let sequence = 0;
  async function employee(account: 'ACTIVE' | 'INVITED' | 'NONE' = 'ACTIVE') {
    const suffix = `${++sequence}`;
    const job = await db.job.create({ data: { organizationId: organization.id, title: 'H10.2 job', slug: `job-${suffix}`, department: 'Test', employmentType: 'Full-time', location: 'Campus', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test' } });
    const applicant = await db.applicant.create({ data: { firstName: 'Final', lastName: suffix, email: `${suffix}@h102.invalid`, phone: '0' } });
    const application = await db.application.create({ data: { jobId: job.id, applicantId: applicant.id, coverLetter: 'Preserved hiring', status: 'HIRED' } });
    const record = await db.employee.create({ data: { organizationId: organization.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `H102-${suffix}`, firstName: 'Final', lastName: suffix, email: applicant.email, phone: '0', createdById: hr.id } });
    const employment = await db.employmentRecord.create({ data: { employeeId: record.id, jobId: job.id, jobTitle: 'Test', department: 'Test', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: date('2025-01-01'), startDate: date('2025-01-01'), salary: 1, payFrequency: 'MONTHLY', effectiveFrom: date('2025-01-01'), createdById: hr.id, probation: { create: { employeeId: record.id, category: 'NON_TEACHING', startedAt: date('2025-01-01'), expectedEndAt: date('2025-07-01'), policySnapshot: 'H2 unchanged' } } } });
    const login = await db.user.create({ data: { organizationId: organization.id, role: 'EMPLOYEE', name: `Final ${suffix}`, email: `login-${suffix}@h102.invalid` } });
    const invitation = createEmployeeInvitation();
    const linked = account === 'NONE' ? null : await db.employeeAccount.create({ data: { organizationId: organization.id, userId: login.id, employeeId: record.id, createdById: hr.id, status: account, ...(account === 'ACTIVE' ? { activatedAt: new Date() } : { activationTokenHash: invitation.hash, activationTokenExpiresAt: invitation.expiresAt }) } });
    return { ...record, employment, login, linked, invitation };
  }
  const version = (found: { id: string; version: number }) => ({ caseId: found.id, expectedVersion: found.version });
  async function prepare(person: Awaited<ReturnType<typeof employee>>, effective = '2026-10-18', inactiveEmployeeJustification?: string, lastWorkingDay?: string) {
    const details = { separationType: 'RESIGNATION' as const, reason: 'Verified written resignation', noticeDate: '2026-09-01', proposedLastWorkingDay: lastWorkingDay ?? Temporal.PlainDate.from(effective).subtract({ days: 1 }).toString(), proposedEffectiveDate: effective };
    let found = await service.createSeparationCase({ ...details, employeeId: person.id, requestKey: `create-${person.id}`, inactiveEmployeeJustification });
    found = await service.updateSeparationCase({ ...version(found), details, status: 'IN_PROGRESS' });
    for (const item of found.clearanceItems) found = await service.recordClearanceDecision({ ...version(found), itemId: item.id, status: 'CLEARED', verified: true });
    for (const kind of ['NOTICE_SUPERIOR', 'NOTICE_HRMO'] as const) found = await service.recordSeparationReview({ ...version(found), kind, evidence: 'Verified written review reference on file', verified: true });
    return service.markReadyForFinalReview(version(found));
  }
  const approval = (found: { id: string; version: number }) => ({ ...version(found), decision: 'APPROVE_SEPARATION' as const, remarks: 'Authorized final administrative approval' });
  const execution = (found: { id: string; version: number }) => ({ ...version(found), remarks: 'Authorized execution on institution effective date' });

  ok(organizationDate(new Date('2026-10-17T16:00:00Z'), 'Asia/Manila') === '2026-10-18', 'effective-date gate uses institution local midnight');
  ok(organizationDate(new Date('2026-10-18T01:00:00Z'), 'America/Los_Angeles') === '2026-10-17', 'timezone boundary does not assume UTC date');
  const person = await employee();
  let found = await prepare(person);
  await denied(() => as(manager).approveSeparationCase(approval(found)), 'FORBIDDEN');
  await denied(() => as(person.login).approveSeparationCase(approval(found)), 'FORBIDDEN');
  await denied(() => as(foreignHr).approveSeparationCase(approval(found)), 'NOT_FOUND');
  await denied(() => service.approveSeparationCase({ ...approval(found), remarks: '' }), 'INVALID_INPUT');
  await denied(() => service.approveSeparationCase({ ...approval(found), approvedById: admin.id } as ReturnType<typeof approval>), 'INVALID_INPUT');

  // Even a case previously marked ready must be reassessed against current data.
  const item = found.clearanceItems[0];
  await db.employeeClearanceItem.update({ where: { id: item.id }, data: { status: 'PENDING', reviewedById: null, reviewedAt: null } });
  await denied(() => service.approveSeparationCase(approval(found)), 'NOT_READY');
  await db.employeeClearanceItem.update({ where: { id: item.id }, data: { status: 'CLEARED', reviewedById: hr.id, reviewedAt: new Date() } });
  const invalidVersion = await db.employeeSeparationCase.update({ where: { id: found.id }, data: { versionOfDetails: { increment: 1 } } });
  await denied(() => service.approveSeparationCase(approval(found)), 'NOT_READY');
  await db.employeeSeparationCase.update({ where: { id: found.id }, data: { versionOfDetails: invalidVersion.versionOfDetails - 1 } });

  const session: UserSessionPayload = { userId: person.login.id, organizationId: organization.id, role: 'EMPLOYEE', name: person.login.name, email: person.login.email };
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'h102_test_only_secret_at_least_32_characters');
  const jwt = await new SignJWT({ ...session }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
  const decoded = (await jwtVerify(jwt, secret)).payload as unknown as UserSessionPayload;
  const accountBefore = await db.employeeAccount.findUniqueOrThrow({ where: { id: person.linked!.id } });
  found = await as(admin).approveSeparationCase(approval(found));
  ok(found.status === 'APPROVED_PENDING_EFFECTIVE' && found.approvedById === admin.id && Boolean(found.approvedAt), 'Organization Admin approval records decision, actor, time and remarks');
  ok((await db.employee.findUniqueOrThrow({ where: { id: person.id } })).employeeStatus === 'ACTIVE', 'future approval preserves ACTIVE status');
  ok(JSON.stringify(await db.employeeAccount.findUnique({ where: { id: accountBefore.id } })) === JSON.stringify(accountBefore), 'future approval preserves account and invitations');
  ok((await resolveEmployeeSelfContext(decoded, { organizationId: organization.id }, db)).employee.id === person.id, 'future approval preserves ESS eligibility');
  await denied(() => service.executeSeparation(execution(found)), 'INVALID_STATE');
  await denied(() => as(manager).executeSeparation(execution(found)), 'FORBIDDEN');
  await denied(() => as(person.login).executeSeparation(execution(found)), 'FORBIDDEN');
  await denied(() => as(foreignHr).executeSeparation(execution(found)), 'NOT_FOUND');
  await denied(() => service.updateSeparationCase({ ...version(found), details: { separationType: 'OTHER', reason: 'Cannot rewrite approval' } }), 'INVALID_STATE');
  ok((await service.getApprovedSeparations()).items.some(entry => entry.id === found.id), 'approved-awaiting-effective listing is available');

  // Populate protected history before the effective boundary, including finalized payroll.
  const closed = await db.employmentRecord.create({ data: { employeeId: person.id, jobTitle: 'Earlier role', department: 'Test', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: date('2024-01-01'), startDate: date('2024-01-01'), salary: 1, payFrequency: 'MONTHLY', effectiveFrom: date('2024-01-01'), effectiveTo: date('2025-01-01'), createdById: hr.id } });
  const type = await db.leaveType.create({ data: { organizationId: organization.id, code: 'TEST', name: 'Historical leave', countingMode: 'CALENDAR_DAYS', policyReference: 'Fixture' } });
  const leave = await db.leaveRequest.create({ data: { organizationId: organization.id, employeeId: person.id, leaveTypeId: type.id, requestedStartDate: date('2026-10-01'), requestedEndDate: date('2026-10-01'), reason: 'Historical approved leave', status: 'APPROVED', requestedUnits: 1, policySnapshot: {}, leaveTypeCodeSnapshot: type.code, leaveTypeNameSnapshot: type.name, leavePaidSnapshot: true, countingModeSnapshot: 'CALENDAR_DAYS' } });
  await db.leaveLedgerEntry.create({ data: { organizationId: organization.id, employeeId: person.id, leaveTypeId: type.id, leaveRequestId: leave.id, entryType: 'APPROVED_LEAVE', amountUnits: -1, reason: 'Historical ledger', actorUserId: hr.id } });
  await db.attendanceEvent.create({ data: { organizationId: organization.id, employeeId: person.id, source: 'MANUAL', sourceReference: 'h102-history', occurredAt: new Date('2026-10-16T02:00:00Z'), direction: 'TIME_IN', createdById: hr.id } });
  const attendance = await db.dailyAttendanceRecord.create({ data: { organizationId: organization.id, employeeId: person.id, employmentRecordId: person.employment.id, attendanceDate: date('2026-10-16'), timeZoneSnapshot: 'Asia/Manila', attendanceStatus: 'PRESENT', lastCalculatedAt: new Date(), finalizedAt: new Date() } });
  const compensation = await db.employeeCompensation.create({ data: { organizationId: organization.id, employeeId: person.id, compensationType: 'MONTHLY', baseRate: 1, payFrequency: 'MONTHLY', currency: 'PHP', effectiveFrom: date('2025-01-01') } });
  const period = await db.payrollPeriod.create({ data: { organizationId: organization.id, name: 'Historical October payroll', periodStart: date('2026-10-01'), periodEnd: date('2026-10-31'), payDate: date('2026-10-31'), status: 'FINALIZED', finalizedById: hr.id, finalizedAt: new Date() } });
  await db.payrollEntry.create({ data: { organizationId: organization.id, employeeId: person.id, payrollPeriodId: period.id, employeeCompensationId: compensation.id, status: 'FINALIZED', baseAmount: 1, grossAmount: 1, netAmount: 1, calculationSnapshot: { immutableHistoricalCalculation: true } } });
  const futureAttendance = await db.dailyAttendanceRecord.create({ data: { organizationId: organization.id, employeeId: person.id, employmentRecordId: person.employment.id, attendanceDate: date('2026-10-19'), timeZoneSnapshot: 'Asia/Manila', attendanceStatus: 'NO_SCHEDULE', lastCalculatedAt: new Date() } });
  const futurePeriod = await db.payrollPeriod.create({ data: { organizationId: organization.id, name: 'Future draft payroll', periodStart: date('2026-11-01'), periodEnd: date('2026-11-30'), payDate: date('2026-11-30') } });
  const futureEntry = await db.payrollEntry.create({ data: { organizationId: organization.id, employeeId: person.id, payrollPeriodId: futurePeriod.id, employeeCompensationId: compensation.id } });
  async function protectedHistory() {
    return JSON.stringify(await db.employee.findUniqueOrThrow({ where: { id: person.id }, include: { sourceApplication: true, applicant: true, attendanceEvents: true, dailyAttendanceRecords: { include: { corrections: true } }, leaveRequests: true, leaveLedgerEntries: true, payrollEntries: { include: { payrollPeriod: true } } } }).then(({ employeeStatus: _status, updatedAt: _updated, ...rest }) => { void _status; void _updated; return rest; }));
  }
  const preserved = await protectedHistory();
  trustedNow = new Date('2026-10-17T16:00:00Z'); // First instant of Oct 18 at SAGA.
  const final = await service.executeSeparation(execution(found));
  ok(final.status === 'COMPLETED' && final.completedById === hr.id, 'authorized execution completes the approved case');
  const separated = await db.employee.findUniqueOrThrow({ where: { id: person.id }, include: { statusHistory: true, probationRecords: true, employeeAccount: { include: { audits: true } } } });
  ok(separated.employeeStatus === 'SEPARATED' && separated.statusHistory.length === 1 && separated.statusHistory[0].fromStatus === 'ACTIVE', 'ACTIVE to SEPARATED is recorded once with the correct previous status');
  ok((await db.employmentRecord.findUniqueOrThrow({ where: { id: person.employment.id } })).effectiveTo?.toISOString() === '2026-10-18T00:00:00.000Z', 'open employment closes at the exclusive UTC-encoded calendar boundary');
  ok(JSON.stringify(await db.employmentRecord.findUnique({ where: { id: closed.id } })) === JSON.stringify(closed), 'already closed employment dates remain unchanged');
  ok(separated.probationRecords[0].probationStatus === 'CLOSED' && separated.probationRecords[0].decision === 'PENDING' && !separated.probationRecords[0].decisionAt && separated.probationRecords[0].closedBySeparationCaseId === found.id, 'probation closes through H10 without fabricating an H2 decision');
  ok(separated.employeeAccount?.status === 'DISABLED' && separated.employeeAccount.audits.some(event => event.action === 'DISABLED'), 'account disabling is audited in the finalization transaction');
  ok(Boolean(await jwtVerify(jwt, secret)), 'old JWT remains cryptographically valid');
  await assert.rejects(() => resolveEmployeeSelfContext(decoded, { organizationId: organization.id }, db), error => error instanceof EmployeeSelfAccessError && error.code === 'ACCOUNT_UNAVAILABLE'); checks++;
  const audit = await service.getSeparationAuditHistory(found.id, { pageSize: 100 });
  ok(audit.items.some(event => event.action === 'SEPARATION_COMPLETED' && event.actorUserId === hr.id) && audit.items.some(event => event.action === 'PROBATION_CLOSED'), 'final lifecycle changes have immutable separation audit history');
  const repeat = await service.executeSeparation(execution(found));
  ok(repeat.id === final.id && (await db.employeeStatusHistory.count({ where: { employeeId: person.id } })) === 1, 'repeated execution returns the completed result without duplicate transitions');
  await denied(() => service.updateSeparationCase({ ...version(final), details: { separationType: 'OTHER', reason: 'Reopen' } }), 'INVALID_STATE');
  await assert.rejects(() => db.employeeSeparationCase.update({ where: { id: final.id }, data: { status: 'IN_PROGRESS' } }), /Completed separation is immutable/); checks++;
  ok(await protectedHistory() === preserved, 'hiring, payroll snapshots/periods, leave ledger, attendance and corrections are unchanged');
  const pay = await service.getFinalPayReadiness(found.id);
  ok(pay.status === 'FOLLOW_UP_REQUIRED' && pay.finalizedPayrollOverlaps.length === 1 && pay.financialFollowUpBlocksSeparation === false && pay.calculationStatus === 'NOT_CALCULATED' && !('netAmount' in pay), 'final pay readiness flags financial follow-up without inventing calculations or blocking exit');
  ok(!(await service.getEmployeeSeparationSummary(person.id)).hasActiveCase && (await service.getEmployeeSeparationCases(person.id)).items.some(entry => entry.status === 'COMPLETED'), 'profile summary and employee history distinguish completed cases');
  ok((await service.getCompletedSeparations({ pageSize: 1 })).total === 1 && (await as(foreignHr).getCompletedSeparations()).total === 0, 'completed listings are paginated and tenant-scoped');
  await denied(() => as(foreignHr).getFinalPayReadiness(final.id), 'NOT_FOUND');
  await assert.rejects(() => db.employeeAccount.update({ where: { id: person.linked!.id }, data: { status: 'ACTIVE', disabledAt: null, disabledReason: null } }), /Separated employee account cannot be activated/); checks++;
  await assert.rejects(() => db.attendanceEvent.create({ data: { organizationId: organization.id, employeeId: person.id, source: 'MANUAL', sourceReference: 'post-exit', occurredAt: trustedNow, direction: 'TIME_IN', createdById: hr.id } }), /outside completed employment/); checks++;
  await assert.rejects(() => db.employeeCompensation.create({ data: { organizationId: organization.id, employeeId: person.id, compensationType: 'MONTHLY', baseRate: 1, payFrequency: 'MONTHLY', currency: 'PHP', effectiveFrom: date('2026-10-18') } }), /active compensation/); checks++;
  await assert.rejects(() => db.dailyAttendanceRecord.update({ where: { id: futureAttendance.id }, data: { attendanceStatus: 'PRESENT', workedSeconds: 3600 } }), /outside completed employment/); checks++;
  await assert.rejects(() => db.payrollEntry.update({ where: { id: futureEntry.id }, data: { grossAmount: 1 } }), /outside completed employment/); checks++;
  const { withdrawLeaveRequest } = await import('../src/features/leave/service');
  await assert.rejects(() => db.$transaction(tx => withdrawLeaveRequest({ organizationId: organization.id, employeeId: person.id, actorUserId: person.login.id, requestId: leave.id }, tx)), error => error instanceof Error && 'code' in error && error.code === 'FORBIDDEN'); checks++;

  const invited = await employee('INVITED');
  let invitedCase = await prepare(invited);
  invitedCase = await service.approveSeparationCase(approval(invitedCase));
  await service.executeSeparation(execution(invitedCase));
  const disabledInvitation = await db.employeeAccount.findUniqueOrThrow({ where: { id: invited.linked!.id } });
  ok(disabledInvitation.status === 'DISABLED' && !disabledInvitation.activationTokenHash && !disabledInvitation.activationTokenExpiresAt, 'pending invitation tokens are invalidated');
  ok(!await db.$transaction(tx => activateEmployeeAccountInTransaction(tx, { token: invited.invitation.token, passwordHash: 'unused', now: new Date() })), 'old invitation cannot activate after separation');

  const racing = await employee('NONE');
  let raceCase = await prepare(racing);
  raceCase = await service.approveSeparationCase(approval(raceCase));
  const races = await Promise.allSettled([service.executeSeparation(execution(raceCase)), as(admin).executeSeparation(execution(raceCase))]);
  ok(races.some(result => result.status === 'fulfilled') && (await db.employeeStatusHistory.count({ where: { employeeId: racing.id } })) === 1 && (await db.employeeSeparationAudit.count({ where: { caseId: raceCase.id, action: 'SEPARATION_COMPLETED' } })) === 1, 'concurrent execution creates one transition and one completion audit');
  const rollbackPerson = await employee();
  let rollbackCase = await prepare(rollbackPerson);
  rollbackCase = await service.approveSeparationCase(approval(rollbackCase));
  const rollbackBefore = JSON.stringify(await db.employee.findUnique({ where: { id: rollbackPerson.id }, include: { employmentRecords: true, probationRecords: true, statusHistory: true, employeeAccount: { include: { audits: true } } } }));
  await db.$executeRawUnsafe(`CREATE FUNCTION "${schema}".h102_fail_audit() RETURNS TRIGGER AS $$ BEGIN IF NEW."action" = 'SEPARATION_COMPLETED' THEN RAISE EXCEPTION 'Forced final audit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await db.$executeRawUnsafe(`CREATE TRIGGER h102_fail_audit BEFORE INSERT ON "${schema}"."EmployeeSeparationAudit" FOR EACH ROW EXECUTE FUNCTION "${schema}".h102_fail_audit()`);
  await denied(() => service.executeSeparation(execution(rollbackCase)), 'UNAVAILABLE');
  ok(JSON.stringify(await db.employee.findUnique({ where: { id: rollbackPerson.id }, include: { employmentRecords: true, probationRecords: true, statusHistory: true, employeeAccount: { include: { audits: true } } } })) === rollbackBefore && (await service.getSeparationCaseById(rollbackCase.id)).version === rollbackCase.version, 'downstream audit failure rolls back employee, employment, probation, account, histories and case version');
  await db.$executeRawUnsafe(`DROP TRIGGER h102_fail_audit ON "${schema}"."EmployeeSeparationAudit"`);
  const cancelled = await service.cancelSeparationCase({ ...version(rollbackCase), reason: 'Cancelled before execution' });
  await denied(() => service.executeSeparation(execution(cancelled)), 'INVALID_STATE');
  const invalidPerson = await employee('NONE');
  let invalid = await prepare(invalidPerson);
  await db.employeeSeparationCase.update({ where: { id: invalid.id }, data: { proposedLastWorkingDay: date('2026-10-18') } });
  await denied(() => service.approveSeparationCase(approval(invalid)), 'INVALID_INPUT');
  await db.employeeSeparationCase.update({ where: { id: invalid.id }, data: { proposedLastWorkingDay: date('2026-10-17') } });
  await db.attendanceEvent.create({ data: { organizationId: organization.id, employeeId: invalidPerson.id, source: 'MANUAL', sourceReference: 'date-conflict', occurredAt: trustedNow, direction: 'TIME_IN', createdById: hr.id } });
  await denied(() => service.approveSeparationCase(approval(invalid)), 'INVALID_STATE');
  const workRacePerson = await employee('NONE');
  let workRaceCase = await prepare(workRacePerson);
  workRaceCase = await service.approveSeparationCase(approval(workRaceCase));
  let signalEmployeeLocked!: () => void;
  const employeeLocked = new Promise<void>(resolve => { signalEmployeeLocked = resolve; });
  let signalExecutionReachedClock!: () => void;
  const executionReachedClock = new Promise<void>(resolve => { signalExecutionReachedClock = resolve; });
  const concurrentService = createSeparationService(db, async () => ({ userId: hr.id, organizationId: organization.id, role: hr.role }), () => { signalExecutionReachedClock(); return trustedNow; });
  const workWriter = db.$transaction(async tx => {
    await tx.$queryRawUnsafe(`SELECT "id" FROM "${schema}"."Employee" WHERE "id" = $1 FOR UPDATE`, workRacePerson.id);
    signalEmployeeLocked();
    await executionReachedClock;
    await tx.attendanceEvent.create({ data: { organizationId: organization.id, employeeId: workRacePerson.id, source: 'MANUAL', sourceReference: 'concurrent-work', occurredAt: trustedNow, direction: 'TIME_IN', createdById: hr.id } });
  }, { timeout: 20000 });
  await employeeLocked;
  const workRaceExecution = concurrentService.executeSeparation(execution(workRaceCase));
  await workWriter;
  await denied(() => workRaceExecution, 'INVALID_STATE');
  ok((await db.employee.findUniqueOrThrow({ where: { id: workRacePerson.id } })).employeeStatus === 'ACTIVE', 'execution sees attendance committed while it waited for the employee lock and rolls back');
  const backdatedPerson = await employee('NONE');
  invalid = await prepare(backdatedPerson, '2026-10-17');
  await denied(() => service.approveSeparationCase(approval(invalid)), 'INVALID_INPUT');
  invalid = await service.approveSeparationCase({ ...approval(invalid), backdatedJustification: 'Explicit administrative correction with historical records reviewed' });
  ok((await service.executeSeparation(execution(invalid))).status === 'COMPLETED', 'documented backdated separation executes without rewriting protected history');

  const inactivePerson = await employee('NONE');
  const { doNotRenewEmployee } = await import('../src/features/employees/lifecycle');
  const { prisma: lifecycle } = await import('../src/lib/db/prisma');
  await doNotRenewEmployee({ employeeId: inactivePerson.id, organizationId: organization.id, actorUserId: hr.id, confirmed: true, nonRenewalEffectiveAt: date('2025-07-01'), decisionAt: date('2025-07-02'), remarks: 'H2 non-renewal unchanged' });
  const h2Before = JSON.stringify(await db.employee.findUniqueOrThrow({ where: { id: inactivePerson.id }, include: { employmentDecisions: true, employmentRecords: true, probationRecords: true } }).then(({ employeeStatus: _status, updatedAt: _updated, ...rest }) => { void _status; void _updated; return rest; }));
  ok((await db.employee.findUniqueOrThrow({ where: { id: inactivePerson.id } })).employeeStatus === 'INACTIVE', 'H2 non-renewal remains INACTIVE without automatic exit');
  let inactiveCase = await prepare(inactivePerson, '2026-10-18', 'Explicit authorized formal exit after non-renewal', '2025-06-30');
  await db.employeeSeparationCase.update({ where: { id: inactiveCase.id }, data: { proposedLastWorkingDay: date('2026-10-17') } });
  await denied(() => service.approveSeparationCase(approval(inactiveCase)), 'INVALID_INPUT');
  await db.employeeSeparationCase.update({ where: { id: inactiveCase.id }, data: { proposedLastWorkingDay: date('2025-06-30') } });
  inactiveCase = await service.approveSeparationCase(approval(inactiveCase));
  await service.executeSeparation(execution(inactiveCase));
  ok((await db.employeeStatusHistory.findFirstOrThrow({ where: { employeeId: inactivePerson.id, toStatus: 'SEPARATED' } })).fromStatus === 'INACTIVE', 'formal inactive exit records INACTIVE to SEPARATED');
  ok(JSON.stringify(await db.employee.findUniqueOrThrow({ where: { id: inactivePerson.id }, include: { employmentDecisions: true, employmentRecords: true, probationRecords: true } }).then(({ employeeStatus: _status, updatedAt: _updated, ...rest }) => { void _status; void _updated; return rest; })) === h2Before, 'formal inactive exit preserves original H2 decisions and closed employment dates');
  await lifecycle.$disconnect();
  ok((await db.dailyAttendanceRecord.findUniqueOrThrow({ where: { id: attendance.id } })).finalizedAt !== null, 'finalized attendance remains preserved');
}

async function main() {
  const configured = process.env.H10_TEST_DATABASE_URL || process.env.DATABASE_URL;
  assert.ok(configured, 'A PostgreSQL connection is required for isolated-schema testing.');
  const base = new URL(configured);
  if (base.hostname.endsWith('.neon.tech')) base.hostname = base.hostname.replace('-pooler.', '.');
  const url = new URL(base);
  url.searchParams.set('schema', schema); url.searchParams.set('options', `-c search_path=${schema},public`); url.searchParams.set('connection_limit', '6');
  const control = new PrismaClient({ datasources: { db: { url: base.toString() } } });
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  let created = false;
  const previousUrl = process.env.DATABASE_URL;
  try {
    assert.match(schema, /^h102_test_[a-f0-9]{24}$/);
    await control.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
    const output = execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url.toString(), PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1' }, encoding: 'utf8', timeout: 180000 });
    assert.ok(output.includes('All migrations have been successfully applied.'));
    console.log('H10.1 and H10.2 migrations replayed in the isolated test schema.');
    const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname=${schema} AND tablename IN ('EmployeeSeparationCase', 'EmployeeClearanceItem', 'EmployeeSeparationReview', 'EmployeeSeparationAudit')`;
    assert.equal(tables.length, 4, 'All H10 tables must exist');
    const indexes = await db.$queryRaw<{ indexdef: string }[]>`SELECT indexdef FROM pg_indexes WHERE schemaname=${schema} AND indexname='EmployeeSeparationCase_one_active_employee'`;
    assert.ok(indexes.length === 1 && indexes[0].indexdef.includes('UNIQUE') && indexes[0].indexdef.includes('APPROVED_PENDING_EFFECTIVE') && !indexes[0].indexdef.includes('COMPLETED'), 'Active-case uniqueness includes pending approval and excludes completed cases');
    const triggers = await db.$queryRaw<{ tgname: string; enabled: boolean }[]>`SELECT t.tgname, (t.tgenabled <> 'D') AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${schema} AND NOT t.tgisinternal`;
    for (const name of ['SeparationAudit_immutable', 'SeparationAudit_no_truncate', 'SeparationAudit_timestamp', 'SeparationReview_immutable', 'SeparationReview_no_truncate', 'SeparationCase_final_state', 'ProbationRecord_separation_scope', 'EmployeeAccount_post_separation', 'AttendanceEvent_post_separation', 'DailyAttendance_post_separation', 'PayrollEntry_post_separation']) assert.ok(triggers.some(trigger => trigger.tgname === name && trigger.enabled), `Required trigger ${name} must exist and be enabled`);
    const constraints = await db.$queryRaw<{ conname: string; convalidated: boolean }[]>`SELECT c.conname, c.convalidated FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=${schema} AND (c.conname LIKE 'SeparationCase_%' OR c.conname LIKE 'ClearanceItem_%' OR c.conname LIKE 'SeparationReview_%')`;
    assert.ok(constraints.length >= 8 && constraints.every(constraint => constraint.convalidated), 'H10 validation constraints must exist and be validated');
    console.log('Verified H10 tables, active-case unique index, validated constraints, and enabled audit/lifecycle triggers.');
    process.env.DATABASE_URL = url.toString();
    const selectedRegression = process.argv.find(argument => argument.startsWith('--regression='))?.slice('--regression='.length);
    if (process.argv.includes('--regressions-only') || selectedRegression) {
      const npmCli = process.env.npm_execpath; assert.ok(npmCli);
      const failures: string[] = [];
      const scripts = ['test:h10-1', 'test:h1', 'test:h2', 'test:h4', 'test:h5', 'test:h6', 'test:s1'];
      if (selectedRegression) assert.ok(scripts.includes(selectedRegression), 'Unknown regression script');
      for (const script of selectedRegression ? [selectedRegression] : scripts) {
        try {
          const output = execFileSync(process.execPath, [npmCli, 'run', script], { env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test' }, encoding: 'utf8', timeout: 600000, maxBuffer: 30 * 1024 * 1024 });
          console.log(output.split(/\r?\n/).filter(line => !line.startsWith('prisma:query')).join('\n'));
          console.log(`REGRESSION ${script}: PASS`);
        } catch (error) {
          failures.push(script);
          if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
            console.error(String(error.stdout).split(/\r?\n/).filter(line => !line.startsWith('prisma:query')).slice(-35).join('\n'));
            console.error(String(error.stderr).slice(-5000));
          } else console.error(error);
        }
      }
      assert.deepEqual(failures, []);
    } else if (process.argv.includes('--interface')) {
      const { testInterface } = await import('./test-h10-interface');
      await testInterface(db, url.toString());
    } else { await integration(db); console.log(`H10.2 final separation tests passed: ${checks} checks.`); }
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    await db.$disconnect();
    if (created) { assert.match(schema, /^h102_test_[a-f0-9]{24}$/); await control.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); console.log(`Removed isolated fixture schema ${schema}.`); }
    await control.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
