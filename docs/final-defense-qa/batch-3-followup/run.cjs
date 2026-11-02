// B3 follow-up tests: no migrations, schema changes or production writes.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const helper = require('../../../scripts/batch0-recovery-environment.cjs');
const { scrub, offline } = require('../qa-runner.cjs');
const { PrismaClient } = require('@prisma/client');
const out = path.resolve(__dirname, 'evidence'); fs.mkdirSync(out, { recursive: true });
const write = fs.writeFileSync.bind(fs);
const save = (name, data) => write(path.join(out, name + '.json'), scrub(JSON.stringify(data, null, 2)) + '\n');
async function main() {
  if (process.argv[2] === 'offline') {
    Object.assign(process.env, offline);
    const { spawnSync } = require('node:child_process');
    for (const name of ['statutory', 'bir']) {
      const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', `scripts/test-payroll-${name}.ts`], { env: offline, encoding: 'utf8', windowsHide: true, maxBuffer: 15e6 });
      write(path.join(out, name + '.log'), scrub((result.stdout || '') + (result.stderr || '')));
      save(name, { capturedAt: new Date().toISOString(), exitCode: result.status, status: result.status === 0 ? 'PASS' : 'FAIL' });
      console.log(name, result.status);
      if (result.status !== 0) process.exitCode = 1;
    }
    return;
  }
  const config = helper.configuration();
  if (config.identity.branchId !== 'br-damp-fog-azmmxhga' || config.identity.endpointId !== 'ep-wild-mud-az8yzifu' || !config.identity.distinctFromProtectedOriginal) throw Error('WRONG_TEST_TARGET');
  const reader = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
  let before;
  try {
    const [identity] = await reader.$queryRawUnsafe("SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id");
    if (identity.read_only !== 'on' || identity.branch_id !== config.identity.branchId || identity.endpoint_id !== config.identity.endpointId || identity.database !== config.identity.database || identity.schema !== 'public') throw Error('LIVE_TEST_IDENTITY_MISMATCH');
    const migrations = await reader.$queryRawUnsafe('SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at');
    const local = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(e => e.isDirectory());
    if (migrations.filter(m => m.finished && !m.rolled_back).length !== local.length) throw Error('MIGRATION_COUNT_MISMATCH');
    for (const m of migrations.filter(m => !m.rolled_back)) {
      const sql = fs.readFileSync(`prisma/migrations/${m.migration_name}/migration.sql`, 'utf8');
      if (!m.finished || ![sql, sql.replace(/\r\n/g, '\n'), sql.replace(/\r?\n/g, '\r\n')].some(s => helper.digest(s) === m.checksum)) throw Error('MIGRATION_CHECKSUM_MISMATCH');
    }
    before = await helper.fingerprints(reader);
    save('target', { capturedAt: new Date().toISOString(), identity, existingRecoveryBranch: true, productionExcluded: true, migrationsVerified: local.length, migrationsExecuted: 0, providerMapping: { project: 'late-block-61364102', branch: 'workpulse-ess-design', primary: false, default: false }, before: before.tables });
  } finally { await reader.$disconnect(); }
  if (process.argv[2] === 'inspect') return;
  Object.assign(process.env, offline, { DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href });
  const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  require('tsx/cjs');
  const originalLoad = Module._load;
  Module._load = function(name, parent, main) {
    if (name === 'server-only') return {};
    if (name === '@/lib/db/prisma' || name === '../src/lib/db/prisma') return { prisma: db };
    if (name.startsWith('@/')) return originalLoad.call(this, path.resolve('src', name.slice(2)), parent, main);
    return originalLoad.call(this, name, parent, main);
  };
  // Preserve the old phase-3 probe artifact; redirect only its known output.
  fs.writeFileSync = function(file, ...args) {
    if (String(file).replaceAll('\\', '/') === 'docs/payroll-phase-3/unpaid-leave-probe.json') return write(path.join(out, 'unpaid-leave-probe.json'), ...args);
    return write(file, ...args);
  };
  const results = [];
  try {
    const suites = [
      ['integration', '../../../scripts/test-payroll-integration.ts', 'runPayrollIntegration'],
      ['workflow', '../../../scripts/test-payroll-workflow.ts', 'runPayrollWorkflow'],
      ['presentation', '../../../scripts/test-payroll-presentation.ts', 'runPayrollPresentation'],
      ['phase3', '../../../scripts/test-payroll-phase3.ts', 'runPayrollPhase3'],
      ['readiness', './readiness-tests.cjs', 'run'],
    ];
    for (const [id, file, fn] of suites.filter(([id]) => process.argv[2] !== 'probes' || id === 'probes')) {
      try {
        const r = await require(file)[fn](db);
        if (id === 'presentation') { delete r.fixtures; }
        if (id === 'phase3') { delete r.sagaReadOnly; }
        save(id, { capturedAt: new Date().toISOString(), status: 'PASS', ...r });
        results.push({ id, status: 'PASS', assertions: r.assertions });
      } catch (e) {
        save(id, { status: 'FAIL', message: scrub(e.message), stack: scrub(e.stack || '') });
        results.push({ id, status: 'FAIL' });
      }
      console.log('SUITE', JSON.stringify(results.at(-1)));
    }
  } finally {
    Module._load = originalLoad; fs.writeFileSync = write;
    const after = await helper.fingerprints(db, before.columns);
    const changed = before.tables.filter((table, i) => JSON.stringify(table) !== JSON.stringify(after.tables[i])).map(x => x.table);
    save('database-preservation', { capturedAt: new Date().toISOString(), existingDataUnchanged: !changed.length, tablesCompared: before.tables.length, changedTables: changed });
    save(process.argv[2] === 'probes' ? 'probes-summary' : 'summary', { capturedAt: new Date().toISOString(), results, migrationsExecuted: 0, productionWrites: 0 });
    helper.assertOriginalUnchanged(config); await db.$disconnect();
    if (changed.length || results.some(r => r.status !== 'PASS')) process.exitCode = 1;
  }
}
main().catch(e => { save('runner-error', { code: e.code || e.name, message: scrub(e.message) }); console.error(scrub(e.message)); process.exitCode = 1; });
