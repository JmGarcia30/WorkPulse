/* eslint-disable @typescript-eslint/no-require-imports -- Verified recovery fixtures with mandatory rollback. */
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs'), config = helper.configuration();
const verification = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verification.identity.branchId || config.identity.endpointSha256 !== verification.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
let activeDb, context, sequence = 0;
require('tsx/cjs');
const original = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'server-only') return {};
  if (name === '@/lib/db/prisma' || name === '../src/lib/db/prisma') return { prisma: new Proxy({}, { get: (_, key) => activeDb[key] }) };
  if (name === '@/lib/auth/guards') return { requireBackOfficeContext: async () => context };
  if (name === '@/lib/auth/session') return { getSession: async () => context };
  if (name === 'next/cache') return { revalidatePath: () => {} };
  return original.call(this, name, parent, main);
};
const policies = require('../src/features/employees/probation-policy.ts');
const { saveOrganizationProbationPolicy } = require('../src/features/employees/probation-policy-actions.ts');
const { createOfferAction } = require('../src/features/hiring/offer-actions.ts');
const { convertApplicationToEmployee } = require('../src/features/employees/conversion.ts');
const lifecycle = require('../src/features/employees/lifecycle.ts');
const scenarios = [], rollback = Symbol('probation-rollback');
const ok = (value, label) => { assert(value, label); scenarios.push(label); console.log('PASS ' + label); };
const date = value => new Date(value + 'T00:00:00Z');
function client(tx) {
  let queue = Promise.resolve();
  return new Proxy(tx, { get(target, key) {
    if (key === '$transaction') return operation => {
      const work = async () => {
        const name = 'probation_' + (++sequence);
        await tx.$executeRawUnsafe('SAVEPOINT ' + name);
        try { const result = await operation(activeDb); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
        catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); throw error; }
      };
      const result = queue.then(work, work); queue = result.catch(() => {}); return result;
    };
    return Reflect.get(target, key);
  } });
}
async function regression(mode, tx) {
  // The existing suites predate tenant policy isolation and are SAGA fixtures.
  // Reserve the unique SAGA slug only inside this rollback transaction.
  await tx.organization.updateMany({ where: { slug: 'st-aloysius' }, data: { slug: `probation-original-saga-${Date.now()}` } });
  const file = path.resolve(`scripts/test-${mode === 'h1' ? 'h1-employee-core' : 'h2-employment-probation'}.ts`);
  let source = fs.readFileSync(file, 'utf8');
  if (mode === 'h1') source = source.replace(/  const staleOrganizations = [\s\S]*?\n  const marker =/, '  const marker =');
  source = source.replace('slug: marker', "slug: 'st-aloysius'");
  const cleanup = source.lastIndexOf('  } finally {');
  if (cleanup < 0) throw Error('REGRESSION_CLEANUP_BOUNDARY_CHANGED');
  source = source.slice(0, cleanup) + '  } finally { /* Outer rollback owns fixture cleanup. */ }\n}\nmodule.exports = main;';
  const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(require('typescript').transpileModule(source, { compilerOptions: { target: 9, module: 1, esModuleInterop: true } }).outputText, file);
  await mod.exports();
  ok(true, mode.toUpperCase() + ' existing regression assertions pass with explicit SAGA identity');
}
async function focused(tx) {
  const marker = 'probation-' + Date.now();
  const saga = await tx.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
  const b = await tx.organization.create({ data: { name: 'SAGA', slug: marker, hiringDocumentRequirements: { TEACHING: [], NON_TEACHING: [] } } });
  const hr = await tx.user.create({ data: { organizationId: b.id, name: 'Company B HR', email: marker + '@fixture.invalid', role: 'HR_ADMIN' } });
  const sagaHr = await tx.user.create({ data: { organizationId: saga.id, name: 'Saga HR fixture', email: marker + '-saga@fixture.invalid', role: 'HR_ADMIN' } });
  const actor = (org, user) => ({ userId: user.id, organizationId: org.id, role: 'HR_ADMIN', name: user.name, email: user.email });
  context = actor(b, hr);
  const category = { durationMonths: 3, evaluationRequired: true, evaluationCriteria: 'Accuracy, attendance and documented job performance standards', maxRenewals: 1, renewalMonths: 2 };
  const configuration = { TEACHING: category, NON_TEACHING: category };
  assert.throws(() => policies.resolveOfferProbationPolicy(b, 'TEACHING'));
  for (const invalid of [{ durationMonths: 7 }, { durationMonths: 6 }, { maxRenewals: 3 }, { evaluationCriteria: '' }, { renewalMonths: 0 }]) assert(!policies.organizationProbationPolicySchema.safeParse({ ...configuration, TEACHING: { ...category, ...invalid } }).success);
  ok(true, 'Unconfigured companies cannot issue guessed terms; durations, renewal totals and evaluation standards are validated');
  assert((await saveOrganizationProbationPolicy({ ...configuration, organizationId: saga.id })).success);
  ok((await tx.organization.findUniqueOrThrow({ where: { id: b.id } })).probationPolicy.TEACHING.durationMonths === 3, 'Company B saves its own policy; forged tenant ID and SAGA display name cannot select SAGA');
  context = actor(saga, sagaHr);
  assert('error' in await saveOrganizationProbationPolicy(configuration));
  assert.equal(policies.resolveOfferProbationPolicy(saga, 'TEACHING').maxRenewals, 2);
  assert.equal(policies.resolveOfferProbationPolicy(saga, 'NON_TEACHING').durationMonths, 6);
  ok(true, 'SAGA settings reject generic edits and retain school-year/two-renewal and six-month/no-renewal policies');
  context = actor(b, hr);
  let suffix = 0;
  async function candidate(employmentCategory = 'TEACHING') {
    const code = marker + '-' + (++suffix);
    const job = await tx.job.create({ data: { organizationId: b.id, title: 'Fixture', slug: code, department: 'Fixture', employmentType: 'Full-time', location: 'Fixture', description: 'Fixture', responsibilities: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture', category: employmentCategory } });
    const applicant = await tx.applicant.create({ data: { firstName: 'Probation', lastName: 'Fixture', email: code + '@fixture.invalid', phone: '0' } });
    const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, coverLetter: 'Fixture', status: 'OFFER' } });
    return application;
  }
  const application = await candidate();
  context = actor(saga, sagaHr);
  assert('error' in await createOfferAction({ applicationId: application.id, salary: 35000, employmentType: 'Full-time', startDate: '2030-01-01' }));
  context = actor(b, hr);
  const created = await createOfferAction({ applicationId: application.id, salary: 35000, employmentType: 'Full-time', startDate: '2030-01-01' });
  assert(created.success);
  const offer = await tx.offer.findUniqueOrThrow({ where: { id: created.offerId } });
  ok(offer.probationPeriodMonths === 3 && offer.probationPolicySnapshot.regime === 'PH_GENERAL' && offer.probationaryTerms.includes(category.evaluationCriteria), 'Offer creation captures Company B terms and standards; foreign offer access is denied');
  await tx.offer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED', contractSignedByPresident: true, contractSignedByEmployee: true, contractExecutedAt: date('2029-12-01') } });
  await tx.onboardingProcess.create({ data: { applicationId: application.id, startDate: date('2030-01-01'), status: 'COMPLETED', completedAt: date('2029-12-02') } });
  const updated = { durationMonths: 6, maxRenewals: 0, renewalMonths: 0, evaluationRequired: false, evaluationCriteria: 'New offer standards must not replace an agreed contract' };
  assert((await saveOrganizationProbationPolicy({ TEACHING: updated, NON_TEACHING: updated })).success);
  await assert.rejects(convertApplicationToEmployee({ applicationId: application.id, organizationId: b.id, actorUserId: hr.id }), error => error.code === 'INVALID_PROBATION_DATE');
  const converted = await convertApplicationToEmployee({ applicationId: application.id, organizationId: b.id, actorUserId: hr.id, probationStandardsConfirmed: true });
  const initial = await tx.probationRecord.findFirstOrThrow({ where: { employeeId: converted.employeeId } });
  ok(initial.expectedEndAt.toISOString().startsWith('2030-04-01') && initial.maxRenewals === 1 && JSON.parse(initial.policySnapshot).evaluationRequired, 'Teaching conversion uses the agreed three-month snapshot despite later settings changes; engagement confirmation is required');
  assert((await convertApplicationToEmployee({ applicationId: application.id, organizationId: b.id, actorUserId: hr.id })).idempotent);
  await assert.rejects(convertApplicationToEmployee({ applicationId: application.id, organizationId: saga.id, actorUserId: sagaHr.id }));
  ok(true, 'Conversion remains idempotent and tenant isolated');
  const base = { employeeId: converted.employeeId, organizationId: b.id, actorUserId: hr.id, confirmed: true, decisionAt: date('2030-04-01'), remarks: 'Evaluation completed against the agreed accuracy and attendance standards' };
  await assert.rejects(lifecycle.regularizeEmployee({ ...base, regularizationEffectiveAt: date('2030-04-01') }), error => error.code === 'EVALUATION_REQUIRED');
  const renewal = { ...base, nextSchoolYearStartDate: date('2030-04-02'), nextSchoolYearEndDate: date('2030-06-01'), evaluationConfirmed: true, legalReviewConfirmed: true };
  await assert.rejects(lifecycle.renewTeachingProbation(renewal), error => error.code === 'CONFIRMATION_REQUIRED');
  await assert.rejects(lifecycle.renewTeachingProbation({ ...renewal, renewalConsentConfirmed: true, nextSchoolYearEndDate: date('2030-08-01') }), error => error.code === 'INVALID_PERIOD' || error.code === 'MAX_RENEWALS_REACHED');
  await assert.rejects(lifecycle.doNotRenewEmployee({ ...base, evaluationConfirmed: true, legalReviewConfirmed: true, decisionAt: date('2030-04-02'), nonRenewalEffectiveAt: date('2030-04-01') }), error => error.code === 'LEGAL_REVIEW_REQUIRED');
  ok(true, 'Evaluation, written consent, agreed renewal length and statutory timing guards reject unsafe decisions');
  const renewed = await lifecycle.renewTeachingProbation({ ...renewal, renewalConsentConfirmed: true });
  const next = await tx.probationRecord.findUniqueOrThrow({ where: { id: renewed.probationRecordId } });
  assert.equal(next.policySnapshot, initial.policySnapshot);
  assert.equal((await tx.probationRecord.findUniqueOrThrow({ where: { id: initial.id } })).expectedEndAt.toISOString(), initial.expectedEndAt.toISOString());
  ok(next.renewalCount === 1, 'Permitted renewal carries the original snapshot and preserves the historical period');
  await assert.rejects(lifecycle.renewTeachingProbation({ ...renewal, renewalConsentConfirmed: true, decisionAt: date('2030-06-01'), nextSchoolYearStartDate: date('2030-06-02'), nextSchoolYearEndDate: date('2030-08-01') }), error => error.code === 'MAX_RENEWALS_REACHED');
  await assert.rejects(lifecycle.regularizeEmployee({ ...base, organizationId: saga.id, actorUserId: sagaHr.id, evaluationConfirmed: true, decisionAt: date('2030-06-01'), regularizationEffectiveAt: date('2030-06-01') }), error => error.code === 'EMPLOYEE_NOT_FOUND');
  await lifecycle.regularizeEmployee({ ...base, evaluationConfirmed: true, decisionAt: date('2030-06-01'), regularizationEffectiveAt: date('2030-06-01') });
  ok((await tx.employmentRecord.findFirstOrThrow({ where: { employeeId: converted.employeeId, effectiveTo: null } })).employmentStatus === 'REGULAR', 'Renewal limits and wrong-tenant decisions are enforced; Company B Teaching regularization succeeds');
  assert.equal((await tx.offer.findUniqueOrThrow({ where: { id: offer.id } })).probationaryTerms, offer.probationaryTerms);
  context = { ...context, role: 'HIRING_MANAGER' };
  assert('error' in await saveOrganizationProbationPolicy(configuration));
  context = actor(b, hr);
  await tx.user.update({ where: { id: hr.id }, data: { role: 'EMPLOYEE' } });
  assert('error' in await saveOrganizationProbationPolicy(configuration));
  const renewedHistory = await tx.employmentDecisionHistory.findUniqueOrThrow({ where: { probationRecordId: initial.id } });
  assert(renewedHistory.newState.evaluationConfirmed && renewedHistory.newState.legalReviewConfirmed && renewedHistory.newState.renewalConsentConfirmed);
  ok(true, 'Historical offer terms remain unchanged; evaluation audit and current-role revocation are enforced');
}
async function main() {
  const migrations = await db.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE migration_name='20261022000200_organization_probation_policy' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  assert.equal(migrations.length, 1);
  const before = await helper.fingerprints(db);
  const mode = process.argv[2] ?? 'focused';
  try {
    await db.$transaction(async tx => { activeDb = client(tx); if (mode === 'focused') await focused(tx); else if (['h1', 'h2'].includes(mode)) await regression(mode, tx); else throw Error('UNKNOWN_TEST_MODE'); throw rollback; }, { timeout: 600000, maxWait: 10000 });
  } catch (error) { if (error !== rollback) throw error; }
  assert.deepEqual((await helper.fingerprints(db, before.columns)).tables, before.tables);
  helper.assertOriginalUnchanged(config);
  ok(true, 'Rollback confirmed; all pre-existing database records and policy snapshots are unchanged');
  fs.mkdirSync('docs/probation-policy', { recursive: true });
  fs.writeFileSync(`docs/probation-policy/${mode}.json`, JSON.stringify({ passed: true, branchId: config.identity.branchId, scenarios, tablesPreserved: before.tables.length, concurrency: mode === 'focused' ? 'not independently committed' : 'transaction fixtures serialized; no independent-commit concurrency claim' }, null, 2));
}
main().catch(error => { console.error(error.code || error.name, error.message?.startsWith('ASSERTION FAILED:') ? error.message : '', error.stack?.split('\n').filter(line => line.includes('scripts\\') || line.includes('scripts/'))); process.exitCode = 1; }).finally(async () => { Module._load = original; await db.$disconnect(); });
