/* eslint-disable @typescript-eslint/no-require-imports -- Real PostgreSQL transactions; guarded synthetic fixtures only. */
const assert = require('node:assert/strict');
const Module = require('node:module');
const { context, rollbackClient, save, helper } = require('./hiring-postgres-fixtures.cjs');
require('tsx/cjs');
let active, session;
const originalLoad = Module._load;
const prisma = new Proxy({}, { get: (_, key) => typeof active[key] === 'function' ? active[key].bind(active) : active[key] });
Module._load = function (name, parent, main) {
  if (name === '@/lib/db/prisma') return { prisma };
  if (name === '@/lib/auth/session') return { getSession: async () => session };
  if (name === './document-access') return { getDocumentStaffContext: async () => session };
  if (name === 'next/cache') return { revalidatePath() {} };
  if (name === '@/lib/storage') return { localStorageProvider: { upload: () => { throw Error('NO_STORAGE_WRITES'); } } };
  return originalLoad.call(this, name, parent, main);
};
const { transitionApplicationStatus } = require('../src/features/hiring/status-transition.ts');
const { convertApplicationToEmployee } = require('../src/features/employees/conversion.ts');
const { updateOnboardingTaskStatusAction, completeOnboardingAction } = require('../src/features/hiring/onboarding-actions.ts');
const { calculateHiringReadiness, calculateHiringPrerequisites } = require('../src/features/hiring/readiness.ts');
const { getOnboardingTaskTemplates } = require('../src/features/hiring/onboarding-pipeline.ts');
const checks = [];
function ok(condition, label) { assert(condition, label); checks.push({ label, status: 'PASS' }); save('postgres-progress', { checks }); console.log('PASS ' + label); }
const input = fixture => ({ applicationId: fixture.application.id, organizationId: fixture.owner.org.id, actorUserId: fixture.actor.id, probationStandardsConfirmed: true, teachingExpectedEndAt: new Date('2027-10-31') });
const sessionFor = user => ({ userId: user.id, organizationId: user.organizationId, name: user.name, email: user.email, role: user.role });

