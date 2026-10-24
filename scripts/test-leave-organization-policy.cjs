/* eslint-disable @typescript-eslint/no-require-imports -- Focused recovery-only rollback integration. */
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.endpointSha256 !== verified.identity.endpointSha256 || config.identity.branchId !== verified.identity.branchId) throw Error('UNVERIFIED_RECOVERY');
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
const { configureSagaLeavePolicy, SAGA_LEAVE_TYPES } = require('../src/features/leave/saga-policy.ts');
const actions = require('../src/features/leave/hr-actions.ts');
const service = require('../src/features/leave/service.ts');
const { getEmployeeLeaveOverviewData } = require('../src/features/leave/read-model.ts');
const { renderToStaticMarkup } = require('react-dom/server');
const SettingsPage = require('../src/app/(dashboard)/dashboard/leave/settings/page.tsx').default;
const scenarios = [];
const ok = (value, label) => { assert(value, label); scenarios.push(label); console.log('PASS ' + label); };
const rollback = Symbol('rollback');
const day = value => new Date(value + 'T00:00:00Z');
const marker = 'leave-policy-' + Date.now();
function client(tx) {
  return new Proxy(tx, { get(target, key) {
    if (key === '$transaction') return async operation => {
      const savepoint = 'leave_policy_' + (++sequence);
      await tx.$executeRawUnsafe('SAVEPOINT ' + savepoint);
      try { const result = await operation(activeDb); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + savepoint); return result; }
      catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + savepoint); throw error; }
    };
    return Reflect.get(target, key);
  } });
}
async function main() {
  const live = await db.$queryRaw`SELECT current_database() AS database,current_schema() AS schema`;
  assert.equal(live[0].database, config.identity.database); assert.equal(live[0].schema, 'public');
  const columns = await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'Leave%' ORDER BY table_name,ordinal_position`;
  const before = await helper.fingerprints(db, columns);
  // Compare every SAGA definition to the committed source, not to a copied test list.
  const baseline = execFileSync('git', ['show', 'HEAD:src/features/leave/saga-policy.ts'], { encoding: 'utf8' });
  const baselineModule = new Module(require.resolve('../src/features/leave/saga-policy.ts'), module);
  baselineModule.filename = require.resolve('../src/features/leave/saga-policy.ts'); baselineModule.paths = module.paths;
  baselineModule._compile(require('typescript').transpileModule(baseline, { compilerOptions: { module: 1, target: 9 } }).outputText, baselineModule.filename);
  assert.deepEqual(JSON.parse(JSON.stringify(SAGA_LEAVE_TYPES)), JSON.parse(JSON.stringify(baselineModule.exports.SAGA_LEAVE_TYPES)));
  ok(true, 'All six SAGA definitions, entitlements and eligibility rules match the committed baseline');
  try {
    await db.$transaction(async tx => {
      activeDb = client(tx);
      const saga = await tx.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
      const b = await tx.organization.create({ data: { name: 'SAGA', slug: marker, timeZone: 'Asia/Manila' } });
      const hr = await tx.user.create({ data: { organizationId: b.id, name: 'Company B HR', email: marker + '@fixture.invalid', role: 'HR_ADMIN' } });
      const sagaHr = await tx.user.create({ data: { organizationId: saga.id, name: 'SAGA fixture HR', email: marker + '-saga@fixture.invalid', role: 'HR_ADMIN' } });
      const actor = (organization, user) => ({ userId: user.id, organizationId: organization.id, role: 'HR_ADMIN', name: user.name, email: user.email });
      context = actor(b, hr);
      ok('error' in await actions.configureSagaLeavePolicyAction(2097, true), 'Company B cannot invoke the SAGA preset even with a SAGA display name');
      await assert.rejects(configureSagaLeavePolicy({ organizationId: saga.id, actorUserId: hr.id, year: 2097 }), error => error.code === 'FORBIDDEN');
      ok(true, 'Preset service rejects a foreign-tenant actor');
      const input = { code: 'SICK_PERSONAL', name: 'Company B Flex Leave', isPaid: true, countingMode: 'CALENDAR_DAYS', balanceTracked: true, defaultGrantUnits: 12, policyReference: 'Company B handbook', allowsRetrospectiveFiling: true };
      const created = await actions.createLeaveTypeAction({ ...input, organizationId: saga.id });
      assert(created.success);
      const type = await tx.leaveType.findUniqueOrThrow({ where: { id: created.id } });
      ok(type.organizationId === b.id && type.defaultGrantUnits.equals(12) && type.requiredEmploymentStatus === null && type.minimumServiceMonths === null && !type.requiresEligibilityVerification, 'Company B type uses its own twelve-unit policy and neutral eligibility; forged tenant is ignored');
      for (const invalid of [{ defaultGrantUnits: -1 }, { defaultGrantUnits: Infinity }, { defaultGrantUnits: 1.00001 }, { name: ' ' }, { minimumServiceMonths: -1 }, { countingMode: 'FORGED' }, { balanceTracked: false }]) assert('error' in await actions.createLeaveTypeAction({ ...input, ...invalid }));
      ok(true, 'Invalid amounts, precision, required fields, eligibility and counting mode are rejected');
      const cycleInput = { leaveTypeId: type.id, code: '2097', name: '2097', startDate: '2097-01-01', endDate: '2097-12-31' };
      assert('error' in await actions.createLeaveCycleAction({ ...cycleInput, startDate: '2097-02-30' }));
      assert('error' in await actions.createLeaveCycleAction({ ...cycleInput, endDate: '2096-12-31' }));
      assert((await actions.createLeaveCycleAction(cycleInput)).success);
      const cycle = await tx.leaveCycle.findFirstOrThrow({ where: { organizationId: b.id, leaveTypeId: type.id } });
      ok(true, 'Company B creates its own cycle; invalid dates and reversed ranges are rejected');
      context = actor(saga, sagaHr);
      assert('error' in await actions.createLeaveCycleAction({ ...cycleInput, code: 'FOREIGN' }));
      assert('error' in await actions.updateLeaveDefaultEntitlementAction({ leaveTypeId: type.id, defaultGrantUnits: 99 }));
      assert('error' in await actions.deactivateLeaveTypeAction(type.id, true));
      ok((await tx.leaveType.findUniqueOrThrow({ where: { id: type.id } })).isActive, 'Foreign tenant cannot create cycles, edit defaults or deactivate Company B types');
      await configureSagaLeavePolicy({ organizationId: saga.id, actorUserId: sagaHr.id, year: 2097 });
      const sagaSick = await tx.leaveType.findUniqueOrThrow({ where: { organizationId_code: { organizationId: saga.id, code: 'SICK_PERSONAL' } } });
      assert(sagaSick.defaultGrantUnits.equals(5));
      assert('error' in await actions.updateLeaveDefaultEntitlementAction({ leaveTypeId: sagaSick.id, defaultGrantUnits: 99 }));
      ok(true, 'Actual SAGA preset retains five-day entitlement and generic editor cannot overwrite it');
      ok(renderToStaticMarkup(await SettingsPage()).includes('Configure Current Year'), 'Actual SAGA settings render its preset');
      context = actor(b, hr);
      ok(!renderToStaticMarkup(await SettingsPage()).includes('Configure Current Year'), 'Company B settings hide the preset despite matching SAGA display name');
      const job = await tx.job.create({ data: { organizationId: b.id, title: 'Fixture', slug: marker, department: 'Fixture', employmentType: 'Full-time', location: 'Fixture', description: 'Fixture', responsibilities: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture' } });
      const applicant = await tx.applicant.create({ data: { firstName: 'Leave', lastName: 'Fixture', email: marker + '-employee@fixture.invalid', phone: '0' } });
      const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'Fixture' } });
      const employee = await tx.employee.create({ data: { organizationId: b.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: marker, firstName: 'Leave', lastName: 'Fixture', email: applicant.email, phone: '0', employeeStatus: 'ACTIVE', createdById: hr.id } });
      await tx.employmentRecord.create({ data: { employeeId: employee.id, jobId: job.id, jobTitle: job.title, department: 'Fixture', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: day('2097-01-01'), startDate: day('2097-01-01'), salary: 1, payFrequency: 'MONTHLY', employmentStatus: 'PROBATIONARY', effectiveFrom: day('2097-01-01'), createdById: hr.id } });
      // Even a regular employee must not receive SAGA's code-based projection.
      await tx.employmentRecord.updateMany({ where: { employeeId: employee.id }, data: { employmentStatus: 'REGULAR', effectiveFrom: day('2015-01-01') } });
      const overview = await getEmployeeLeaveOverviewData(tx, b.id, employee.id);
      ok(overview.balances.every(balance => balance.annualEntitlement === 0 && balance.remaining === 0), 'Company B SICK_PERSONAL code does not project a SAGA entitlement');
      await tx.employmentRecord.updateMany({ where: { employeeId: employee.id }, data: { employmentStatus: 'PROBATIONARY' } });
      const ungranted = await service.submitLeaveRequest({ organizationId: b.id, employeeId: employee.id, actorUserId: hr.id, leaveTypeId: type.id, from: '2097-02-01', to: '2097-02-01', reason: 'No implicit entitlement' }, tx);
      await assert.rejects(service.reviewLeaveRequest({ organizationId: b.id, actorUserId: hr.id, requestId: ungranted.id, decision: 'APPROVE', remarks: 'Not yet granted' }, tx), error => error.code === 'INSUFFICIENT_BALANCE');
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employee.id } }) === 0, 'Company B approval cannot silently initialize SAGA code-based grants');
      await service.reviewLeaveRequest({ organizationId: b.id, actorUserId: hr.id, requestId: ungranted.id, decision: 'REJECT', remarks: 'Grant separately' }, tx);
      const grant = { leaveTypeId: type.id, leaveCycleId: cycle.id, employeeIds: [employee.id], reason: 'Company B annual grant', confirmed: true };
      const foreignGrant = await actions.grantCycleEntitlementsAction({ ...grant, employeeIds: [employee.id], organizationId: saga.id, actorUserId: sagaHr.id });
      ok(foreignGrant.outcomes[0].status === 'GRANTED', 'Grant action uses authenticated Company B scope despite forged actor/tenant fields');
      assert((await actions.updateLeaveDefaultEntitlementAction({ leaveTypeId: type.id, defaultGrantUnits: 15 })).success);
      const repeated = await actions.grantCycleEntitlementsAction(grant);
      ok(repeated.outcomes[0].status === 'SKIPPED_DUPLICATE' && (await tx.leaveLedgerEntry.findFirstOrThrow({ where: { employeeId: employee.id, entryType: 'GRANT' } })).amountUnits.equals(12), 'Default changes preserve existing grants; repeated grant does not replace or duplicate them');
      const requestInput = { organizationId: b.id, employeeId: employee.id, actorUserId: hr.id, leaveTypeId: type.id, from: '2097-03-01', to: '2097-03-02', reason: 'Company B policy request' };
      const submitted = await service.submitLeaveRequest(requestInput, tx);
      await service.reviewLeaveRequest({ organizationId: b.id, actorUserId: hr.id, requestId: submitted.id, decision: 'APPROVE', remarks: 'Approved' }, tx);
      const approved = await tx.leaveRequest.findUniqueOrThrow({ where: { id: submitted.id } });
      const ledger = await tx.leaveLedgerEntry.aggregate({ where: { employeeId: employee.id, leaveTypeId: type.id }, _sum: { amountUnits: true } });
      ok(approved.status === 'APPROVED' && approved.requestedUnits.equals(2) && ledger._sum.amountUnits.equals(10), 'Probationary Company B employee approval charges two calendar days against its own twelve-unit grant');
      assert((await actions.updateLeaveDefaultEntitlementAction({ leaveTypeId: type.id, defaultGrantUnits: 20 })).success);
      assert.deepEqual(await tx.leaveRequest.findUniqueOrThrow({ where: { id: submitted.id } }), approved);
      ok(true, 'Editing the default never rewrites approved requests or their policy snapshots');
      const maternity = await actions.createLeaveTypeAction({ ...input, code: 'MATERNITY', name: 'Company B parental leave', balanceTracked: false, defaultGrantUnits: null });
      assert(maternity.success);
      const parental = await service.submitLeaveRequest({ ...requestInput, leaveTypeId: maternity.id, from: '2097-04-01', to: '2097-04-02' }, tx);
      await service.reviewLeaveRequest({ organizationId: b.id, actorUserId: hr.id, requestId: parental.id, decision: 'APPROVE', remarks: 'Company B policy satisfied' }, tx);
      ok(true, 'Company B MATERNITY code does not impose SAGA delivery-date or SSS conditions');
      const rejected = await service.submitLeaveRequest({ ...requestInput, from: '2097-05-01', to: '2097-05-01' }, tx);
      await assert.rejects(service.reviewLeaveRequest({ organizationId: saga.id, actorUserId: sagaHr.id, requestId: rejected.id, decision: 'APPROVE', remarks: 'Foreign' }, tx), error => error.code === 'ALREADY_REVIEWED');
      await service.reviewLeaveRequest({ organizationId: b.id, actorUserId: hr.id, requestId: rejected.id, decision: 'REJECT', remarks: 'Rejected' }, tx);
      ok((await tx.leaveLedgerEntry.count({ where: { leaveRequestId: rejected.id } })) === 0, 'Cross-tenant approval is denied; rejection creates no debit');
      context = { ...context, role: 'HIRING_MANAGER' };
      assert('error' in await actions.createLeaveTypeAction(input));
      assert('error' in await actions.updateLeaveDefaultEntitlementAction({ leaveTypeId: type.id, defaultGrantUnits: 99 }));
      ok(true, 'Non-HR actors cannot configure types or entitlements');
      throw rollback;
    }, { timeout: 180000, maxWait: 10000 });
  } catch (error) { if (error !== rollback) throw error; }
  const after = await helper.fingerprints(db, before.columns);
  assert.deepEqual(after.tables, before.tables);
  assert.equal(await db.organization.count({ where: { slug: marker } }), 0);
  helper.assertOriginalUnchanged(config);
  ok(true, 'All fixtures rolled back; existing Leave tables, balances and history remain byte-for-byte equivalent');
  fs.mkdirSync('docs/leave-policy', { recursive: true });
  fs.writeFileSync('docs/leave-policy/integration.json', JSON.stringify({ passed: true, branchId: config.identity.branchId, scenarios, leaveTablesPreserved: before.tables.length, productionWrites: false, migrationRequired: false }, null, 2));
}
main().catch(error => { console.error(error.code || error.name, error.stack?.split('\n').filter(line => line.includes('test-leave-organization-policy.cjs'))); process.exitCode = 1; }).finally(async () => { Module._load = original; await db.$disconnect(); });
