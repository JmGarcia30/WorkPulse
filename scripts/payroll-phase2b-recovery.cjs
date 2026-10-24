/* eslint-disable @typescript-eslint/no-require-imports -- Verified recovery-only migration/test/build runner. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const directory = process.argv[2]?.startsWith('phase3-') ? 'docs/payroll-phase-3' : process.argv[2]?.startsWith('ui-') ? 'docs/payroll-phase-2b-2' : 'docs/payroll-phase-2b-1';
const migration = '20261022000300_payroll_statutory_integration';
function save(name, value) { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2)); }
function run(args, env) {
  const result = spawnSync(process.execPath, args, { env, windowsHide: true, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const output = ((result.stdout || '') + (result.stderr || '')).replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]');
  return { exitCode: result.status, output };
}
async function main() {
  const config = helper.configuration();
  const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
  if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY_TARGET');
  const states = [];
  for (const url of [config.pooled, config.direct]) {
    const reader = new PrismaClient({ datasources: { db: { url: helper.readOnly(url) } }, log: [] });
    try {
      const [state] = await reader.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only`;
      if (state.database !== config.identity.database || state.schema !== 'public' || state.read_only !== 'on') throw Error('TARGET_STATE_MISMATCH');
      const history = await reader.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
      states.push({ state, history });
    } finally { await reader.$disconnect(); }
  }
  if (JSON.stringify(states[0]) !== JSON.stringify(states[1])) throw Error('RECOVERY_CONNECTION_HISTORY_MISMATCH');
  const history = states[0].history.filter(row => !row.rolled_back);
  for (const row of history) {
    const bytes = fs.readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`);
    if (!row.finished || ![bytes, Buffer.from(bytes.toString().replace(/\r\n/g, '\n')), Buffer.from(bytes.toString().replace(/\r?\n/g, '\r\n'))].some(value => helper.digest(value) === row.checksum)) throw Error('MIGRATION_HISTORY_MISMATCH');
  }
  const mode = process.argv[2];
  save('target', { identity: config.identity, verified: true, mode });
  console.log('Verified isolated recovery target:', config.identity.branchId);
  const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  try {
    const before = await helper.fingerprints(db);
    if (mode === 'migrate') {
      const bundle = fs.mkdtempSync('.next/payroll-2b-migration-');
      fs.mkdirSync(`${bundle}/migrations`);
      fs.copyFileSync('prisma/schema.prisma', `${bundle}/schema.prisma`);
      fs.copyFileSync('prisma/migrations/migration_lock.toml', `${bundle}/migrations/migration_lock.toml`);
      for (const name of [...new Set(history.map(row => row.migration_name).concat(migration))]) fs.cpSync(`prisma/migrations/${name}`, `${bundle}/migrations/${name}`, { recursive: true });
      const result = run(['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', `${bundle}/schema.prisma`], { ...config.environment, DATABASE_URL: config.direct.href });
      save('migration', { migration, ...result }); console.log(result.output);
      if (result.exitCode !== 0) throw Error('RECOVERY_MIGRATION_FAILED');
    } else if (mode === 'test' || mode === 'ui-test' || mode === 'phase3-test' || mode === 'phase3-probe') {
      require('tsx/cjs');
      const original = Module._load;
      Module._load = function(name, parent, main) {
        if (name === 'server-only') return {};
        if (name === '@/lib/db/prisma' || name === '../src/lib/db/prisma') return { prisma: db };
        if (name.startsWith('@/')) return original.call(this, path.resolve('src', name.slice(2)), parent, main);
        return original.call(this, name, parent, main);
      };
      try {
        if (mode === 'phase3-probe') {
          save('probe', await require('./test-payroll-phase3.ts').runPayrollPhase3(db));
        } else {
        const integration = await require('./test-payroll-integration.ts').runPayrollIntegration(db);
        if (mode === 'ui-test' || mode === 'phase3-test') {
          const presentation = await require('./test-payroll-presentation.ts').runPayrollPresentation(db);
          const phase3 = mode === 'phase3-test' ? await require('./test-payroll-phase3.ts').runPayrollPhase3(db) : undefined;
          save('tests', { integration, presentation: { assertions: presentation.assertions, passed: true }, phase3 });
          save('fixtures', presentation.fixtures);
        } else save('tests', integration);
        }
      }
      finally { Module._load = original; }
    } else if (mode === 'build' || mode === 'ui-build' || mode === 'phase3-build') {
      const result = run(['node_modules/next/dist/bin/next', 'build', '--webpack'], { ...config.environment, NODE_ENV: 'production' });
      save('build', result); console.log(result.output);
      if (result.exitCode !== 0) throw Error('BUILD_FAILED');
    } else throw Error('EXPECTED_MIGRATE_TEST_OR_BUILD');
    const after = await helper.fingerprints(db, before.columns);
    const unchanged = JSON.stringify(before.tables) === JSON.stringify(after.tables);
    save(`${mode}-preservation`, { existingDataUnchanged: unchanged, tablesCompared: before.tables.length });
    if (!unchanged) throw Error('EXISTING_DATA_CHANGED');
    helper.assertOriginalUnchanged(config);
    console.log(JSON.stringify({ mode, passed: true, existingTablesPreserved: before.tables.length }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error.code || error.name, /^[A-Z_]+$/.test(error.message) ? error.message : 'RECOVERY_TASK_FAILED', error.stack?.split('\n').filter(line => /test-payroll-(integration|presentation|phase3)/.test(line)).join('\n')); process.exitCode = 1; });