// Force two real transactions to read the same row before either may write it.
// No savepoints or mocked database operations are used for concurrent tests.
function simultaneous(db, applicationId, options = {}) {
  let arrivals = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const timer = setTimeout(() => release(), 10000);
  return new Proxy(db, { get(target, key) {
    if (key === '$transaction') return (operation, transactionOptions) => db.$transaction(tx => operation(new Proxy(tx, { get(client, model) {
      if (model === (options.task ? 'onboardingTask' : 'application')) return new Proxy(client[model], { get(delegate, method) {
        if (method === 'findFirst') return async args => {
          const row = await delegate.findFirst(args);
          const matches = options.task ? options.task.includes(args.where.id) : args.where.id === applicationId;
          if (matches && arrivals < 2) { arrivals++; if (arrivals === 2) { clearTimeout(timer); release(); } await gate; }
          return row;
        };
        const value = delegate[method]; return typeof value === 'function' ? value.bind(delegate) : value;
      } });
      const value = client[model]; return typeof value === 'function' ? value.bind(client) : value;
    } })), { ...transactionOptions, timeout: 30000, maxWait: 15000 });
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
}

async function main() {
  const ctx = await context(); active = ctx.db;
  const before = await helper.fingerprints(ctx.db);
  save('postgres-preservation-before', { identity: ctx.identity, ...before });
  let failure;
  try {
    const rollback = Symbol('rollback synthetic integration fixtures');
    try {
      await ctx.db.$transaction(async tx => {
        active = rollbackClient(tx);
        const company = await ctx.tenant(tx);
        const saga = await ctx.tenant(tx, true);
        const foreign = await ctx.tenant(tx);
        for (const owner of [company, saga]) for (const category of ['TEACHING', 'NON_TEACHING']) {
          const fixture = await ctx.candidate(tx, owner, { category, incomplete: true });
          session = sessionFor(fixture.actor);
          const label = (fixture.policy.isSaga ? 'SAGA ' : 'custom tenant ') + category;
          const initial = await ctx.source(tx, fixture.application.id);
          ok(!calculateHiringReadiness(initial).isReadyToHire, label + ': incomplete COMPLETED checklist blocks readiness');
          await assert.rejects(convertApplicationToEmployee(input(fixture)), error => error.code === 'NOT_READY');
          ok(await tx.employee.count({ where: { sourceApplicationId: fixture.application.id } }) === 0, label + ': premature conversion creates no employee');
          const task = fixture.process.tasks.find(task => task.isRequired);
          await tx.onboardingTask.update({ where: { id: task.id }, data: { status: 'SUBMITTED' } });
          const metadata = await tx.onboardingProcess.findUniqueOrThrow({ where: { id: fixture.process.id } });
          ok((await updateOnboardingTaskStatusAction(task.id, 'VERIFIED')).success, label + ': subsequent task verification succeeds');
          let process = await tx.onboardingProcess.findUniqueOrThrow({ where: { id: fixture.process.id } });
          ok(process.status === 'COMPLETED' && process.completedAt.getTime() === metadata.completedAt.getTime() && process.notes === metadata.notes, label + ': verification preserves historical completion metadata');
          ok((await completeOnboardingAction(process.id)).error, label + ': manual completion cannot bypass missing policy items');
          ok((await updateOnboardingTaskStatusAction(task.id, 'IN_PROGRESS')).error, label + ': reopening without a reason is denied');
          ok((await updateOnboardingTaskStatusAction(task.id, 'IN_PROGRESS', 'Verify synthetic evidence again with HR')).success, label + ': explicit authorized reopening succeeds');
          process = await tx.onboardingProcess.findUniqueOrThrow({ where: { id: process.id } });
          const audit = JSON.parse(process.notes.split('[onboarding-audit] ').at(-1));
          ok(process.completedAt.getTime() === metadata.completedAt.getTime() && audit.action === 'TASK_REOPENED' && audit.actorUserId === fixture.actor.id && audit.previousVerification.status === 'VERIFIED', label + ': reopening audit retains original completion and verification');
          const missing = getOnboardingTaskTemplates(fixture.policy, category)[0];
          await tx.onboardingTask.create({ data: { onboardingProcessId: process.id, title: missing.title, type: missing.type, isRequired: missing.isRequired, status: 'WAIVED', reviewerNotes: 'Synthetic authorized waiver' } });
          await updateOnboardingTaskStatusAction(task.id, 'SUBMITTED');
          await updateOnboardingTaskStatusAction(task.id, 'VERIFIED');
          process = await tx.onboardingProcess.findUniqueOrThrow({ where: { id: process.id } });
          ok(process.status === 'COMPLETED' && process.completedAt.getTime() === metadata.completedAt.getTime(), label + ': re-completion preserves original timestamp');
          ok(calculateHiringReadiness(await ctx.source(tx, fixture.application.id)).isReadyToHire, label + ': complete verified/waived checklist passes');
          const converted = await convertApplicationToEmployee(input(fixture));
          const retry = await convertApplicationToEmployee(input(fixture));
          const app = await tx.application.findUniqueOrThrow({ where: { id: fixture.application.id }, include: { employee: { include: { employmentRecords: { include: { probation: true } } } }, history: true } });
          ok(app.status === 'HIRED' && app.history.length === 1 && app.history[0].toStatus === 'HIRED' && retry.idempotent && retry.employeeId === converted.employeeId && app.employee.employmentRecords[0].probation, label + ': conversion and retry retain one employee and consistent audit');
        }
        const progression = await ctx.candidate(tx, saga, { category: 'TEACHING', status: 'INTERVIEW' });
        const initialInterview = await tx.interview.findFirstOrThrow({ where: { applicationId: progression.application.id, type: 'INITIAL_SCREENING' } });
        await tx.interview.update({ where: { id: initialInterview.id }, data: { status: 'SCHEDULED' } });
        ok((await transitionApplicationStatus({ ...input(progression), target: 'ASSESSMENT' })).error, 'PostgreSQL: scheduled initial screening blocks advancement');
        await tx.interview.update({ where: { id: initialInterview.id }, data: { status: 'COMPLETED' } });
        ok((await transitionApplicationStatus({ ...input(progression), target: 'ASSESSMENT' })).success, 'PostgreSQL: approved initial screening permits assessment entry');
        await tx.assessment.updateMany({ where: { applicationId: progression.application.id }, data: { status: 'FAILED', score: 30 } });
        ok((await transitionApplicationStatus({ ...input(progression), target: 'OFFER' })).error, 'PostgreSQL: failed examination blocks OFFER');
        await tx.assessment.updateMany({ where: { applicationId: progression.application.id }, data: { status: 'PASSED', score: 90 } });
        ok((await transitionApplicationStatus({ ...input(progression), target: 'OFFER' })).success, 'PostgreSQL: valid institutional progression succeeds');
        ok((await transitionApplicationStatus({ ...input(progression), target: 'SCREENING' })).error, 'PostgreSQL: invalid stage skipping/backtracking denied');
        ok((await transitionApplicationStatus({ ...input(progression), actorUserId: saga.actors.HIRING_MANAGER.id, target: 'REJECTED' })).error, 'PostgreSQL: persisted unauthorized role cannot change stage');
        await assert.rejects(convertApplicationToEmployee({ ...input(progression), actorUserId: saga.actors.HIRING_MANAGER.id }), error => error.code === 'APPLICATION_NOT_FOUND');
        ok(true, 'PostgreSQL: unauthorized employee conversion denied');
        ok((await transitionApplicationStatus({ ...input(progression), actorUserId: foreign.actors.HR_ADMIN.id, organizationId: foreign.org.id, target: 'REJECTED' })).error, 'PostgreSQL: foreign tenant cannot change owned application');
        const legacy = await ctx.candidate(tx, company, { status: 'HIRED', incomplete: true });
        ok(!calculateHiringPrerequisites(await ctx.source(tx, legacy.application.id)).isReadyToHire, 'PostgreSQL: legacy HIRED incomplete checklist remains ineligible');
        await assert.rejects(convertApplicationToEmployee(input(legacy)), error => error.code === 'NOT_READY');
        ok(true, 'PostgreSQL: legacy employee-record recovery blocked before writes');
        throw rollback;
      }, { isolationLevel: ctx.Prisma.TransactionIsolationLevel.Serializable, timeout: 180000, maxWait: 15000 });
    } catch (error) { if (error !== rollback) throw error; }
    active = ctx.db;
    const owner = await ctx.tenant(ctx.db);
    session = sessionFor(owner.actors.HR_ADMIN);
    for (const competing of [false, true]) {
      const fixture = await ctx.candidate(ctx.db, owner, { status: 'INTERVIEW' });
      active = simultaneous(ctx.db, fixture.application.id);
      const outcomes = await Promise.all([
        transitionApplicationStatus({ ...input(fixture), target: 'ASSESSMENT' }),
        transitionApplicationStatus({ ...input(fixture), target: competing ? 'REJECTED' : 'ASSESSMENT' }),
      ]);
      active = ctx.db;
      const app = await ctx.db.application.findUniqueOrThrow({ where: { id: fixture.application.id }, include: { history: true } });
      ok(outcomes.filter(result => result.success).length === 1 && app.history.length === 1 && app.history[0].toStatus === app.status && outcomes.some(result => /concurrently/.test(result.error || '')), 'Real concurrent ' + (competing ? 'different' : 'duplicate') + ' stage updates: one commit, one conflict, consistent history');
      const duplicate = await transitionApplicationStatus({ ...input(fixture), target: app.status });
      ok(duplicate.success && await ctx.db.applicationStatusHistory.count({ where: { applicationId: app.id } }) === 1, 'Repeated successful stage submission adds no audit duplicate');
    }
    const hire = await ctx.candidate(ctx.db, owner);
    active = simultaneous(ctx.db, hire.application.id);
    const hires = await Promise.all([convertApplicationToEmployee(input(hire)), convertApplicationToEmployee(input(hire))]);
    active = ctx.db;
    ok(hires[0].employeeId === hires[1].employeeId && hires.some(result => result.idempotent) && await ctx.db.employee.count({ where: { sourceApplicationId: hire.application.id } }) === 1 && await ctx.db.applicationStatusHistory.count({ where: { applicationId: hire.application.id } }) === 1, 'Real duplicate conversion: one linked employee/employment/probation and one HIRED audit');
    const conflict = await ctx.candidate(ctx.db, owner);
    active = simultaneous(ctx.db, conflict.application.id);
    await Promise.allSettled([transitionApplicationStatus({ ...input(conflict), target: 'REJECTED' }), convertApplicationToEmployee(input(conflict))]);
    active = ctx.db;
    const result = await ctx.db.application.findUniqueOrThrow({ where: { id: conflict.application.id }, include: { employee: true, history: true } });
    ok(result.history.length === 1 && result.history[0].toStatus === result.status && Boolean(result.employee) === (result.status === 'HIRED'), 'Real rejection/conversion contention cannot leave OFFER/HIRED history mismatch or partial employee');
    const reopen = await ctx.candidate(ctx.db, owner);
    const pair = reopen.process.tasks.filter(task => task.isRequired).slice(0, 2);
    assert.equal(pair.length, 2);
    active = simultaneous(ctx.db, null, { task: pair.map(task => task.id) });
    const reopens = await Promise.all(pair.map(task => updateOnboardingTaskStatusAction(task.id, 'IN_PROGRESS', 'Concurrent synthetic verification review')));
    active = ctx.db;
    const process = await ctx.db.onboardingProcess.findUniqueOrThrow({ where: { id: reopen.process.id }, include: { tasks: true } });
    ok(reopens.filter(result => result.success).length === 1 && process.completedAt.getTime() === reopen.process.completedAt.getTime() && process.notes.split('[onboarding-audit] ').length === 2 && process.tasks.filter(task => task.status === 'IN_PROGRESS').length === 1, 'Real concurrent task reopening preserves completion timestamp and one atomic audit without lost evidence');
    save('postgres-results', { status: 'PASS', checks, realConcurrentCommits: true, migrationsExecuted: 0 });
  } catch (error) {
    failure = error;
    save('postgres-results', { status: 'FAIL', checks, errorCode: error.code || error.name, failure: error.message?.startsWith('PostgreSQL') || error.code === 'ERR_ASSERTION' ? error.message : undefined });
  } finally {
    active = ctx.db;
    try {
      const cleanup = await ctx.cleanup();
      const after = await helper.fingerprints(ctx.db, before.columns);
      const changedTables = before.tables.filter((table, index) => JSON.stringify(table) !== JSON.stringify(after.tables[index])).map(table => table.table);
      save('postgres-cleanup', { ...cleanup, status: changedTables.length ? 'FAIL' : 'PASS', comparedTables: before.tables.length, changedTables, originalEnvUnchanged: true });
      assert.equal(changedTables.length, 0, 'Existing records changed after synthetic fixture cleanup');
    } finally { await ctx.db.$disconnect(); Module._load = originalLoad; }
  }
  if (failure) throw failure;
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, actualPostgresConcurrency: true, existingDataPreserved: true }));
}
main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', code: error.code || error.name, locations: error.stack?.split('\n').filter(line => line.trim().startsWith('at ')).slice(0, 4) })); process.exitCode = 1; });
