/* eslint-disable @typescript-eslint/no-require-imports -- Isolated synthetic verification with redacted failure output. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const directory = 'docs/workflow-simplification';
const save = (name, value) => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, name + '.json'), JSON.stringify(value, null, 2)); };
async function main() {
  const config = helper.configuration();
  const reader = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
  try {
    const [state] = await reader.$queryRaw`SELECT current_database() AS database, current_setting('neon.branch_id', true) AS branch_id, current_setting('neon.endpoint_id', true) AS endpoint_id, current_setting('default_transaction_read_only') AS read_only`;
    if (state.branch_id !== config.identity.branchId || state.endpoint_id !== config.identity.endpointId || state.database !== config.identity.database || state.read_only !== 'on') throw Error('ISOLATED_TARGET_MISMATCH');
    save('target', { branchId: state.branch_id, endpointFingerprint: config.identity.endpointSha256, distinctFromProtectedOriginal: true });
  } finally { await reader.$disconnect(); }
  Object.assign(process.env, config.environment);
  if (process.argv[2] === 'build') {
    // Build-time reads are also restricted to the isolated target and read-only connections.
    const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { env: { ...process.env, DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), NODE_ENV: 'production' }, windowsHide: true, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
    const output = (result.stdout + result.stderr).replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]');
    save('build', { exitCode: result.status, output }); console.log(output);
    if (result.status !== 0) throw Error('BUILD_FAILED');
    helper.assertOriginalUnchanged(config); return;
  }
  const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  const before = await helper.fingerprints(db);
  require('tsx/cjs');
  const original = Module._load;
  let requestDb = db;
  const context = { headers: new Headers({ host: 'localhost:3000' }), jar: new Map() };
  Module._load = function(name, parent, main) {
    if (name === 'server-only') return {};
    if (name === '@/lib/db/prisma' || name === '../src/lib/db/prisma') return { prisma: requestDb };
    if (name === 'next/headers') return { headers: async () => context.headers, cookies: async () => ({ get: key => context.jar.get(key), has: key => context.jar.has(key), set: (key, value, options) => context.jar.set(key, { value, ...options }), delete: key => context.jar.delete(key) }) };
    if (name === '@/lib/email' && context.captureVerification) return { sendApplicantVerificationEmail: async input => { context.verificationUrl = input.url; return { success: true, mode: 'smtp' }; } };
    if (name === 'next/navigation') return { redirect: target => { throw Error('REDIRECT:' + target); }, notFound: () => { throw Error('NOT_FOUND'); } };
    if (name === 'next/cache') return { revalidatePath: () => {} };
    if (name.startsWith('@/')) return original.call(this, path.resolve('src', name.slice(2)), parent, main);
    return original.call(this, name, parent, main);
  };
  try {
    const results = {};
    if (process.argv[2] === 'workflow') { save('workflow-tests', await require('./test-payroll-workflow.ts').runPayrollWorkflow(db)); return; }
    if (process.argv[2] === 'platform') { save('platform-security', await require('./test-platform-admin.cjs')(db, context)); return; }
    if (process.argv[2] === 'boundaries') { save('boundary-tests', await require('./test-workflow-boundaries.cjs')(db, context, value => { requestDb = value; })); return; }
    if (process.argv[2] === 'registration') {
      const rollback = Error('REGISTRATION_FIXTURE_ROLLBACK'); let result;
      try {
        await db.$transaction(async tx => {
          const scoped = new Proxy(tx, { get(target, key) { return key === '$transaction' ? callback => callback(scoped) : Reflect.get(target, key); } });
          requestDb = scoped;
          result = await require('./test-company-registration.cjs')(scoped, context);
          throw rollback;
        }, { timeout: 180000 });
      } catch (error) { if (error !== rollback) throw error; }
      finally { requestDb = db; }
      save('registration-tests', { ...result, fixturesRolledBack: true }); return;
    }
    results.integration = await require('./test-payroll-integration.ts').runPayrollIntegration(db);
    save('tests', results);
    const presentation = await require('./test-payroll-presentation.ts').runPayrollPresentation(db);
    results.presentation = { passed: true, assertions: presentation.assertions };
    save('tests', results);
    save('fixtures', presentation.fixtures);
    results.workflow = await require('./test-payroll-workflow.ts').runPayrollWorkflow(db);
    results.boundaries = await require('./test-workflow-boundaries.cjs')(db, context, value => { requestDb = value; });
    save('tests', results);
  } finally {
    Module._load = original;
    try {
      const after = await helper.fingerprints(db, before.columns);
      const unchanged = JSON.stringify(before.tables) === JSON.stringify(after.tables);
      save('preservation', { unchanged, tablesCompared: before.tables.length });
      helper.assertOriginalUnchanged(config);
      if (!unchanged) throw Error('EXISTING_DATA_CHANGED');
    } finally { await db.$disconnect(); }
  }
}
main().catch(error => { console.error(error.code || error.name, error.code === 'ERR_ASSERTION' || /^[A-Z_]+$/.test(error.message) ? error.message : 'VERIFICATION_FAILED', error.stack?.split('\n').filter(line => /test-payroll|test-platform-admin|workflow-verification/.test(line)).join('\n')); process.exitCode = 1; });
