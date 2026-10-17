import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { PrismaClient, Role, SeparationReviewKind } from '@prisma/client';
import { createSeparationService, SeparationContext } from '../src/features/separation/core';
import { CaseDetails, SeparationError, createSchema, parseInput } from '../src/features/separation/domain';
import { assessNotice, resolveSeparationPolicy } from '../src/features/separation/policy';

// Every table, migration and fixture belongs to a fresh, random schema. No test
// deletes HR records or changes migration history in the configured schema.
if (existsSync('.env')) process.loadEnvFile('.env');
const configuredUrl = process.env.H10_TEST_DATABASE_URL || process.env.DATABASE_URL;
const schema = `h10_test_${randomBytes(12).toString('hex')}`;
let checks = 0;
const ok = (condition: unknown, message: string) => { assert.ok(condition, message); console.log(`PASS ${++checks}: ${message}`); };
async function denied(operation: () => Promise<unknown>, code: string) {
  await assert.rejects(operation, error => error instanceof SeparationError && error.code === code);
  checks++;
}
const date = (value: string) => new Date(`${value}T00:00:00Z`);
const details: CaseDetails = { separationType: 'RESIGNATION', reason: 'Written voluntary resignation received', noticeDate: '2026-01-31', proposedLastWorkingDay: '2026-02-27', proposedEffectiveDate: '2026-02-28' };

function domainChecks() {
  const policy = resolveSeparationPolicy('st-aloysius');
  ok(assessNotice(details, policy) === 'COMPLIANT', 'SAGA uses a calendar month with month-end clamping');
  ok(assessNotice({ ...details, proposedEffectiveDate: '2026-02-27' }, policy) === 'EXCEPTION_REQUIRED', 'short notice is explicitly noncompliant');
  ok(assessNotice({ ...details, noticeDate: '2024-01-31', proposedEffectiveDate: '2024-02-29' }, policy) === 'COMPLIANT', 'leap-year calendar month is valid');
  ok(assessNotice({ ...details, noticeDate: '2026-07-01', proposedEffectiveDate: '2026-07-31' }, policy) === 'EXCEPTION_REQUIRED', '30 days are not substituted for a calendar month');
  ok(assessNotice(details, resolveSeparationPolicy('other')) === 'POLICY_REQUIRED', 'SAGA notice policy is not applied to another tenant');
  for (const change of [{ separationType: 'INVALID' }, { noticeDate: '2026-02-30' }, { noticeDate: '2026-01-31T00:00:00Z' }, { actorUserId: 'forged' }, { status: 'READY_FOR_FINAL_REVIEW' }, { initiatedAt: '2000-01-01' }]) {
    assert.throws(() => parseInput(createSchema, { ...details, employeeId: 'employee', requestKey: 'key', ...change }), SeparationError);
    checks++;
  }
}

async function fixtures(db: PrismaClient) {
  const organization = await db.organization.create({ data: { name: 'SAGA H10 isolated fixture', slug: 'st-aloysius', timeZone: 'Asia/Manila' } });
  const otherOrganization = await db.organization.create({ data: { name: 'Other isolated tenant', slug: 'other' } });
  const user = async (role: Role, organizationId = organization.id) => db.user.create({ data: { organizationId, name: role, email: `${organizationId}-${role}@h10.invalid`, role } });
  const hr = await user('HR_ADMIN');
  const admin = await user('ORGANIZATION_ADMIN');
  const manager = await user('HIRING_MANAGER');
  const employeeUser = await user('EMPLOYEE');
  const otherHr = await user('HR_ADMIN', otherOrganization.id);
  let sequence = 0;
  async function employee(organizationId = organization.id, createdById = hr.id) {
    const suffix = `${++sequence}`;
    const job = await db.job.create({ data: { organizationId, title: 'Fixture job', slug: `job-${suffix}`, department: 'Test', employmentType: 'Full-time', location: 'Campus', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test' } });
    const applicant = await db.applicant.create({ data: { firstName: 'Exit', lastName: suffix, email: `employee-${suffix}@h10.invalid`, phone: '0' } });
    const application = await db.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'Retain hiring traceability' } });
    const created = await db.employee.create({ data: { organizationId, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `H10-${suffix}`, firstName: 'Exit', lastName: suffix, email: applicant.email, phone: '0', createdById } });
    const employment = await db.employmentRecord.create({ data: {
      employeeId: created.id, jobId: job.id, jobTitle: job.title, department: 'Test', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time',
      hireDate: date('2025-01-01'), startDate: date('2025-01-01'), salary: 30000, payFrequency: 'MONTHLY', effectiveFrom: date('2025-01-01'), createdById,
      probation: { create: { employeeId: created.id, category: 'NON_TEACHING', startedAt: date('2025-01-01'), expectedEndAt: date('2025-07-01'), policySnapshot: 'H2 fixture' } },
    } });
    return { ...created, employment };
  }
  const context = (actor: typeof hr): SeparationContext => ({ userId: actor.id, organizationId: actor.organizationId, role: actor.role });
  const as = (actor: typeof hr) => createSeparationService(db, async () => context(actor));
  return { organization, otherOrganization, hr, admin, manager, employeeUser, otherHr, employee, as };
}

