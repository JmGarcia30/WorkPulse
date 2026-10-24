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
const domain = require('../src/features/separation/final-pay-domain.ts');
const { createSeparationService } = require('../src/features/separation/core.ts');
const { finalPayAction } = require('../src/features/separation/final-pay-actions.ts');
const scenarios = [], rollback = Symbol('final-pay-rollback');
const ok = (value, label) => { assert(value, label); scenarios.push(label); console.log('PASS ' + label); };
const date = value => new Date(value + 'T00:00:00Z');
const version = found => ({ caseId: found.caseId, expectedVersion: found.version });
const caseVersion = found => ({ caseId: found.id, expectedVersion: found.version });
async function denied(operation, code) { await assert.rejects(operation, error => error.code === code); }
function client(tx) {
  return new Proxy(tx, { get(target, key) {
    if (key === '$transaction') return async operation => {
      const name = 'final_pay_' + (++sequence);
      await tx.$executeRawUnsafe('SAVEPOINT ' + name);
      try { const result = await operation(activeDb); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
      catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); throw error; }
    };
    return Reflect.get(target, key);
  } });
}
function reviewedPayload() {
  const payload = domain.emptyFinalPayPayload();
  payload.coverageConfirmed = payload.taxReviewed = payload.reconciliationConfirmed = true;
  payload.reviewNotes = 'PH private-sector eligibility and lawful settlement reviewed. Calendar year 2030; salary Feb 2030; external payment register and signed legal/finance computation reconciled.';
  for (const line of payload.lines) { line.disposition = 'APPLICABLE'; line.basis = 'Verified HR/finance evidence reference and itemized legal or company-policy basis'; }
  Object.assign(payload.lines[0], { first: '30000.00', second: '20000.00' });
  Object.assign(payload.lines[1], { first: '120000.00', second: '2000.00' });
  Object.assign(payload.lines[2], { first: '2.1250', second: '800.00' });
  Object.assign(payload.lines[3], { disposition: 'NOT_APPLICABLE', basis: 'Voluntary resignation: no verified contract, CBA or established policy granting separation pay.' });
  Object.assign(payload.lines[4], { first: '100.10' });
  Object.assign(payload.lines[5], { first: '300.05', basis: 'Lawful deductions itemized and final tax/statutory settlement externally reviewed; no payroll deductions duplicated.' });
  return payload;
}
function domainChecks() {
  const calculated = domain.calculateFinalPay(reviewedPayload());
  assert.equal(calculated.net, '19500.05'); assert.equal(calculated.lines[2].amount, '1700.00');
  assert.equal(domain.calculateFinalPay(domain.emptyFinalPayPayload()).net, null);
  const missing = reviewedPayload(); missing.lines[0].first = '';
  assert.throws(() => domain.calculateFinalPay(missing));
  const overpaid = reviewedPayload(); overpaid.lines[1].second = '10000.01';
  assert.throws(() => domain.calculateFinalPay(overpaid));
  const negative = reviewedPayload(); negative.lines[5].first = '999999.99';
  assert.equal(domain.calculateFinalPay(negative).net, null);
  const duplicate = reviewedPayload(); duplicate.lines[1].kind = 'SALARY';
  assert(!domain.finalPayPayloadSchema.safeParse(duplicate).success);
  assert.equal(domain.finalPayDeadline('2028-02-01', 30, '2028-03-03').dueDate, '2028-03-02');
  assert.equal(domain.finalPayDeadline('2030-03-01', 15, '2030-03-17').status, 'OVERDUE');
  assert(!domain.finalPayDeadlinePolicySchema.safeParse({ days: 31, basis: 'Cannot extend statutory period' }).success);
  ok(true, 'Decimal calculations, 4-decimal leave days, missing inputs, overpayments, negative totals and calendar deadlines are validated without zero assumptions');
}
async function focused(tx) {
  const marker = 'final-pay-' + Date.now();
  const org = await tx.organization.create({ data: { name: 'Final Pay Company', slug: marker, timeZone: 'Asia/Manila' } });
  const foreign = await tx.organization.create({ data: { name: 'Foreign Final Pay', slug: marker + '-foreign' } });
  const user = (organizationId, role, suffix) => tx.user.create({ data: { organizationId, role, name: role, email: `${marker}-${suffix}@fixture.invalid` } });
  const hr = await user(org.id, 'HR_ADMIN', 'hr'), admin = await user(org.id, 'ORGANIZATION_ADMIN', 'admin'), manager = await user(org.id, 'HIRING_MANAGER', 'manager'), foreignHr = await user(foreign.id, 'HR_ADMIN', 'foreign');
  const actor = user => ({ userId: user.id, organizationId: user.organizationId, role: user.role });
  context = actor(hr);
  let now = new Date('2030-03-01T02:00:00Z');
  const service = createSeparationService(activeDb, async () => context, () => now);
  await service.saveFinalPayDeadlinePolicy({ days: 15, basis: 'Company policy: release within 15 calendar days' });
  await denied(() => service.saveFinalPayDeadlinePolicy({ days: 30, basis: 'Cannot extend favorable policy' }), 'INVALID_INPUT');
  await denied(() => service.saveFinalPayDeadlinePolicy({ days: 31, basis: 'Invalid extension' }), 'INVALID_INPUT');
  assert.equal((await tx.organization.findUniqueOrThrow({ where: { id: foreign.id } })).finalPayPolicy, null);
  const saga = await tx.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
  assert.equal((await service.getFinalPayPolicySettings()).policy.days, 15);
  ok(true, 'Favorable organization deadlines are tenant-scoped, validated and audited without changing SAGA policies');
  async function employee() {
    const suffix = ++sequence;
    const job = await tx.job.create({ data: { organizationId: org.id, title: 'Fixture', slug: marker + suffix, department: 'Fixture', employmentType: 'Full-time', location: 'Fixture', description: 'Fixture', responsibilities: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture' } });
    const applicant = await tx.applicant.create({ data: { firstName: 'FinalPay', lastName: String(suffix), email: `${marker}-${suffix}@fixture.invalid`, phone: '0' } });
    const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'Preserve hiring' } });
    const employee = await tx.employee.create({ data: { organizationId: org.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `${marker}-${suffix}`, firstName: 'FinalPay', lastName: String(suffix), email: applicant.email, phone: '0', createdById: hr.id } });
    const employment = await tx.employmentRecord.create({ data: { employeeId: employee.id, jobId: job.id, jobTitle: job.title, department: job.department, employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: date('2029-01-01'), startDate: date('2029-01-01'), salary: 30000, payFrequency: 'MONTHLY', effectiveFrom: date('2029-01-01'), createdById: hr.id } });
    const login = await user(org.id, 'EMPLOYEE', 'employee-' + suffix);
    const account = await tx.employeeAccount.create({ data: { organizationId: org.id, employeeId: employee.id, userId: login.id, status: 'ACTIVE', activatedAt: new Date(), createdById: hr.id } });
    const compensation = await tx.employeeCompensation.create({ data: { organizationId: org.id, employeeId: employee.id, compensationType: 'MONTHLY', baseRate: '30000', payFrequency: 'MONTHLY', currency: 'PHP', effectiveFrom: date('2029-01-01') } });
    const period = await tx.payrollPeriod.create({ data: { organizationId: org.id, name: marker + suffix, periodStart: date('2030-02-01'), periodEnd: date('2030-02-28'), payDate: date('2030-03-01') } });
    const payroll = await tx.payrollEntry.create({ data: { organizationId: org.id, employeeId: employee.id, payrollPeriodId: period.id, employeeCompensationId: compensation.id, baseAmount: 30000, grossAmount: 30000, totalDeductions: 1000, netAmount: 29000 } });
    await tx.dailyAttendanceRecord.create({ data: { organizationId: org.id, employeeId: employee.id, employmentRecordId: employment.id, attendanceDate: date('2030-02-28'), timeZoneSnapshot: 'Asia/Manila', attendanceStatus: 'PRESENT', workedSeconds: 28800, finalizedAt: now, lastCalculatedAt: now } });
    const leaveType = await tx.leaveType.create({ data: { organizationId: org.id, code: 'FP' + suffix, name: 'Fixture leave', countingMode: 'CALENDAR_DAYS', balanceTracked: true, policyReference: 'Conversion requires explicit review' } });
    await tx.leaveLedgerEntry.create({ data: { organizationId: org.id, employeeId: employee.id, leaveTypeId: leaveType.id, entryType: 'GRANT', amountUnits: '2.1250', reason: 'Fixture recorded balance', actorUserId: hr.id } });
    return { ...employee, login, payroll, account };
  }
  async function exit(person, type = 'OTHER') {
    const details = { separationType: type, reason: type === 'TERMINATION' ? 'Verified specific termination ground; legal review on file' : 'Reviewed separation grounds', proposedLastWorkingDay: '2030-02-28', proposedEffectiveDate: '2030-03-01' };
    let found = await service.createSeparationCase({ ...details, employeeId: person.id, requestKey: `${marker}-${++sequence}` });
    found = await service.updateSeparationCase({ ...caseVersion(found), details, status: 'IN_PROGRESS' });
    for (const item of found.clearanceItems) found = await service.recordClearanceDecision({ ...caseVersion(found), itemId: item.id, status: 'CLEARED', verified: true });
    if (type === 'TERMINATION') for (const kind of ['TERMINATION_ADMIN_REVIEW', 'TERMINATION_DOCUMENTATION', 'TERMINATION_DUE_PROCESS']) found = await service.recordSeparationReview({ ...caseVersion(found), kind, evidence: 'Actual documentary review verified', verified: true });
    found = await service.markReadyForFinalReview(caseVersion(found));
    return service.approveSeparationCase({ ...caseVersion(found), decision: 'APPROVE_SEPARATION', remarks: 'Separation approved independently of final pay' });
  }
  const person = await employee();
  let separation = await exit(person);
  let record = await service.createFinalPay(separation.id);
  assert.equal((await service.createFinalPay(separation.id)).id, record.id);
  assert.equal((await service.getFinalPayManagement(separation.id)).calculation.net, null);
  await denied(() => service.reviewFinalPay({ ...version(record), confirmed: true }), 'NOT_READY');
  record = await service.saveFinalPayDraft({ ...version(record), payload: reviewedPayload(), deadlineDays: 15, deadlineBasis: 'Company policy: 15 days' });
  await denied(() => service.saveFinalPayDraft({ ...version(record), expectedVersion: 0, payload: reviewedPayload(), deadlineDays: 15, deadlineBasis: 'Stale' }), 'CONFLICT');
  await denied(() => service.saveFinalPayDraft({ ...version(record), payload: reviewedPayload(), deadlineDays: 30, deadlineBasis: 'Cannot extend' }), 'INVALID_INPUT');
  record = await service.reviewFinalPay({ ...version(record), confirmed: true });
  assert.equal(record.netAmount, '19500.05');
  const source = record.sourceSnapshot;
  assert(source.payroll.length && source.compensation.length && source.attendance._count.id && source.balances.length);
  await denied(() => service.approveFinalPay({ ...version(record), decision: 'APPROVE_FINAL_PAY', remarks: 'Not separated yet' }), 'INVALID_STATE');
  separation = await service.executeSeparation({ ...caseVersion(separation), remarks: 'Execute without waiting for payment' });
  assert.equal(separation.status, 'COMPLETED');
  assert.equal((await tx.employeeAccount.findUniqueOrThrow({ where: { id: person.account.id } })).status, 'DISABLED');
  assert.equal((await tx.employeeFinalPay.findUniqueOrThrow({ where: { id: record.id } })).status, 'REVIEWED');
  await denied(() => service.approveFinalPay({ ...version(record), decision: 'APPROVE_FINAL_PAY', remarks: 'Review before employment closure is stale' }), 'NOT_READY');
  record = await service.reviewFinalPay({ ...version(record), confirmed: true });
  await tx.payrollEntry.update({ where: { id: person.payroll.id }, data: { grossAmount: '30001.00' } });
  await denied(() => service.approveFinalPay({ ...version(record), decision: 'APPROVE_FINAL_PAY', remarks: 'Stale payroll evidence' }), 'NOT_READY');
  record = await service.reviewFinalPay({ ...version(record), confirmed: true });
  record = await service.approveFinalPay({ ...version(record), decision: 'APPROVE_FINAL_PAY', remarks: 'Explicit HR approval of itemized lawful settlement' });
  assert.equal(record.status, 'FINALIZED');
  await denied(() => service.saveFinalPayDraft({ ...version(record), payload: reviewedPayload(), deadlineDays: 10, deadlineBasis: 'Attempt edit' }), 'INVALID_STATE');
  ok(true, 'Single final-pay draft reuses evidence, detects stale inputs, requires HR review/approval and freezes amounts while separation and ESS revocation remain independent');

  const preserved = JSON.stringify(await tx.employee.findUniqueOrThrow({ where: { id: person.id }, include: { employmentRecords: true, employeeAccount: true, statusHistory: true, leaveLedgerEntries: true, payrollEntries: true, dailyAttendanceRecords: true } }));
  const payment = { caseId: separation.id, requestKey: marker + '-payment', amount: '10000.00', paidOn: '2030-03-01', reference: marker + '-receipt1', remarks: 'Authorized actual payment evidenced by receipt', confirmed: true };
  await service.recordFinalPayPayment(payment);
  const repeated = await service.recordFinalPayPayment(payment);
  assert(repeated.id);
  let management = await service.getFinalPayManagement(separation.id);
  assert.equal(management.paymentStatus, 'PARTIALLY_PAID'); assert.equal(management.outstandingAmount, '9500.05');
  await denied(() => service.recordFinalPayPayment({ ...payment, amount: '10000.01' }), 'CONFLICT');
  await denied(() => service.recordFinalPayPayment({ ...payment, requestKey: marker + '-duplicate-reference' }), 'CONFLICT');
  await denied(() => service.recordFinalPayPayment({ ...payment, requestKey: marker + '-overpay', reference: marker + '-overpay', amount: '9500.06' }), 'INVALID_INPUT');
  await denied(() => service.recordFinalPayPayment({ ...payment, requestKey: marker + '-future', reference: marker + '-future', paidOn: '2031-01-01', amount: '1.00' }), 'INVALID_INPUT');
  now = new Date('2030-03-20T02:00:00Z');
  assert.equal((await service.getFinalPayManagement(separation.id)).deadline.status, 'OVERDUE');
  await service.recordFinalPayPayment({ ...payment, requestKey: marker + '-payment2', reference: marker + '-receipt2', amount: '9500.05', paidOn: '2030-03-20' });
  management = await service.getFinalPayManagement(separation.id);
  assert.equal(management.paymentStatus, 'PAID'); assert.equal(management.deadline.status, 'PAID_LATE');
  assert.equal((await service.getFinalPayReadiness(separation.id)).paymentStatus, 'PAID');
  await service.saveFinalPayDeadlinePolicy({ days: 10, basis: 'New more favorable organization policy' });
  assert.equal((await service.getFinalPayManagement(separation.id)).deadline.days, 15);
  assert.equal(management.record.payments.length, 2);
  assert.equal(JSON.stringify(await tx.employee.findUniqueOrThrow({ where: { id: person.id }, include: { employmentRecords: true, employeeAccount: true, statusHistory: true, leaveLedgerEntries: true, payrollEntries: true, dailyAttendanceRecords: true } })), preserved);
  ok(true, 'Append-only partial/full payments are idempotent, prevent overpayment, track overdue/paid-late deadlines and preserve employee/payroll/leave/attendance history');

  async function databaseReject(operation) {
    await assert.rejects(() => activeDb.$transaction(operation));
  }
  await databaseReject(unit => unit.employeeFinalPay.update({ where: { id: record.id }, data: { netAmount: '1.00' } }));
  await databaseReject(unit => unit.employeeFinalPayPayment.update({ where: { id: repeated.id }, data: { amount: '1.00' } }));
  const audited = await tx.employeeFinalPayAudit.findFirstOrThrow({ where: { finalPayId: record.id } });
  await databaseReject(unit => unit.employeeFinalPayAudit.delete({ where: { id: audited.id } }));
  ok(true, 'Database triggers reject edits to finalized amounts, recorded payments and immutable audit history');

  context = actor(foreignHr);
  await denied(() => service.getFinalPayManagement(separation.id), 'NOT_FOUND');
  await denied(() => service.createFinalPay(separation.id), 'NOT_FOUND');
  await denied(() => service.recordFinalPayPayment(payment), 'NOT_FOUND');
  for (const unauthorized of [admin, manager, person.login]) {
    context = actor(unauthorized);
    await denied(() => service.saveFinalPayDeadlinePolicy({ days: 10, basis: 'Unauthorized' }), 'FORBIDDEN');
    const form = new FormData(); form.set('finalPayOperation', 'create'); form.set('caseId', separation.id);
    assert((await finalPayAction({}, form)).error);
  }
  context = { ...actor(hr), organizationId: foreign.id };
  await denied(() => service.getFinalPayManagement(separation.id), 'FORBIDDEN');
  context = actor(hr);
  const zero = reviewedPayload();
  for (const line of zero.lines) Object.assign(line, { disposition: 'NOT_APPLICABLE', first: '', second: '', basis: 'Explicit eligibility / prior-settlement review with evidence for this component' });
  const another = await employee(); now = new Date('2030-03-01T02:00:00Z');
  let terminated = await exit(another, 'TERMINATION');
  terminated = await service.executeSeparation({ ...caseVersion(terminated), remarks: 'Termination independent of settlement' });
  let terminationPay = await service.createFinalPay(terminated.id);
  assert(terminationPay.payload.lines.every(line => line.disposition === 'UNREVIEWED'));
  const terminationPayload = reviewedPayload();
  Object.assign(terminationPayload.lines[3], { disposition: 'APPLICABLE', first: '25000.00', basis: 'Specific qualifying termination ground, externally reviewed service/salary formula and legal evidence reference' });
  terminationPay = await service.saveFinalPayDraft({ ...version(terminationPay), payload: terminationPayload, deadlineDays: 10, deadlineBasis: 'More favorable individual contract: ten days' });
  terminationPay = await service.reviewFinalPay({ ...version(terminationPay), confirmed: true });
  assert.equal(terminationPay.netAmount, '44500.05');
  terminationPay = await service.saveFinalPayDraft({ ...version(terminationPay), payload: zero, deadlineDays: 10, deadlineBasis: 'Individual contract' });
  terminationPay = await service.reviewFinalPay({ ...version(terminationPay), confirmed: true });
  terminationPay = await service.approveFinalPay({ ...version(terminationPay), decision: 'APPROVE_FINAL_PAY', remarks: 'Zero due explicitly reviewed as previously settled; evidence retained' });
  assert.equal((await service.getFinalPayManagement(terminated.id)).paymentStatus, 'NO_PAYMENT_DUE');
  const cancellationPerson = await employee();
  let cancelled = await service.createSeparationCase({ employeeId: cancellationPerson.id, requestKey: marker + '-cancel', separationType: 'OTHER', reason: 'Proposed exit later cancelled', proposedLastWorkingDay: '2030-02-28', proposedEffectiveDate: '2030-03-01' });
  const cancelledPay = await service.createFinalPay(cancelled.id);
  cancelled = await service.cancelSeparationCase({ ...caseVersion(cancelled), reason: 'Exit withdrawn before separation' });
  assert.equal((await service.getFinalPayManagement(cancelled.id)).deadline.status, 'CASE_CANCELLED');
  await denied(() => service.reviewFinalPay({ ...version(cancelledPay), confirmed: true }), 'INVALID_STATE');
  await tx.user.update({ where: { id: hr.id }, data: { role: 'HIRING_MANAGER' } });
  await denied(() => service.getFinalPayPolicySettings(), 'FORBIDDEN');
  assert.deepEqual((await tx.organization.findUniqueOrThrow({ where: { id: saga.id } })).resignationPolicy, saga.resignationPolicy);
  ok(true, 'Tenant boundaries, action authorization, revoked HR roles, termination-specific reviewed separation pay and explicit zero settlements are enforced');
}
async function main() {
  domainChecks();
  const before = await helper.fingerprints(db);
  try { await db.$transaction(async tx => { activeDb = client(tx); await focused(tx); throw rollback; }, { timeout: 600000, maxWait: 10000 }); }
  catch (error) { if (error !== rollback) throw error; }
  assert.deepEqual((await helper.fingerprints(db, before.columns)).tables, before.tables);
  helper.assertOriginalUnchanged(config);
  ok(true, 'All fixture changes rolled back and every pre-existing table fingerprint and original environment file remained unchanged');
  fs.mkdirSync('docs/final-pay', { recursive: true });
  fs.writeFileSync('docs/final-pay/tests.json', JSON.stringify({ passed: true, scenarios, tablesPreserved: before.tables.length, realConcurrentCommits: false, fixtures: 'single outer rollback transaction, nested serialized savepoints' }, null, 2));
}
main().catch(error => { console.error(error.code || error.name, String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]'), error.stack?.split('\n').filter(line => line.includes('scripts\\') || line.includes('scripts/'))); process.exitCode = 1; }).finally(async () => { Module._load = original; await db.$disconnect(); });
