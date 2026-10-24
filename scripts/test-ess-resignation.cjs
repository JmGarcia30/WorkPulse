/* eslint-disable @typescript-eslint/no-require-imports -- Verified recovery, mandatory rollback fixtures. */
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs'), config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
let activeDb, session, tenant, hrContext, sequence = 0;
require('tsx/cjs');
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'server-only') return {};
  if (name === '@/lib/db/prisma') return { prisma: new Proxy({}, { get: (_, key) => activeDb[key] }) };
  if (name === '@/lib/auth/session') return { getSession: async () => session };
  if (name === '@/lib/auth/guards') return { requireBackOfficeContext: async () => hrContext };
  if (name === '@/lib/tenant/server') return { requireRequestTenant: async () => tenant };
  if (name === 'next/cache') return { revalidatePath: () => {} };
  return originalLoad.call(this, name, parent, main);
};
const { createEmployeeResignationService } = require('../src/features/separation/ess-resignation.ts');
const { createSeparationService } = require('../src/features/separation/core.ts');
const { submitResignationAction } = require('../src/features/separation/ess-resignation-actions.ts');
const { readResignationNotifications } = require('../src/features/separation/resignation-notifications.ts');
const scenarios = [], rollback = Symbol('ess-resignation-rollback');
const ok = (value, label) => { assert(value, label); scenarios.push(label); console.log('PASS ' + label); };
const date = value => new Date(value + 'T00:00:00Z');
const version = found => ({ caseId: found.id, expectedVersion: found.version });
async function denied(operation, code) { await assert.rejects(operation, error => error.code === code); }
function client(tx) {
  return new Proxy(tx, { get(target, key) {
    if (key === '$transaction') return async operation => {
      const name = 'ess_notice_' + (++sequence); await tx.$executeRawUnsafe('SAVEPOINT ' + name);
      try { const result = await operation(activeDb); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
      catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); throw error; }
    };
    return Reflect.get(target, key);
  } });
}
async function focused(tx) {
  const marker = 'ess-resignation-' + Date.now();
  const saga = await tx.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
  const company = await tx.organization.create({ data: { name: 'ESS Resignation Company', slug: marker, timeZone: 'Asia/Manila' } });
  const foreign = await tx.organization.create({ data: { name: 'Foreign ESS Company', slug: marker + '-foreign', timeZone: 'Asia/Manila' } });
  const user = (org, role, suffix) => tx.user.create({ data: { organizationId: org.id, role, name: role, email: `${marker}-${suffix}@fixture.invalid` } });
  const hr = await user(company, 'HR_ADMIN', 'hr'), sagaHr = await user(saga, 'HR_ADMIN', 'saga'), foreignHr = await user(foreign, 'HR_ADMIN', 'foreign'), manager = await user(company, 'HIRING_MANAGER', 'manager');
  const actor = user => ({ userId: user.id, organizationId: user.organizationId, role: user.role, name: user.name, email: user.email });
  hrContext = actor(hr);
  let now = new Date('2030-01-31T02:00:00Z');
  const hrService = createSeparationService(activeDb, async () => hrContext, () => now);
  const ess = createEmployeeResignationService(activeDb, async () => ({ session, tenant }), () => now);
  async function employee(org = company) {
    const suffix = ++sequence, creator = org.id === saga.id ? sagaHr : org.id === foreign.id ? foreignHr : hr;
    const job = await tx.job.create({ data: { organizationId: org.id, title: 'ESS notice fixture', slug: marker + suffix, department: 'Fixture', employmentType: 'Full-time', location: 'Fixture', description: 'Fixture', responsibilities: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture' } });
    const applicant = await tx.applicant.create({ data: { firstName: 'ESSNotice', lastName: String(suffix), email: `${marker}-${suffix}@fixture.invalid`, phone: '0' } });
    const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'Preserve hiring traceability' } });
    const person = await tx.employee.create({ data: { organizationId: org.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `${marker}-${suffix}`, firstName: applicant.firstName, lastName: applicant.lastName, email: applicant.email, phone: '0', createdById: creator.id } });
    const employment = await tx.employmentRecord.create({ data: { employeeId: person.id, jobId: job.id, jobTitle: job.title, department: job.department, employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: date('2029-01-01'), startDate: date('2029-01-01'), salary: 30000, payFrequency: 'MONTHLY', effectiveFrom: date('2029-01-01'), createdById: creator.id } });
    const login = await user(org, 'EMPLOYEE', 'employee-' + suffix);
    const account = await tx.employeeAccount.create({ data: { organizationId: org.id, employeeId: person.id, userId: login.id, status: 'ACTIVE', activatedAt: new Date(), createdById: creator.id } });
    const compensation = await tx.employeeCompensation.create({ data: { organizationId: org.id, employeeId: person.id, compensationType: 'MONTHLY', baseRate: 30000, payFrequency: 'MONTHLY', effectiveFrom: date('2029-01-01') } });
    const period = await tx.payrollPeriod.create({ data: { organizationId: org.id, name: marker + suffix, periodStart: date('2030-01-01'), periodEnd: date('2030-01-31'), payDate: date('2030-01-31') } });
    await tx.payrollEntry.create({ data: { organizationId: org.id, employeeId: person.id, payrollPeriodId: period.id, employeeCompensationId: compensation.id, baseAmount: 30000, grossAmount: 30000, netAmount: 30000 } });
    return { ...person, login, account, employment };
  }
  function login(person) { session = actor(person.login); tenant = { organizationId: person.organizationId }; }
  const person = await employee(), other = await employee(), foreignPerson = await employee(foreign);
  login(person);
  const notice = { requestKey: randomUUID(), reason: 'My verified voluntary resignation notice', proposedLastWorkingDay: '2030-02-27', proposedEffectiveDate: '2030-02-28', confirmed: true };
  for (const invalid of [{ ...notice, employeeId: other.id }, { ...notice, organizationId: foreign.id }, { ...notice, noticeDate: '2000-01-01' }, { ...notice, separationType: 'TERMINATION' }, { ...notice, acknowledgedById: hr.id }, { ...notice, confirmed: false }, { ...notice, reason: '' }, { ...notice, proposedLastWorkingDay: '2030-02-30' }, { ...notice, proposedLastWorkingDay: notice.proposedEffectiveDate }, { ...notice, proposedLastWorkingDay: '2029-01-01' }]) await denied(() => ess.submitEmployeeResignation(invalid), 'INVALID_INPUT');
  const preserved = () => tx.employee.findUniqueOrThrow({ where: { id: person.id }, include: { employmentRecords: true, employeeAccount: true, statusHistory: true, payrollEntries: true, leaveLedgerEntries: true, dailyAttendanceRecords: true, probationRecords: true } }).then(value => JSON.stringify(value));
  const before = await preserved();
  const submitted = await ess.submitEmployeeResignation(notice);
  const repeated = await ess.submitEmployeeResignation(notice);
  assert.equal(repeated.caseId, submitted.caseId);
  await denied(() => ess.submitEmployeeResignation({ ...notice, reason: 'Changed payload' }), 'CONFLICT');
  await denied(() => ess.submitEmployeeResignation({ ...notice, requestKey: randomUUID() }), 'DUPLICATE_CASE');
  const found = await tx.employeeSeparationCase.findUniqueOrThrow({ where: { id: submitted.caseId } });
  assert.equal(found.submissionSource, 'ESS'); assert.equal(found.status, 'DRAFT'); assert.equal(found.noticeCompliance, 'POLICY_REQUIRED');
  assert.equal(found.initiatedById, person.login.id); assert.equal(found.noticeDate.toISOString().slice(0, 10), '2030-01-31');
  assert.equal(await tx.employeeClearanceItem.count({ where: { caseId: found.id, status: 'PENDING' } }), 5);
  assert.equal(await tx.employeeFinalPay.count({ where: { caseId: found.id } }), 0);
  assert.equal(await preserved(), before);
  ok(true, 'Eligible ESS notice uses the existing draft/checklist/audit lifecycle; missing policy does not veto lodging; duplicate submissions and spoofed inputs are rejected without workforce/payroll/access/final-pay changes');
  const notifications = await readResignationNotifications(tx, company.id, true);
  assert(notifications.some(item => item.id === found.id));
  assert.equal((await readResignationNotifications(tx, foreign.id, true)).length, 0);
  assert.equal((await readResignationNotifications(tx, company.id, false)).length, 0);
  const original = JSON.stringify(found.employeeNoticeSnapshot);
  let managed = await hrService.getSeparationCaseById(found.id);
  await denied(() => hrService.cancelSeparationCase({ ...version(managed), reason: 'HR does not approve resignation' }), 'INVALID_INPUT');
  await denied(() => hrService.updateSeparationCase({ ...version(managed), details: { separationType: 'TERMINATION', reason: found.reason, noticeDate: '2030-01-31', proposedLastWorkingDay: '2030-02-27', proposedEffectiveDate: '2030-02-28' } }), 'INVALID_INPUT');
  await denied(() => hrService.updateSeparationCase({ ...version(managed), details: { separationType: 'RESIGNATION', reason: 'HR rewrites reason', noticeDate: '2030-01-31', proposedLastWorkingDay: '2030-02-27', proposedEffectiveDate: '2030-02-28' } }), 'INVALID_STATE');
  managed = await hrService.acknowledgeEmployeeResignation({ ...version(managed), remarks: 'Receipt recorded. Please coordinate turnover with HR.' });
  await hrService.acknowledgeEmployeeResignation({ ...version(managed), remarks: 'Retry does not overwrite receipt' });
  assert.equal((await readResignationNotifications(tx, company.id, true)).length, 0);
  const tracked = await ess.getMyResignations();
  assert.equal(tracked.items[0].acknowledgmentRemarks, 'Receipt recorded. Please coordinate turnover with HR.');
  assert.equal(tracked.items[0].clearance.completed, 0);
  assert.equal(managed.status, 'DRAFT'); assert.equal(managed.reviews.length, 0);
  await hrService.saveResignationPolicy({ noticePeriod: 1, noticeUnit: 'CALENDAR_MONTHS', allowExceptions: true });
  const details = { separationType: 'RESIGNATION', reason: found.reason, noticeDate: '2030-01-31', proposedLastWorkingDay: '2030-02-27', proposedEffectiveDate: '2030-02-28', administrativeRemarks: 'HR_PRIVATE_REFERENCE_NOT_FOR_ESS' };
  managed = await hrService.updateSeparationCase({ ...version(managed), details, status: 'IN_PROGRESS' });
  assert.equal(managed.noticeCompliance, 'COMPLIANT'); assert.equal(JSON.stringify(managed.employeeNoticeSnapshot), original);
  assert(!JSON.stringify(await ess.getMyResignations()).includes('HR_PRIVATE_REFERENCE_NOT_FOR_ESS'));
  assert(!('history' in (await ess.getMyResignations()).items[0]));
  assert.equal((await tx.employeeSeparationAudit.findMany({ where: { caseId: found.id, action: 'NOTICE_RECORDED' } }))[0].actorUserId, person.login.id);
  ok(true, 'Tenant-scoped Requires Attention notifications clear on receipt acknowledgment without changing case state/reviews; original notice and private HR evidence boundaries are preserved');
  login(other);
  assert.equal((await ess.getMyResignations()).items.length, 0);
  await denied(() => ess.getMyResignations({ employeeId: person.id }), 'INVALID_INPUT');
  session = actor(person.login); tenant = { organizationId: foreign.id };
  await denied(() => ess.getMyResignations(), 'FORBIDDEN');
  login(foreignPerson);
  assert.equal((await ess.getMyResignations()).items.length, 0);
  for (const bad of [actor(hr), actor(manager), { ...actor(hr), role: 'EMPLOYEE' }, null]) {
    session = bad; tenant = { organizationId: company.id };
    await denied(() => ess.submitEmployeeResignation(notice), 'FORBIDDEN');
  }
  login(other);
  await tx.employeeAccount.update({ where: { id: other.account.id }, data: { status: 'DISABLED', disabledAt: new Date(), disabledReason: 'Fixture access check' } });
  await denied(() => ess.submitEmployeeResignation({ ...notice, requestKey: randomUUID() }), 'FORBIDDEN');
  await tx.employeeAccount.update({ where: { id: other.account.id }, data: { status: 'ACTIVE', disabledAt: null, disabledReason: null } });
  await tx.employee.update({ where: { id: other.id }, data: { employeeStatus: 'INACTIVE' } });
  await denied(() => ess.getMyResignations(), 'FORBIDDEN');
  await tx.employee.update({ where: { id: other.id }, data: { employeeStatus: 'ACTIVE' } });
  await tx.user.update({ where: { id: other.login.id }, data: { role: 'HIRING_MANAGER' } });
  await denied(() => ess.submitEmployeeResignation({ ...notice, requestKey: randomUUID() }), 'FORBIDDEN');
  await tx.user.update({ where: { id: other.login.id }, data: { role: 'EMPLOYEE' } });
  const malicious = new FormData(); for (const [key, value] of Object.entries(notice)) malicious.set(key, key === 'confirmed' ? 'on' : value);
  malicious.set('employeeId', person.id);
  assert((await submitResignationAction({}, malicious)).error);
  ok(true, 'Cross-employee/tenant reads, spoofed identities, HR/manager sessions, disabled/inactive accounts and stale roles cannot submit or view ESS notices');
  login(other);
  const second = await ess.submitEmployeeResignation({ ...notice, requestKey: randomUUID(), reason: 'Short notice remains lodged for HR review', proposedLastWorkingDay: '2030-02-01', proposedEffectiveDate: '2030-02-02' });
  let short = await hrService.getSeparationCaseById(second.caseId);
  assert.equal(short.noticeCompliance, 'EXCEPTION_REQUIRED');
  short = await hrService.cancelSeparationCase({ ...version(short), reason: 'Employee requested withdrawal', employeeWithdrawalConfirmed: true, employeeWithdrawalEvidence: 'Signed employee withdrawal reference' });
  assert.equal((await ess.getMyResignations()).items[0].status, 'CANCELLED');
  assert.equal((await ess.getMyResignations()).hasActiveExit, false);
  const replacement = await ess.submitEmployeeResignation({ ...notice, requestKey: randomUUID(), reason: 'Replacement after documented withdrawal' });
  assert.notEqual(replacement.caseId, short.id);
  await assert.rejects(() => activeDb.$transaction(unit => unit.employeeSeparationCase.update({ where: { id: replacement.caseId }, data: { reason: 'Raw overwrite' } })));
  ok(true, 'Short notices are recorded without fabricated exceptions; only documented employee withdrawal cancels an ESS case; resubmission uses a new case and original data is database-protected');
  const sagaPerson = await employee(saga); login(sagaPerson);
  const sagaNotice = await ess.submitEmployeeResignation({ ...notice, requestKey: randomUUID(), reason: 'SAGA employee resignation' });
  hrContext = actor(sagaHr);
  let sagaCase = await hrService.getSeparationCaseById(sagaNotice.caseId);
  assert.equal(sagaCase.policySnapshot.noticeCalendarMonths, 1); assert.equal(sagaCase.policySnapshot.requireNoticeReviews, true);
  sagaCase = await hrService.updateSeparationCase({ ...version(sagaCase), details: { ...details, reason: 'SAGA employee resignation', administrativeRemarks: undefined }, status: 'IN_PROGRESS' });
  for (const item of sagaCase.clearanceItems) sagaCase = await hrService.recordClearanceDecision({ ...version(sagaCase), itemId: item.id, status: 'CLEARED', verified: true });
  await denied(() => hrService.markReadyForFinalReview(version(sagaCase)), 'NOT_READY');
  for (const kind of ['NOTICE_SUPERIOR', 'NOTICE_HRMO']) sagaCase = await hrService.recordSeparationReview({ ...version(sagaCase), kind, evidence: 'Actual SAGA documentary review', verified: true });
  sagaCase = await hrService.markReadyForFinalReview(version(sagaCase));
  assert.equal(sagaCase.acknowledgedAt, null);
  sagaCase = await hrService.approveSeparationCase({ ...version(sagaCase), decision: 'APPROVE_SEPARATION', remarks: 'Administrative readiness, not permission to resign' });
  assert.equal((await tx.employeeAccount.findUniqueOrThrow({ where: { id: sagaPerson.account.id } })).status, 'ACTIVE');
  now = new Date('2030-02-28T02:00:00Z');
  sagaCase = await hrService.executeSeparation({ ...version(sagaCase), remarks: 'Existing explicit separation execution' });
  await denied(() => ess.getMyResignations(), 'FORBIDDEN');
  await denied(() => ess.submitEmployeeResignation({ ...notice, requestKey: randomUUID() }), 'FORBIDDEN');
  assert.equal((await tx.employeeAccount.findUniqueOrThrow({ where: { id: sagaPerson.account.id } })).status, 'DISABLED');
  assert.equal(await tx.employeeFinalPay.count({ where: { caseId: sagaCase.id } }), 0);
  const finalPay = await hrService.createFinalPay(sagaCase.id);
  assert.equal(finalPay.caseId, sagaCase.id); assert.equal(finalPay.status, 'DRAFT');
  ok(true, 'SAGA retains notice month-end semantics and both reviews; acknowledgment is not an approval gate; only normal execution revokes ESS and existing final-pay services remain available afterward');
}
async function main() {
  const before = await helper.fingerprints(db);
  try { await db.$transaction(async tx => { activeDb = client(tx); await focused(tx); throw rollback; }, { timeout: 600000, maxWait: 10000 }); }
  catch (error) { if (error !== rollback) throw error; }
  assert.deepEqual((await helper.fingerprints(db, before.columns)).tables, before.tables);
  helper.assertOriginalUnchanged(config);
  ok(true, 'All fixture changes rolled back; existing employee, payroll, leave, attendance, policy and financial records and the original environment file are unchanged');
  fs.mkdirSync('docs/ess-resignation', { recursive: true });
  fs.writeFileSync('docs/ess-resignation/tests.json', JSON.stringify({ passed: true, scenarios, tablesPreserved: before.tables.length, fixtures: 'rollback transaction with savepoints; no independently committed concurrency claim' }, null, 2));
}
main().catch(error => { console.error(error.code || error.name, String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]'), error.stack?.split('\n').filter(line => line.includes('scripts\\') || line.includes('scripts/'))); process.exitCode = 1; }).finally(async () => { Module._load = originalLoad; await db.$disconnect(); });
