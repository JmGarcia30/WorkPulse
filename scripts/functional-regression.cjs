/* eslint-disable @typescript-eslint/no-require-imports -- Recovery-only functional verification; no DDL. */
const fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!verified.h10Applied || !verified.h10ChecksumMatch || verified.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_TARGET');
const directory = 'docs/functional-regression';
fs.mkdirSync(directory, { recursive: true });
const save = (name, value) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2));
const environment = { ...config.environment, DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href, NODE_ENV: 'test', NODE_OPTIONS: '--require ' + path.resolve('scripts/batch2-test-preload.cjs'), WORKPULSE_BATCH2_PARITY: '1', WORKPULSE_FINAL_UX_PARITY: '1', WORKPULSE_FINAL_UX_DIAGNOSTICS: '1' };
async function run(name, args, env = environment, executable = process.execPath) {
  const start = performance.now(), child = spawn(executable, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', b => output += b);
  const exitStatus = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
  const exitCode = Number.isInteger(exitStatus) ? exitStatus : 1;
  const safe = line => line.replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]');
  const result = { name, exitCode, elapsedMs: Math.round(performance.now() - start), assertions: output.split(/\r?\n/).filter(l => /^(PASS |REGRESSION |H[0-9]|S1 |UX |FR |.*[✓✔].*)/.test(l)).map(safe) };
  if (exitCode) result.diagnostics = output.split(/\r?\n/).filter(l => /\berror\b|\bwarning\b|Error:|ValidationError|FAIL|AssertionError|\.tsx?[(:]|P\d{4}/.test(l)).slice(-20).map(safe);
  save(name, result); console.log(JSON.stringify({ ...result, assertions: result.assertions.length }));
  return exitCode;
}
async function integrity(label) {
  const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
  try {
    const namespaces = await db.$queryRaw`SELECT n.nspname AS name, count(c.oid)::int AS tables FROM pg_namespace n LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relkind='r' WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' GROUP BY n.nspname ORDER BY n.nspname`;
    const migrationHistory = await db.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
    const catalog = await db.$queryRaw`SELECT 'column' AS kind,table_name AS object,column_name AS name,concat(data_type,':',is_nullable,':',coalesce(column_default,'')) AS definition FROM information_schema.columns WHERE table_schema='public'
      UNION ALL SELECT 'trigger',c.relname,t.tgname,concat(t.tgenabled,':',pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
      UNION ALL SELECT 'constraint',c.relname,con.conname,pg_get_constraintdef(con.oid) FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
      UNION ALL SELECT 'index',tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY kind,object,name`;
    const data = await helper.fingerprints(db);
    const state = { branch: config.identity.branchName, originalEnvSha256: config.identity.originalEnvSha256, namespaces, migrationHistory, catalogSha256: helper.digest(JSON.stringify(catalog)), data };
    save('integrity-' + label, state);
    helper.assertOriginalUnchanged(config);
    if (label === 'after') {
      const before = JSON.parse(fs.readFileSync(`${directory}/integrity-before.json`));
      const differences = data.tables.filter(row => { const old = before.data.tables.find(x => x.table === row.table); return !old || old.count !== row.count || old.fingerprint !== row.fingerprint; }).map(x => x.table);
      const result = { tablesChecked: data.tables.length, differences, schemasUnchanged: JSON.stringify(before.namespaces) === JSON.stringify(namespaces), catalogUnchanged: before.catalogSha256 === state.catalogSha256, migrationsUnchanged: JSON.stringify(before.migrationHistory) === JSON.stringify(migrationHistory), originalEnvUnchanged: before.originalEnvSha256 === state.originalEnvSha256 };
      save('integrity-summary', result); console.log(JSON.stringify(result));
    } else console.log(JSON.stringify({ tables: data.tables.length, namespaces, appliedMigrations: migrationHistory.length, branch: state.branch }));
  } finally { await db.$disconnect(); }
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'before' || mode === 'after') return integrity(mode);
  if (mode === 'build') {
    const env = { ...environment, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled) };
    for (const [name, args] of [['prisma-validation', ['node_modules/prisma/build/index.js', 'validate']], ['typescript', ['node_modules/typescript/bin/tsc', '--noEmit']], ['production-build', ['node_modules/next/dist/bin/next', 'build', '--webpack']]]) if (await run(name, args, env)) throw Error('BUILD_FAILED');
    return;
  }
  if (mode === 'checks') {
    const paths = ['scripts/functional-regression.cjs', 'scripts/functional-rollback-browser.cjs', 'scripts/functional-rollback-services.cjs', 'scripts/test-functional-dashboard-boundary.cjs', 'scripts/test-h8-analytics.ts', 'scripts/batch0-recovery-browser.cjs', 'src/features/dashboard/employee-alerts.ts'];
    if (await run('changed-eslint', ['node_modules/eslint/bin/eslint.js', ...paths])) throw Error('LINT_FAILED');
    if (await run('diff-check', ['diff', '--check'], environment, 'git')) throw Error('DIFF_FAILED');
    return;
  }
  if (mode === 'analytics') return run('test-h8-analytics', ['node_modules/tsx/dist/cli.mjs', 'scripts/test-h8-analytics.ts']);
  if (mode === 'role-check') return run('stale-role-browser', ['scripts/functional-rollback-browser.cjs'], { ...environment, FR_ROLE_ONLY: '1' });
  if (mode === 'dashboard-boundary') return run('test-dashboard-boundary', ['scripts/test-functional-dashboard-boundary.cjs']);
  if (['adapted-h10-1', 'adapted-h10-2'].includes(mode)) return run(mode + '-execution', ['scripts/functional-rollback-services.cjs', mode.slice('adapted-'.length)]);
  if (mode === 'adapted') {
    let failed = false;
    for (const suite of ['h1', 'h2', 'h3', 'h10-1', 'h10-2']) if (await run('adapted-' + suite + '-execution', ['scripts/functional-rollback-services.cjs', suite])) failed = true;
    if (failed) throw Error('ADAPTED_FAILURES');
    return;
  }
  if (mode === 'automated') {
    let failed = false;
    for (const file of ['test-h4-employee-self-service.ts', 'test-h5-leave-management.ts', 'test-h6-payroll-foundation.ts', 'test-h8-analytics.ts', 'test-s1-saas-shell.ts', 'test-extraction-units.ts']) {
      if (await run(file.replace(/\.ts$/, ''), ['node_modules/tsx/dist/cli.mjs', 'scripts/' + file])) failed = true;
    }
    for (const file of ['test-runtime-startup.cjs', 'test-final-ux-hiring.cjs', 'test-final-ux-payroll-state.cjs']) if (await run(file.replace(/\.cjs$/, ''), ['scripts/' + file])) failed = true;
    if (failed) throw Error('REGRESSION_FAILURES');
    return;
  }
  throw Error('UNKNOWN_MODE');
}
main().then(result => { if (Number.isInteger(result) && result !== 0) process.exitCode = result; }).catch(e => { console.error(JSON.stringify({ code: e.code || e.name, message: /^[A-Z_]+$/.test(e.message) ? e.message : undefined })); process.exitCode = 1; });
