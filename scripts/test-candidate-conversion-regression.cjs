/* eslint-disable @typescript-eslint/no-require-imports -- Current conversion rules, disposable records, mandatory rollback. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs'), config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(`${helper.directory}/schema-and-history-verification.json`));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY_TARGET');
Object.assign(process.env, config.environment, { DATABASE_URL: helper.readOnly(config.pooled), NODE_ENV: 'test' });
require('tsx/cjs');
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
const rollback = Symbol('candidate-conversion-rollback'), checks = [];
async function main() {
  try {
    await db.$transaction(async tx => {
      let sequence = 0;
      const client = new Proxy(tx, { get(target, key) {
        if (key === '$transaction') return async operation => {
          const name = 'candidate_conversion_' + (++sequence);
          await tx.$executeRawUnsafe('SAVEPOINT ' + name);
          try { const result = await operation(tx); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
          catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); throw error; }
        };
        const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
      } });
      globalThis.prisma = client;
      // Reuse only the established fixture factory, not its obsolete main(),
      // cleanup, or pre-policy assumptions. A synthetic contract is signed at engagement.
      const filename = path.resolve('scripts/test-h1-employee-core.ts');
      let fixtureSource = fs.readFileSync(filename, 'utf8').split('async function main()')[0];
      if (!fixtureSource.includes('contractExecutedAt: new Date(),')) throw Error('FIXTURE_FACTORY_CHANGED');
      fixtureSource = fixtureSource.replace('contractExecutedAt: new Date(),', 'contractExecutedAt: input.startDate,');
      const fixtureModule = new Module(filename, module); fixtureModule.filename = filename; fixtureModule.paths = Module._nodeModulePaths(path.dirname(filename));
      fixtureModule._compile(ts.transpileModule(fixtureSource + '\nmodule.exports = { createReadyApplication };', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
      const { convertApplicationToEmployee } = require('../src/features/employees/conversion.ts');
      const marker = 'uat-candidate-conversion-' + randomBytes(6).toString('hex');
      const org = await tx.organization.create({ data: { name: 'Disposable candidate conversion', slug: marker } });
      const foreign = await tx.organization.create({ data: { name: 'Disposable foreign conversion', slug: marker + '-other' } });
      const actor = await tx.user.create({ data: { organizationId: org.id, role: 'HR_ADMIN', name: 'Fixture HR', email: marker + '@fixture.invalid' } });
      const application = await fixtureModule.exports.createReadyApplication({ organizationId: org.id, actorUserId: actor.id, category: 'NON_TEACHING', email: marker + '-candidate@fixture.invalid', firstName: 'Disposable', jobSuffix: 'staff', startDate: new Date('2026-06-30T00:00:00Z') });
      const input = { applicationId: application.application.id, organizationId: org.id, actorUserId: actor.id };
      await assert.rejects(convertApplicationToEmployee(input), error => error.code === 'INVALID_PROBATION_DATE');
      assert.equal(await tx.employee.count({ where: { applicantId: application.applicant.id } }), 0);
      checks.push('Missing probation attestation fails without partial employee creation');
      await tx.offer.updateMany({ where: { applicationId: input.applicationId }, data: { contractExecutedAt: new Date('2026-07-01T00:00:00Z') } });
      await assert.rejects(convertApplicationToEmployee({ ...input, probationStandardsConfirmed: true }), error => error.code === 'INVALID_PROBATION_DATE');
      checks.push('Late contract execution remains blocked by current conversion rules');
      await tx.offer.updateMany({ where: { applicationId: input.applicationId }, data: { contractExecutedAt: new Date('2026-06-30T00:00:00Z') } });
      const process = await tx.onboardingProcess.findUniqueOrThrow({ where: { applicationId: input.applicationId } });
      await tx.onboardingProcess.update({ where: { id: process.id }, data: { status: 'IN_PROGRESS' } });
      const requiredTask = await tx.onboardingTask.findFirstOrThrow({ where: { onboardingProcessId: process.id, isRequired: true } });
      await tx.onboardingTask.update({ where: { id: requiredTask.id }, data: { status: 'PENDING' } });
      await assert.rejects(convertApplicationToEmployee({ ...input, probationStandardsConfirmed: true }), error => error.code === 'NOT_READY');
      assert.equal(await tx.employee.count({ where: { applicantId: application.applicant.id } }), 0);
      checks.push('Missing required onboarding evidence cannot convert');
      await tx.onboardingTask.update({ where: { id: requiredTask.id }, data: { status: requiredTask.status } });
      await tx.onboardingProcess.update({ where: { id: process.id }, data: { status: 'COMPLETED' } });
      await assert.rejects(convertApplicationToEmployee({ ...input, organizationId: foreign.id, probationStandardsConfirmed: true }));
      checks.push('Foreign organization cannot convert the application');
      const result = await convertApplicationToEmployee({ ...input, probationStandardsConfirmed: true });
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: result.employeeId }, include: { employmentRecords: { include: { probation: true } } } });
      assert.equal(employee.organizationId, org.id);
      assert.equal(employee.employmentRecords.length, 1);
      assert.equal(employee.employmentRecords[0].salary.toFixed(2), '36000.00');
      assert.equal(employee.employmentRecords[0].probation.expectedEndAt.toISOString(), '2026-12-30T00:00:00.000Z');
      assert.equal((await tx.application.findUniqueOrThrow({ where: { id: input.applicationId } })).status, 'HIRED');
      checks.push('Reviewed conversion creates linked employee/employment/probation with agreed salary and dates');
      const retry = await convertApplicationToEmployee(input);
      assert(retry.idempotent && retry.employeeId === result.employeeId);
      assert.equal(await tx.employee.count({ where: { applicantId: application.applicant.id } }), 1);
      checks.push('Conversion retry preserves one employee and existing employment');
      throw rollback;
    }, { timeout: 180000 });
  } catch (error) { if (error !== rollback) throw error; }
  helper.assertOriginalUnchanged(config);
  fs.writeFileSync('docs/uat/candidate-access/conversion-regression.json', JSON.stringify({ passed: true, checks, fixtureFactory: 'existing H1 factory with synthetic contract signed at engagement', originalFixtureEdited: false, rollbackOnly: true, realConcurrentCommits: false }, null, 2));
  console.log(JSON.stringify({ passed: true, scenarios: checks.length, rollbackOnly: true }));
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: error.message?.split(/\r?\n/).slice(-1)[0] })); process.exitCode = 1; }).finally(async () => { delete globalThis.prisma; await db.$disconnect(); });
