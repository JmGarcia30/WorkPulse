/* eslint-disable @typescript-eslint/no-require-imports -- Recovery-only rollback fixtures. */
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs'), config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
let activeDb, context, sequence = 0;
require('tsx/cjs');
const original = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'server-only') return {};
  if (name === '@/lib/db/prisma') return { prisma: new Proxy({}, { get: (_, key) => activeDb[key] }) };
  if (name === '@/lib/auth/guards') return { requireBackOfficeContext: async () => context };
  if (name === 'next/cache') return { revalidatePath: () => {} };
  return original.call(this, name, parent, main);
};
const policies = require('../src/features/separation/policy.ts');
const { createSeparationService } = require('../src/features/separation/core.ts');
const { saveResignationPolicyAction } = require('../src/features/separation/policy-actions.ts');
const { resolveEmployeeSelfContext } = require('../src/features/employee-self-service/access.ts');
const scenarios = [], rollback = Symbol('exit-policy-rollback');
const ok = (value, label) => { assert(value, label); scenarios.push(label); console.log('PASS ' + label); };
const date = value => new Date(value + 'T00:00:00Z');
const version = found => ({ caseId: found.id, expectedVersion: found.version });
async function denied(operation, code) { await assert.rejects(operation, error => error.code === code); }
function client(tx) {
  return new Proxy(tx, { get(target, key) {
    if (key === '$transaction') return async operation => {
      const name = 'exit_policy_' + (++sequence);
      await tx.$executeRawUnsafe('SAVEPOINT ' + name);
      try { const result = await operation(activeDb); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
      catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); throw error; }
    };
    return Reflect.get(target, key);
  } });
}
async function focused(tx) {
  const marker = 'exit-policy-' + Date.now();
  const saga = await tx.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
  const company = await tx.organization.create({ data: { name: 'SAGA', slug: marker, timeZone: 'Asia/Manila' } });
  const foreign = await tx.organization.create({ data: { name: 'Foreign', slug: marker + '-foreign' } });
  async function user(org, role, suffix) { return tx.user.create({ data: { organizationId: org.id, role, name: role, email: `${marker}-${suffix}@fixture.invalid` } }); }
  const hr = await user(company, 'HR_ADMIN', 'hr'), admin = await user(company, 'ORGANIZATION_ADMIN', 'admin');
  const manager = await user(company, 'HIRING_MANAGER', 'manager'), sagaHr = await user(saga, 'HR_ADMIN', 'saga'), foreignHr = await user(foreign, 'HR_ADMIN', 'foreign');
  const actor = user => ({ userId: user.id, organizationId: user.organizationId, role: user.role });
  context = actor(hr);
  const service = createSeparationService(activeDb, async () => context, () => new Date('2030-03-01T02:00:00Z'));
  const days = { noticePeriod: 30, noticeUnit: 'CALENDAR_DAYS', allowExceptions: true };
  const months = { noticePeriod: 1, noticeUnit: 'CALENDAR_MONTHS', allowExceptions: false };
  for (const invalid of [{ ...days, noticePeriod: -1 }, { ...days, noticePeriod: 1.5 }, { ...days, noticeUnit: 'BUSINESS_DAYS' }, { ...days, organizationId: saga.id }, { ...months, noticePeriod: 121 }]) {
    await denied(() => service.saveResignationPolicy(invalid), 'INVALID_INPUT');
  }
  const sagaPolicy = policies.resolveSeparationPolicy(saga.slug, { version: 1, policy: days, configuredById: hr.id, configuredAt: new Date().toISOString() });
  ok(sagaPolicy.noticeCalendarMonths === 1 && sagaPolicy.requireNoticeReviews && !sagaPolicy.noticeCalendarDays, 'SAGA remains fixed at one calendar month with superior/HRMO reviews, even with generic stored settings');
  assert.equal(policies.assessNotice({ separationType: 'RESIGNATION', noticeDate: '2028-01-31', proposedEffectiveDate: '2028-02-29' }, sagaPolicy), 'COMPLIANT');
  assert.equal(policies.assessNotice({ separationType: 'RESIGNATION', noticeDate: '2030-07-01', proposedEffectiveDate: '2030-07-31' }, sagaPolicy), 'EXCEPTION_REQUIRED');
  ok(true, 'SAGA preserves leap-year clamping and does not replace calendar months with 30 days');

  async function employee(org = company) {
    const suffix = ++sequence;
    const creator = org.id === saga.id ? sagaHr : hr;
    const job = await tx.job.create({ data: { organizationId: org.id, title: 'Fixture', slug: `${marker}-${suffix}`, department: 'Fixture', employmentType: 'Full-time', location: 'Fixture', description: 'Fixture', responsibilities: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture' } });
    const applicant = await tx.applicant.create({ data: { firstName: 'Exit', lastName: 'Fixture', email: `${marker}-employee-${suffix}@fixture.invalid`, phone: '0' } });
    const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'History retained' } });
    const person = await tx.employee.create({ data: { organizationId: org.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `${marker}-${suffix}`, firstName: 'Exit', lastName: 'Fixture', email: applicant.email, phone: '0', createdById: creator.id } });
    await tx.employmentRecord.create({ data: { employeeId: person.id, jobId: job.id, jobTitle: job.title, department: job.department, employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: date('2029-01-01'), startDate: date('2029-01-01'), salary: 30000, payFrequency: 'MONTHLY', effectiveFrom: date('2029-01-01'), createdById: creator.id } });
    const login = await user(org, 'EMPLOYEE', 'login-' + suffix);
    await tx.employeeAccount.create({ data: { organizationId: org.id, employeeId: person.id, userId: login.id, status: 'ACTIVE', activatedAt: new Date(), createdById: creator.id } });
    return { ...person, login };
  }
  const details = { separationType: 'RESIGNATION', reason: 'Verified voluntary resignation', noticeDate: '2030-01-30', proposedLastWorkingDay: '2030-02-28', proposedEffectiveDate: '2030-03-01' };
  async function draft(person, extra = {}) { return service.createSeparationCase({ ...details, ...extra, employeeId: person.id, requestKey: `${marker}-${++sequence}` }); }
  async function start(found, extra = {}) { return service.updateSeparationCase({ ...version(found), details: { ...details, ...extra }, status: 'IN_PROGRESS' }); }
  async function clear(found) {
    for (const item of found.clearanceItems) found = await service.recordClearanceDecision({ ...version(found), itemId: item.id, status: 'CLEARED', verified: true });
    return found;
  }

  const person = await employee();
  let found = await start(await draft(person));
  assert.equal(found.noticeCompliance, 'POLICY_REQUIRED');
  found = await clear(found);
  assert(found.readiness.blockers.includes('RESIGNATION_POLICY_REQUIRED'));
  assert.equal((await service.getEmployeeSeparationCases(person.id)).items[0].noticeReviewStatus, 'PENDING');
  await denied(() => service.markReadyForFinalReview(version(found)), 'NOT_READY');
  await denied(() => service.recordNoticeException({ ...version(found), reason: 'Cannot bypass missing policy' }), 'INVALID_STATE');
  ok(true, 'Unconfigured organization fails closed at readiness and cannot bypass policy through an exception');

  const actionForm = new FormData(); actionForm.set('noticePeriod', '30'); actionForm.set('noticeUnit', 'CALENDAR_DAYS'); actionForm.set('allowExceptions', 'on');
  actionForm.set('organizationId', saga.id);
  assert((await saveResignationPolicyAction({}, actionForm)).error);
  actionForm.delete('organizationId');
  assert((await saveResignationPolicyAction({}, actionForm)).success);
  const configured = await service.getResignationPolicySettings();
  assert.equal(configured.configured.configuredById, hr.id);
  assert.equal(configured.policy.requireNoticeReviews, false);
  assert.equal((await tx.organization.findUniqueOrThrow({ where: { id: foreign.id } })).resignationPolicy, null);
  ok(true, 'Actual settings action saves only authenticated organization terms and recorder metadata; injected tenant fields are rejected');

  found = await start(found);
  assert.equal(found.noticeCompliance, 'COMPLIANT');
  assert.equal(found.policySnapshot.noticeCalendarDays, 30);
  found = await service.markReadyForFinalReview(version(found));
  await service.saveResignationPolicy(months);
  const snapshot = JSON.stringify(found.policySnapshot);
  found = await service.approveSeparationCase({ ...version(found), decision: 'APPROVE_SEPARATION', remarks: 'Verified approval' });
  assert.equal((await tx.employee.findUniqueOrThrow({ where: { id: person.id } })).employeeStatus, 'ACTIVE');
  found = await service.executeSeparation({ ...version(found), remarks: 'Final execution' });
  assert.equal(found.status, 'COMPLETED');
  assert.equal(JSON.stringify(found.policySnapshot), snapshot);
  assert.equal(found.employee.employeeStatus, 'SEPARATED');
  assert.equal((await tx.employeeAccount.findUniqueOrThrow({ where: { employeeId: person.id } })).status, 'DISABLED');
  await assert.rejects(resolveEmployeeSelfContext(actor(person.login), { organizationId: company.id }, tx));
  const audits = await service.getSeparationAuditHistory(found.id);
  assert(audits.items.some(item => item.action === 'CASE_UPDATED' && item.previousValues.policySnapshot.key === 'BASE_EXIT_V1_NOTICE_UNCONFIGURED' && item.newValues.policySnapshot.key === 'ORGANIZATION_EXIT_V1'));
  const counts = await tx.employeeStatusHistory.count({ where: { employeeId: person.id } });
  await service.executeSeparation({ ...version(found), remarks: 'Retry' });
  assert.equal(await tx.employeeStatusHistory.count({ where: { employeeId: person.id } }), counts);
  ok(true, 'Previously blocked case explicitly captures settings with audit; approval/execution use retained day policy, revoke ESS, and remain idempotent');

  const shortDetails = { noticeDate: '2030-02-28' };
  let short = await clear(await start(await draft(await employee(), shortDetails), shortDetails));
  assert.equal(short.policySnapshot.noticeCalendarMonths, 1);
  await denied(() => service.recordNoticeException({ ...version(short), reason: 'Not permitted' }), 'INVALID_STATE');
  await denied(() => service.markReadyForFinalReview(version(short)), 'NOT_READY');
  await service.saveResignationPolicy({ ...months, allowExceptions: true });
  // Changing settings must not loosen the policy of an existing case.
  short = await start(short, shortDetails);
  await denied(() => service.recordNoticeException({ ...version(short), reason: 'Still not permitted' }), 'INVALID_STATE');
  ok(true, 'New cases capture month policy; disabled exceptions remain forbidden after organization settings change');
  let exception = await clear(await start(await draft(await employee(), shortDetails), shortDetails));
  exception = await service.recordNoticeException({ ...version(exception), reason: 'HR authorizes documented early release' });
  assert.equal(exception.noticeCompliance, 'EXCEPTION_RECORDED');
  assert.equal(exception.noticeExceptionById, hr.id);
  exception = await service.markReadyForFinalReview(version(exception));
  exception = await service.approveSeparationCase({ ...version(exception), decision: 'APPROVE_SEPARATION', remarks: 'Exception reviewed' });
  exception = await service.executeSeparation({ ...version(exception), remarks: 'Early release executed' });
  assert.equal(exception.status, 'COMPLETED');
  ok(true, 'Authorized exception carries its HR recorder/reason through readiness, approval and final execution');

  const terminationDetails = { separationType: 'TERMINATION', noticeDate: null, reason: 'Administrative termination with evidence' };
  let termination = await clear(await start(await draft(await employee(), terminationDetails), terminationDetails));
  assert.equal(termination.noticeCompliance, 'NOT_APPLICABLE');
  await denied(() => service.markReadyForFinalReview(version(termination)), 'NOT_READY');
  for (const kind of ['TERMINATION_ADMIN_REVIEW', 'TERMINATION_DOCUMENTATION', 'TERMINATION_DUE_PROCESS']) termination = await service.recordSeparationReview({ ...version(termination), kind, evidence: 'Verified documentation on file', verified: true });
  termination = await service.markReadyForFinalReview(version(termination));
  termination = await service.approveSeparationCase({ ...version(termination), decision: 'APPROVE_SEPARATION', remarks: 'Termination review completed' });
  termination = await service.executeSeparation({ ...version(termination), remarks: 'Termination executed' });
  assert.equal(termination.status, 'COMPLETED');
  ok(true, 'Termination retains all three documentary review gates and completes through unchanged finalization');

  context = actor(sagaHr);
  await denied(() => service.saveResignationPolicy(days), 'INVALID_STATE');
  let sagaCase = await clear(await start(await draft(await employee(saga)))) ;
  await denied(() => service.markReadyForFinalReview(version(sagaCase)), 'NOT_READY');
  for (const kind of ['NOTICE_SUPERIOR', 'NOTICE_HRMO']) sagaCase = await service.recordSeparationReview({ ...version(sagaCase), kind, evidence: 'Verified SAGA notice review', verified: true });
  sagaCase = await service.markReadyForFinalReview(version(sagaCase));
  assert.equal(sagaCase.status, 'READY_FOR_FINAL_REVIEW');
  ok(true, 'SAGA settings cannot be overwritten and both institutional notice reviews remain mandatory');

  context = actor(foreignHr);
  await denied(() => service.getSeparationCaseById(found.id), 'NOT_FOUND');
  await denied(() => service.executeSeparation({ ...version(found), remarks: 'Foreign retry' }), 'NOT_FOUND');
  await denied(() => service.createSeparationCase({ ...details, employeeId: person.id, requestKey: marker + '-foreign-create' }), 'NOT_FOUND');
  assert.equal((await service.getResignationPolicySettings()).configured, null);
  context = { ...actor(foreignHr), organizationId: company.id };
  await denied(() => service.saveResignationPolicy(days), 'FORBIDDEN');
  for (const unauthorized of [admin, manager, person.login]) {
    context = actor(unauthorized);
    await denied(() => service.saveResignationPolicy(days), 'FORBIDDEN');
    assert((await saveResignationPolicyAction({}, actionForm)).error);
  }
  context = actor(hr);
  await tx.user.update({ where: { id: hr.id }, data: { role: 'EMPLOYEE' } });
  await denied(() => service.saveResignationPolicy(days), 'FORBIDDEN');
  ok(true, 'Cross-tenant reads/writes and forged contexts are denied; settings require persisted HR_ADMIN, including direct actions and revoked roles');
}
async function main() {
  const before = await helper.fingerprints(db);
  try { await db.$transaction(async tx => { activeDb = client(tx); await focused(tx); throw rollback; }, { timeout: 600000, maxWait: 10000 }); }
  catch (error) { if (error !== rollback) throw error; }
  assert.deepEqual((await helper.fingerprints(db, before.columns)).tables, before.tables);
  helper.assertOriginalUnchanged(config);
  ok(true, 'All fixture changes rolled back; every pre-existing table fingerprint and original environment file are unchanged');
  fs.mkdirSync('docs/exit-policy', { recursive: true });
  fs.writeFileSync('docs/exit-policy/tests.json', JSON.stringify({ passed: true, branchId: config.identity.branchId, scenarios, tablesPreserved: before.tables.length, concurrency: 'Serialized savepoints in rollback transaction; no independent commit/concurrency claim.' }, null, 2));
}
main().catch(error => { console.error(error.code || error.name, error.message?.includes('postgres') ? '[REDACTED]' : error.message, error.stack?.split('\n').filter(line => line.includes('scripts\\') || line.includes('scripts/'))); process.exitCode = 1; }).finally(async () => { Module._load = original; await db.$disconnect(); });