async function integration(db: PrismaClient) {
  const f = await fixtures(db);
  const hr = f.as(f.hr), admin = f.as(f.admin), other = f.as(f.otherHr);
  const employee = await f.employee();
  const foreignEmployee = await f.employee(f.otherOrganization.id, f.otherHr.id);
  const account = await db.employeeAccount.create({ data: { organizationId: f.organization.id, userId: f.employeeUser.id, employeeId: employee.id, status: 'ACTIVE', activatedAt: new Date(), createdById: f.hr.id } });
  await db.employeeAccountAudit.create({ data: { organizationId: f.organization.id, employeeAccountId: account.id, actorUserId: f.hr.id, action: 'ACTIVATED', details: { fixture: true } } });
  const schedule = await db.workScheduleGroup.create({ data: { organizationId: f.organization.id, scheduleKey: 'H10_TEST', name: 'Preserved schedule', createdById: f.hr.id } });
  const scheduleVersion = await db.workScheduleVersion.create({ data: { scheduleGroupId: schedule.id, version: 1, displayName: 'Preserved schedule version', createdById: f.hr.id } });
  await db.employeeScheduleAssignment.create({ data: { organizationId: f.organization.id, employeeId: employee.id, scheduleVersionId: scheduleVersion.id, effectiveFrom: date('2025-01-01'), createdById: f.hr.id } });
  const leaveType = await db.leaveType.create({ data: { organizationId: f.organization.id, code: 'TEST', name: 'Preserved leave', countingMode: 'CALENDAR_DAYS', policyReference: 'Fixture' } });
  const leave = await db.leaveRequest.create({ data: { organizationId: f.organization.id, employeeId: employee.id, leaveTypeId: leaveType.id, requestedStartDate: date('2026-01-20'), requestedEndDate: date('2026-01-20'), reason: 'Preserve approved leave', status: 'APPROVED', policySnapshot: {}, leaveTypeCodeSnapshot: 'TEST', leaveTypeNameSnapshot: 'Test', leavePaidSnapshot: true, countingModeSnapshot: 'CALENDAR_DAYS' } });
  await db.leaveLedgerEntry.create({ data: { organizationId: f.organization.id, employeeId: employee.id, leaveTypeId: leaveType.id, leaveRequestId: leave.id, entryType: 'APPROVED_LEAVE', amountUnits: -1, reason: 'Preserve ledger', actorUserId: f.hr.id } });
  await db.attendanceEvent.create({ data: { organizationId: f.organization.id, employeeId: employee.id, occurredAt: date('2026-01-20'), direction: 'TIME_IN', source: 'MANUAL', sourceReference: 'h10-attendance', createdById: f.hr.id } });
  await db.dailyAttendanceRecord.create({ data: { organizationId: f.organization.id, employeeId: employee.id, employmentRecordId: employee.employment.id, attendanceDate: date('2026-01-20'), timeZoneSnapshot: 'Asia/Manila', attendanceStatus: 'PRESENT', lastCalculatedAt: new Date() } });
  const compensation = await db.employeeCompensation.create({ data: { organizationId: f.organization.id, employeeId: employee.id, compensationType: 'MONTHLY', baseRate: 30000, payFrequency: 'MONTHLY', currency: 'PHP', effectiveFrom: date('2025-01-01') } });
  const period = await db.payrollPeriod.create({ data: { organizationId: f.organization.id, name: 'Finalized historical period', periodStart: date('2026-01-01'), periodEnd: date('2026-01-31'), payDate: date('2026-02-01'), status: 'FINALIZED', finalizedById: f.hr.id, finalizedAt: new Date() } });
  await db.payrollEntry.create({ data: { organizationId: f.organization.id, employeeId: employee.id, payrollPeriodId: period.id, employeeCompensationId: compensation.id, status: 'FINALIZED', baseAmount: 30000, grossAmount: 30000, netAmount: 30000, calculationSnapshot: { preserved: true } } });
  async function protectedSnapshot() {
    return JSON.stringify(await db.employee.findUniqueOrThrow({ where: { id: employee.id }, include: {
      employmentRecords: true, probationRecords: true, statusHistory: true, employmentDecisions: true,
      employeeAccount: { include: { audits: true, user: true } }, attendanceEvents: true, dailyAttendanceRecords: true,
      scheduleAssignments: true, leaveRequests: true, leaveLedgerEntries: true, payrollEntries: true, sourceApplication: true,
    } }));
  }
  const protectedBefore = await protectedSnapshot();
  const base = { ...details, employeeId: employee.id, requestKey: 'hr-create' };
  const startedAt = Date.now();
  let found = await hr.createSeparationCase(base);
  ok(found.status === 'DRAFT' && found.initiatedById === f.hr.id, 'HR Admin creates a draft case with the correct actor');
  ok(found.clearanceItems.length === 5 && found.clearanceItems.every(item => item.status === 'PENDING' && !item.reviewedAt && !item.reviewedById), 'default checklist is explicitly pending and unreviewed');
  ok(found.noticeCompliance === 'COMPLIANT' && found.reviews.length === 0, 'compliant dates do not fabricate superior or HRMO review');
  ok((await hr.createSeparationCase(base)).id === found.id, 'identical request key is idempotent');
  await denied(() => hr.createSeparationCase({ ...base, reason: 'Changed request body' }), 'CONFLICT');
  await denied(() => hr.createSeparationCase({ ...base, requestKey: 'duplicate' }), 'DUPLICATE_CASE');
  const secondEmployee = await f.employee();
  const adminCase = await admin.createSeparationCase({ ...base, employeeId: secondEmployee.id, requestKey: 'admin' });
  ok(adminCase.initiatedById === f.admin.id, 'Organization Admin can create a case');
  await denied(() => f.as(f.manager).createSeparationCase({ ...base, requestKey: 'manager' }), 'FORBIDDEN');
  await denied(() => f.as(f.employeeUser).createSeparationCase({ ...base, requestKey: 'employee' }), 'FORBIDDEN');
  await denied(() => hr.createSeparationCase({ ...base, employeeId: foreignEmployee.id, requestKey: 'foreign-employee' }), 'NOT_FOUND');
  await denied(() => other.getSeparationCaseById(found.id), 'NOT_FOUND');
  await denied(() => f.as(f.manager).getSeparationCaseById(found.id), 'FORBIDDEN');
  await denied(() => f.as(f.employeeUser).getEmployeeSeparationSummary(employee.id), 'FORBIDDEN');
  const forgedContext = createSeparationService(db, async () => ({ userId: f.hr.id, organizationId: f.otherOrganization.id, role: 'HR_ADMIN' }));
  await denied(() => forgedContext.getOrganizationSeparationCases(), 'FORBIDDEN');
  const staleRole = createSeparationService(db, async () => ({ userId: f.manager.id, organizationId: f.organization.id, role: 'HR_ADMIN' }));
  await denied(() => staleRole.getOrganizationSeparationCases(), 'FORBIDDEN');
  await denied(() => hr.createSeparationCase({ ...base, separationType: 'INVALID' as 'OTHER' }), 'INVALID_INPUT');
  await denied(() => hr.createSeparationCase({ ...base, noticeDate: '2026-02-30' }), 'INVALID_INPUT');
  await denied(() => hr.createSeparationCase({ ...base, proposedLastWorkingDay: '2026-03-01' }), 'INVALID_INPUT');
  await denied(() => hr.createSeparationCase({ ...base, actorUserId: f.admin.id } as typeof base), 'INVALID_INPUT');
  await denied(() => hr.markReadyForFinalReview({ caseId: found.id, expectedVersion: found.version }), 'NOT_READY');
  found = await hr.updateSeparationCase({ caseId: found.id, expectedVersion: found.version, details, status: 'IN_PROGRESS' });
  const v = () => ({ caseId: found.id, expectedVersion: found.version });
  await denied(() => hr.recordClearanceDecision({ ...v(), itemId: found.clearanceItems[0].id, status: 'CLEARED', verified: false }), 'INVALID_INPUT');
  await denied(() => hr.recordClearanceDecision({ ...v(), itemId: found.clearanceItems[0].id, status: 'WAIVED', verified: true }), 'INVALID_INPUT');
  await denied(() => f.as(f.manager).recordClearanceDecision({ ...v(), itemId: found.clearanceItems[0].id, status: 'WAIVED', verified: true, remarks: 'Forged authority' }), 'FORBIDDEN');
  found = await hr.recordClearanceDecision({ ...v(), itemId: found.clearanceItems[0].id, status: 'BLOCKED', verified: true, remarks: 'Unreturned equipment' });
  ok(!(await hr.assessSeparationReadiness(found.id)).ready, 'required blocked clearance prevents readiness');
  const clearedId = found.clearanceItems[0].id;
  found = await hr.recordClearanceDecision({ ...v(), itemId: clearedId, status: 'CLEARED', verified: true, remarks: 'Return receipt verified' });
  ok(found.clearanceItems.find(item => item.id === clearedId)?.reviewedById === f.hr.id, 'authorized clearance decision records its reviewer');
  const concurrentVersion = v();
  const decisions = await Promise.allSettled([
    hr.recordClearanceDecision({ ...concurrentVersion, itemId: clearedId, status: 'BLOCKED', verified: true, remarks: 'Conflicting decision' }),
    admin.recordClearanceDecision({ ...concurrentVersion, itemId: clearedId, status: 'WAIVED', verified: true, remarks: 'Documented waiver' }),
  ]);
  ok(decisions.filter(result => result.status === 'fulfilled').length === 1 && decisions.some(result => result.status === 'rejected' && result.reason instanceof SeparationError && result.reason.code === 'CONFLICT'), 'concurrent clearance decisions have one winner and one conflict');
  found = await hr.getSeparationCaseById(found.id);
  for (const item of found.clearanceItems) found = await hr.recordClearanceDecision({ ...v(), itemId: item.id, status: item.id === clearedId ? 'WAIVED' : 'CLEARED', verified: true, remarks: 'Verified documented resolution' });
  ok(found.clearanceProgress.completed === found.clearanceProgress.required, 'all required items have verified decisions');
  ok((await hr.assessSeparationReadiness(found.id)).blockers.includes('REVIEW_PENDING:NOTICE_SUPERIOR'), 'written notice routing stays pending without actual review evidence');
  for (const kind of ['NOTICE_SUPERIOR', 'NOTICE_HRMO'] as SeparationReviewKind[]) found = await hr.recordSeparationReview({ ...v(), kind, evidence: `Verified written ${kind} review filed in HR records`, verified: true });
  found = await hr.addClearanceItem({ ...v(), requestKey: 'optional', item: { category: 'OTHER', title: 'Optional exit interview', isRequired: false } });
  const optional = found.clearanceItems.find(item => item.requestKey === 'optional')!;
  found = await hr.recordClearanceDecision({ ...v(), itemId: optional.id, status: 'BLOCKED', verified: true, remarks: 'Optional scheduling pending' });
  ok((await hr.assessSeparationReadiness(found.id)).ready, 'optional unresolved items do not block readiness');
  // Remove a required category through a supported edit, then verify the policy
  // still requires an explicit required checklist entry for that category.
  const required = found.clearanceItems.find(item => item.category === 'FINANCE')!;
  found = await hr.updateClearanceItem({ ...v(), itemId: required.id, item: { category: required.category, title: required.title, isRequired: false } });
  ok((await hr.assessSeparationReadiness(found.id)).blockers.includes('MISSING_REQUIRED_CLEARANCE:FINANCE'), 'missing required category prevents readiness');
  found = await hr.updateClearanceItem({ ...v(), itemId: required.id, item: { category: required.category, title: required.title, isRequired: true } });
  ok(found.clearanceItems.find(item => item.id === required.id)?.status === 'PENDING', 'editing a requirement resets its previous decision');
  found = await hr.recordClearanceDecision({ ...v(), itemId: required.id, status: 'CLEARED', verified: true });
  ok((await hr.assessSeparationReadiness(found.id)).ready, 'complete clearance and verified notice routing permit readiness');
  const auditCount = await db.employeeSeparationAudit.count({ where: { caseId: found.id } });
  const versionBeforeRead = found.version;
  await hr.getSeparationCaseById(found.id); await hr.getSeparationAuditHistory(found.id); await hr.getEmployeeSeparationSummary(employee.id);
  ok((await db.employeeSeparationAudit.count({ where: { caseId: found.id } })) === auditCount && (await hr.getSeparationCaseById(found.id)).version === versionBeforeRead, 'read-only access does not mutate case or audit history');
  found = await hr.markReadyForFinalReview(v());
  ok(found.status === 'READY_FOR_FINAL_REVIEW', 'readiness transition does not finalize separation');
  const readyAuditCount = await db.employeeSeparationAudit.count({ where: { caseId: found.id } });
  await hr.markReadyForFinalReview(v());
  ok((await db.employeeSeparationAudit.count({ where: { caseId: found.id } })) === readyAuditCount, 'repeated readiness request does not duplicate the audit');
  await denied(() => hr.updateSeparationCase({ ...v(), details }), 'INVALID_STATE');
  await denied(() => hr.recordClearanceDecision({ ...v(), itemId: clearedId, status: 'PENDING', verified: false }), 'INVALID_STATE');
  const history = await hr.getSeparationAuditHistory(found.id, { pageSize: 100 });
  ok(history.items.every(event => [f.hr.id, f.admin.id].includes(event.actorUserId) && new Date(event.createdAt).getTime() >= startedAt - 30000 && new Date(event.createdAt).getTime() <= Date.now() + 30000), 'audits contain actual actors and trusted server timestamps');
  ok(history.items.some(event => event.action === 'CLEARANCE_WAIVED') && history.items.some(event => event.action === 'READY_FOR_REVIEW'), 'waiver and readiness decisions have audit events');
  await assert.rejects(() => db.employeeSeparationAudit.update({ where: { id: history.items[0].id }, data: { remarks: 'Rewrite' } }), /Separation history is append-only/); checks++;
  await assert.rejects(() => db.employeeSeparationAudit.delete({ where: { id: history.items[0].id } }), /Separation history is append-only/); checks++;
  await assert.rejects(() => db.$executeRawUnsafe(`TRUNCATE TABLE "${schema}"."EmployeeSeparationAudit"`), /Separation history is append-only/); checks++;
  await assert.rejects(() => db.employeeSeparationReview.updateMany({ where: { caseId: found.id }, data: { evidence: 'Rewrite' } }), /Separation history is append-only/); checks++;
  ok(await protectedSnapshot() === protectedBefore, 'EmployeeStatus, EmploymentRecord dates, probation, ESS user/account, attendance, approved leave, ledger, payroll snapshots and hiring traceability remain byte-for-byte unchanged');
  const cancelled = await admin.cancelSeparationCase({ ...v(), reason: 'Employee withdrew resignation in writing' });
  ok(cancelled.status === 'CANCELLED' && cancelled.cancelledById === f.admin.id && (await db.employeeSeparationAudit.count({ where: { caseId: found.id } })) === readyAuditCount + 1, 'cancellation preserves prior history and records its actor');
  await denied(() => hr.cancelSeparationCase({ caseId: cancelled.id, expectedVersion: cancelled.version, reason: 'Duplicate' }), 'INVALID_STATE');
  await denied(() => hr.updateSeparationCase({ caseId: cancelled.id, expectedVersion: cancelled.version, details }), 'INVALID_STATE');
  await denied(() => hr.markReadyForFinalReview({ caseId: cancelled.id, expectedVersion: cancelled.version }), 'INVALID_STATE');
  ok(!(await hr.getEmployeeSeparationSummary(employee.id)).hasActiveCase, 'cancelled case no longer counts as an active exit');
  const short = { ...base, requestKey: 'short', proposedEffectiveDate: '2026-02-10', proposedLastWorkingDay: '2026-02-09' };
  found = await hr.createSeparationCase(short);
  ok(found.noticeCompliance === 'EXCEPTION_REQUIRED' && !found.noticeExceptionById, 'short notice does not silently become compliant');
  await denied(() => hr.recordNoticeException({ ...v(), reason: ' ' }), 'INVALID_INPUT');
  await denied(() => f.as(f.employeeUser).recordNoticeException({ ...v(), reason: 'Unauthorized exception' }), 'FORBIDDEN');
  found = await hr.recordNoticeException({ ...v(), reason: 'Authorized shortened notice supported by documented mutual arrangement' });
  ok(found.noticeCompliance === 'EXCEPTION_RECORDED' && found.noticeExceptionById === f.hr.id && Boolean(found.noticeExceptionAt), 'short-notice exception records reason, authorized actor and trusted time');
  ok((await hr.getSeparationAuditHistory(found.id)).items.some(event => event.action === 'NOTICE_EXCEPTION_RECORDED'), 'notice exception is preserved in audit history');
  found = await hr.updateSeparationCase({ ...v(), details: { ...details, noticeDate: null }, status: 'IN_PROGRESS' });
  ok(found.noticeCompliance === 'PENDING' && !found.noticeExceptionById && (await hr.assessSeparationReadiness(found.id)).blockers.includes('NOTICE_NOT_VALIDATED'), 'missing notice information blocks readiness and invalidates an old exception');
  await denied(() => hr.recordNoticeException({ ...v(), reason: 'Missing notice cannot be waived' }), 'INVALID_STATE');
  const raceEmployee = await f.employee();
  const creations = await Promise.allSettled(['a', 'b'].map(key => hr.createSeparationCase({ ...base, employeeId: raceEmployee.id, requestKey: `race-${key}` })));
  ok(creations.filter(result => result.status === 'fulfilled').length === 1 && (await db.employeeSeparationCase.count({ where: { employeeId: raceEmployee.id, status: { not: 'CANCELLED' } } })) === 1, 'concurrent active case creation has exactly one winner');
  const retryEmployee = await f.employee();
  const retries = await Promise.all([1, 2].map(() => hr.createSeparationCase({ ...base, employeeId: retryEmployee.id, requestKey: 'same-key-race' })));
  ok(retries[0].id === retries[1].id, 'concurrent same-key submissions return the same committed case');
  const foreignCase = await other.createSeparationCase({ ...base, employeeId: foreignEmployee.id, requestKey: 'foreign' });
  ok(foreignCase.noticeCompliance === 'POLICY_REQUIRED', 'a non-SAGA tenant does not inherit SAGA resignation policy');
  await denied(() => hr.recordClearanceDecision({ caseId: foreignCase.id, expectedVersion: foreignCase.version, itemId: foreignCase.clearanceItems[0].id, status: 'CLEARED', verified: true }), 'NOT_FOUND');
  await denied(() => hr.recordClearanceDecision({ caseId: found.id, expectedVersion: found.version, itemId: foreignCase.clearanceItems[0].id, status: 'CLEARED', verified: true }), 'NOT_FOUND');
  const list = await hr.getOrganizationSeparationCases({ page: 1, pageSize: 2 });
  const page2 = await hr.getOrganizationSeparationCases({ page: 2, pageSize: 2 });
  ok(list.total === await db.employeeSeparationCase.count({ where: { organizationId: f.organization.id } }) && list.items.length === 2 && page2.items.every(item => !list.items.some(first => first.id === item.id)) && !list.items.some(item => item.id === foreignCase.id), 'pagination has accurate tenant-scoped totals and distinct pages');
  ok((await hr.getOrganizationSeparationCases({ page: 999, pageSize: 2 })).items.length === 0, 'pagination beyond the last page is empty');
  await denied(() => hr.getOrganizationSeparationCases({ pageSize: 101 }), 'INVALID_INPUT');
  await denied(() => hr.getEmployeeSeparationCases(foreignEmployee.id), 'NOT_FOUND');
  const concurrentUpdate = { ...v(), details: { ...details, reason: 'Concurrent update' } };
  const updates = await Promise.allSettled([hr.updateSeparationCase(concurrentUpdate), admin.updateSeparationCase(concurrentUpdate)]);
  ok(updates.filter(result => result.status === 'fulfilled').length === 1 && updates.some(result => result.status === 'rejected' && result.reason instanceof SeparationError && result.reason.code === 'CONFLICT'), 'stale case updates cannot silently overwrite one another');
  found = await hr.getSeparationCaseById(found.id);
  // Force an audit insert failure, proving all case edits and the claimed version
  // roll back. The trigger exists only in this disposable test schema.
  await db.$executeRawUnsafe(`CREATE FUNCTION "${schema}".h10_fail_audit() RETURNS TRIGGER AS $$ BEGIN IF NEW."newValues"->>'reason' = 'H10_FORCE_AUDIT_FAILURE' THEN RAISE EXCEPTION 'Forced audit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await db.$executeRawUnsafe(`CREATE TRIGGER h10_fail_audit BEFORE INSERT ON "${schema}"."EmployeeSeparationAudit" FOR EACH ROW EXECUTE FUNCTION "${schema}".h10_fail_audit()`);
  const beforeFailure = await hr.getSeparationCaseById(found.id);
  await denied(() => hr.updateSeparationCase({ ...v(), details: { ...details, reason: 'H10_FORCE_AUDIT_FAILURE' } }), 'UNAVAILABLE');
  ok(JSON.stringify(await hr.getSeparationCaseById(found.id)) === JSON.stringify(beforeFailure), 'audit failure rolls back the case, version and all history');
  await db.$executeRawUnsafe(`DROP TRIGGER h10_fail_audit ON "${schema}"."EmployeeSeparationAudit"`);
  const terminationEmployee = await f.employee();
  let termination = await hr.createSeparationCase({ employeeId: terminationEmployee.id, requestKey: 'termination', separationType: 'TERMINATION', reason: 'Administrative review only', proposedLastWorkingDay: '2026-02-27', proposedEffectiveDate: '2026-02-28' });
  termination = await hr.updateSeparationCase({ caseId: termination.id, expectedVersion: termination.version, details: { separationType: 'TERMINATION', reason: 'Administrative review only', proposedLastWorkingDay: '2026-02-27', proposedEffectiveDate: '2026-02-28' }, status: 'IN_PROGRESS' });
  ok(termination.noticeCompliance === 'NOT_APPLICABLE' && termination.readiness.blockers.includes('REVIEW_PENDING:TERMINATION_DUE_PROCESS'), 'termination remains administrative pending review, documentation and due-process evidence');
  await denied(() => hr.recordSeparationReview({ caseId: termination.id, expectedVersion: termination.version, kind: 'NOTICE_SUPERIOR', evidence: 'Wrong review', verified: true }), 'INVALID_STATE');
  // Exercise the real H2 service with its separate connection directed at this schema.
  const inactiveEmployee = await f.employee();
  const { doNotRenewEmployee } = await import('../src/features/employees/lifecycle');
  const { prisma: lifecycleDb } = await import('../src/lib/db/prisma');
  try {
    assert.ok(await lifecycleDb.employee.findUnique({ where: { id: inactiveEmployee.id } }), 'H2 connection must see the isolated fixture before any mutation');
    await doNotRenewEmployee({ employeeId: inactiveEmployee.id, organizationId: f.organization.id, actorUserId: f.hr.id, confirmed: true, nonRenewalEffectiveAt: date('2025-07-01'), decisionAt: date('2025-07-02'), remarks: 'Explicit H2 non-renewal' });
    const inactive = await db.employee.findUniqueOrThrow({ where: { id: inactiveEmployee.id }, include: { statusHistory: true, employmentRecords: true, employmentDecisions: true } });
    ok(inactive.employeeStatus === 'INACTIVE' && inactive.statusHistory.some(event => event.toStatus === 'INACTIVE'), 'real H2 non-renewal remains INACTIVE with original status history');
    await denied(() => hr.createSeparationCase({ ...base, employeeId: inactive.id, requestKey: 'inactive-missing' }), 'INVALID_INPUT');
    await hr.createSeparationCase({ ...base, employeeId: inactive.id, requestKey: 'inactive-explicit', inactiveEmployeeJustification: 'HR explicitly initiated administrative exit following H2 non-renewal' });
    ok(JSON.stringify(await db.employee.findUniqueOrThrow({ where: { id: inactive.id }, include: { statusHistory: true, employmentRecords: true, employmentDecisions: true } })) === JSON.stringify(inactive), 'explicit inactive exit preserves H2 records and never changes INACTIVE to SEPARATED');
  } finally { await lifecycleDb.$disconnect(); }
  ok(await protectedSnapshot() === protectedBefore, 'all original HR histories remain unchanged after all H10.1 operations');
}

async function main() {
  domainChecks();
  if (!configuredUrl) throw new Error('DATABASE_URL or H10_TEST_DATABASE_URL is required for isolated-schema integration tests.');
  const baseUrl = new URL(configuredUrl);
  // Neon documents direct connections for migration tooling. This affects only
  // the disposable test schema; the application's DATABASE_URL is unchanged.
  if (baseUrl.hostname.endsWith('.neon.tech')) baseUrl.hostname = baseUrl.hostname.replace('-pooler.', '.');
  const testUrl = new URL(baseUrl);
  testUrl.searchParams.set('schema', schema);
  testUrl.searchParams.set('connection_limit', '6');
  // Existing lifecycle triggers contain unqualified relation names. Explicitly
  // bind their search path as well as Prisma's schema-qualified ORM queries.
  testUrl.searchParams.set('options', `-c search_path=${schema},public`);
  const control = new PrismaClient({ datasources: { db: { url: baseUrl.toString() } } });
  const db = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });
  let created = false;
  const priorDatabaseUrl = process.env.DATABASE_URL;
  try {
    assert.match(schema, /^h10_test_[a-f0-9]{24}$/);
    await control.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    created = true;
    // Migrate ONLY the new schema, never the existing public schema. Historical
    // migrations are executed unchanged, including the finalized-payroll guards.
    const output = execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
      // Prisma's advisory lock is database-wide. Each test invocation exclusively
      // owns a cryptographically random schema, so no shared migration target can
      // race. Disable that lock ONLY in this isolated migration child process;
      // never change or terminate another session's advisory locks.
      env: { ...process.env, DATABASE_URL: testUrl.toString(), PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1' }, encoding: 'utf8', timeout: 180000,
    });
    assert.ok(output.includes('All migrations have been successfully applied.'));
    console.log('All migrations applied successfully to the isolated fixture schema.');
    assert.equal(testUrl.searchParams.get('schema'), schema);
    const location = await db.$queryRaw<Array<{ current_schema: string }>>`SELECT current_schema()`;
    assert.equal(location[0].current_schema, schema, 'Raw SQL and existing trigger queries must use the isolated schema');
    assert.equal(await db.employeeSeparationCase.count(), 0, 'The isolated fixture schema must start empty');
    process.env.DATABASE_URL = testUrl.toString();
    if (process.argv.includes('--regressions-only')) {
      const npmCli = process.env.npm_execpath;
      assert.ok(npmCli && existsSync(npmCli), 'Run through npm run test:h10-1 -- --regressions-only');
      const failures: string[] = [];
      for (const script of ['test:h1', 'test:h2', 'test:h4', 'test:h5', 'test:h6', 'test:s1']) {
        try {
          execFileSync(process.execPath, [npmCli, 'run', script], { env: { ...process.env, DATABASE_URL: testUrl.toString() }, stdio: 'inherit', timeout: 600000 });
          console.log(`REGRESSION ${script}: PASS`);
        } catch {
          failures.push(script);
          console.log(`REGRESSION ${script}: FAIL`);
        }
      }
      assert.deepEqual(failures, [], `Regression failures: ${failures.join(', ')}`);
      console.log('All requested regressions passed in the isolated fixture schema.');
    } else {
      await integration(db);
      console.log(`H10.1 Exit & Clearance tests passed: ${checks} checks.`);
    }
  } finally {
    if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = priorDatabaseUrl;
    await db.$disconnect();
    if (created) {
      assert.match(schema, /^h10_test_[a-f0-9]{24}$/);
      await control.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      console.log(`Removed isolated fixture schema ${schema}.`);
    }
    await control.$disconnect();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'H10.1 test failed.'); process.exitCode = 1; });
