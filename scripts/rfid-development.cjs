/* eslint-disable @typescript-eslint/no-require-imports -- Verified development-only RFID validation runner. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const migration = '20261025000100_rfid_attendance_phase1';
const sqlPath = `prisma/migrations/${migration}/migration.sql`;
const directory = 'docs/rfid/verification';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (name, data) => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(data, null, 2) + '\n'); };
const client = (url, readOnly = true) => {
  const { PrismaClient } = require('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: readOnly ? helper.readOnly(url) : String(url) } }, log: [] });
};
if (config.identity.branchName !== 'workpulse-ess-design' || config.identity.branchId !== 'br-damp-fog-azmmxhga' || config.identity.endpointId !== 'ep-wild-mud-az8yzifu') helper.fail('UNEXPECTED_DEVELOPMENT_TARGET');
const prior = read(`${helper.directory}/schema-and-history-verification.json`);
if (!prior.startupVerified || prior.identity.branchId !== config.identity.branchId || prior.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_TARGET');
async function identity(db, branch = config.identity.branchId, endpoint = config.identity.endpointId) {
  const [state] = await db.$queryRaw`SELECT current_database() AS database, current_schema() AS schema, current_setting('neon.branch_id',true) AS branch, current_setting('neon.endpoint_id',true) AS endpoint, current_setting('default_transaction_read_only') AS read_only`;
  if (state.database !== config.identity.database || state.schema !== 'public' || state.branch !== branch || state.endpoint !== endpoint || state.read_only !== 'on') helper.fail('LIVE_IDENTITY_MISMATCH');
  return state;
}
async function history(db) {
  return db.$queryRaw`SELECT migration_name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
}
async function command(name, args, env = config.environment) {
  const start = Date.now();
  const child = spawn(process.execPath, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => output += data);
  child.stderr.on('data', data => output += data);
  const exitCode = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
  const result = { name, exitCode, elapsedMs: Date.now() - start,
    checks: output.split(/\r?\n/).filter(line => /^(RFID PASS|RFID tests passed|CHAIN (?:PASS|FAIL)|H3 Attendance|PASS \d+:|REGRESSION |✓ Compiled|✓ Generating|Route \(app\)|Applying migration|All migrations)/.test(line)),
    errorCodes: [...new Set(output.match(/\b(?:P\d{4}|EPERM|EACCES|ENOENT|TS\d{4})\b/g) || [])],
  };
  if (exitCode) result.diagnostics = output.split(/\r?\n/).filter(line => /error TS|Error:|FAIL|AssertionError|\.ts[(:]|\.cjs[(:]/.test(line)).slice(-18).map(line => line.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]'));
  if (exitCode) result.safeFailures = output.split(/\r?\n/).filter(line => /^\{"code":/.test(line)).map(line => JSON.parse(line.replace(/postgres(?:ql)?:\/\/[^"\s]+/gi, '[REDACTED]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]')));
  if (exitCode && result.diagnostics.length === 0 && result.safeFailures.length === 0) result.diagnostics = output.split(/\r?\n/).filter(line => line.trim() && !/prisma:query|\[Audit query\]/.test(line)).slice(-15).map(line => line.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]'));
  save(name, result); console.log(JSON.stringify(result));
  if (exitCode) helper.fail('RFID_COMMAND_FAILED');
}
async function preflight() {
  const review = read('docs/rfid/migration-review.json');
  if (review.migration !== migration || review.sha256 !== helper.digest(fs.readFileSync(sqlPath))) helper.fail('RFID_REVIEW_CHANGED');
  const development = client(config.direct);
  const checkpoint = new URL(config.profile.WORKPULSE_TEST_NEON_CHECKPOINT_DATABASE_URL);
  const retained = read(`${helper.directory}/development-checkpoint-verification.json`);
  if (!retained.recoveryReady || retained.checkpointParentBranchId !== config.identity.branchId || retained.checkpointBranchId !== config.identity.checkpointBranchId || retained.checkpointEndpointId !== config.profile.WORKPULSE_TEST_NEON_CHECKPOINT_ENDPOINT_ID || checkpoint.hostname.replace('-pooler.', '.').split('.')[0] !== retained.checkpointEndpointId || checkpoint.hostname.replace('-pooler.', '.') === config.direct.hostname) helper.fail('UNVERIFIED_CHECKPOINT');
  const saved = client(checkpoint);
  try {
    const state = await identity(development);
    await identity(saved, retained.checkpointBranchId, retained.checkpointEndpointId);
    const applied = await history(development);
    if (applied.some(row => !row.finished && !row.rolled_back)) helper.fail('UNRESOLVED_MIGRATION');
    const local = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    const pending = [];
    for (const name of local) {
      const sql = fs.readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
      const hashes = [helper.digest(sql), helper.digest(sql.replace(/\r\n/g, '\n')), helper.digest(sql.replace(/\r?\n/g, '\r\n'))];
      const rows = applied.filter(row => row.migration_name === name && row.finished && !row.rolled_back);
      if (rows.some(row => !hashes.includes(row.checksum))) helper.fail('APPLIED_CHECKSUM_CHANGED');
      if (!rows.length) pending.push(name);
    }
    if (applied.filter(row => row.finished && !row.rolled_back).length !== 35 || JSON.stringify(pending) !== JSON.stringify([migration])) helper.fail('UNEXPECTED_PENDING_MIGRATIONS');
    if (JSON.stringify(await history(saved)) !== JSON.stringify(retained.migrationHistory)) helper.fail('CHECKPOINT_HISTORY_CHANGED');
    const checkpointBaseline = read(`${helper.directory}/development-protected-data-before.json`);
    const retainedData = await helper.fingerprints(saved, checkpointBaseline.columns);
    if (JSON.stringify(retainedData.tables) !== JSON.stringify(checkpointBaseline.tables)) helper.fail('CHECKPOINT_DATA_CHANGED');
    const baseline = await helper.fingerprints(development);
    fs.writeFileSync('.next/rfid-preflight.json', JSON.stringify({ ...baseline, migrationSha256: review.sha256 }));
    const result = { capturedAt: new Date().toISOString(), state, migration, migrationSha256: review.sha256, appliedMigrations: 35, pending, checkpointBranchId: retained.checkpointBranchId, checkpointVerifiedReadOnly: true, checkpointHistoryAndDataUnchanged: true, checkpointRecovery: 'Retained pre-recovery development checkpoint; replay the 11 previously verified local migrations to recover the 35-migration development baseline.', baselineTables: baseline.tables.length, originalEnvUnchanged: true };
    helper.assertOriginalUnchanged(config); save('migration-preflight', result); console.log(JSON.stringify(result));
  } finally { await Promise.all([development.$disconnect(), saved.$disconnect()]); }
}
async function migrate() {
  await preflight();
  const before = read('.next/rfid-preflight.json');
  if (before.migrationSha256 !== helper.digest(fs.readFileSync(sqlPath))) helper.fail('RFID_REVIEW_CHANGED');
  await command('migration-deploy', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { ...config.environment, DATABASE_URL: config.direct.href });
  const db = client(config.direct);
  try {
    await identity(db);
    const after = await helper.fingerprints(db, before.columns);
    if (JSON.stringify(before.tables) !== JSON.stringify(after.tables)) helper.fail('EXISTING_DATA_CHANGED');
    const applied = await history(db);
    if (!applied.some(row => row.migration_name === migration && row.finished && !row.rolled_back && row.checksum === before.migrationSha256)) helper.fail('RFID_MIGRATION_NOT_VERIFIED');
    save('development-migration', { capturedAt: new Date().toISOString(), branchName: config.identity.branchName, branchId: config.identity.branchId, migration, sha256: before.migrationSha256, appliedMigrations: applied.filter(row => row.finished && !row.rolled_back).length, existingTablesUnchanged: before.tables.length, originalEnvUnchanged: true });
    console.log(JSON.stringify({ migration: 'PASS', existingTablesUnchanged: before.tables.length }));
  } finally { await db.$disconnect(); }
}
async function tests(mode = 'test') {
  const readOnly = client(config.direct);
  try { await identity(readOnly); } finally { await readOnly.$disconnect(); }
  const schema = 'batch3_test_' + randomBytes(12).toString('hex');
  const control = client(config.direct, false);
  const url = new URL(config.direct); url.searchParams.set('schema', schema); url.searchParams.set('options', '-c search_path=' + schema + ',public');
  const env = { ...config.environment, NODE_ENV: 'test', DATABASE_URL: url.href, H10_TEST_DATABASE_URL: url.href, WORKPULSE_BATCH3_ISOLATED: '1', WORKPULSE_BATCH3_SCENARIOS_ONLY: '1', NODE_OPTIONS: '--require ' + path.resolve('scripts/batch2-test-preload.cjs') };
  let created = false;
  try {
    if (!/^batch3_test_[a-f0-9]{24}$/.test(schema)) helper.fail('INVALID_FIXTURE_SCHEMA');
    await control.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
    await command('fixture-migrations', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env);
    if (mode === 'chain-audit' || mode === 'chain-setup') {
      await command(mode === 'chain-setup' ? 'chain-setup' : 'chain-integration', ['node_modules/tsx/dist/cli.mjs', 'scripts/test-rfid-schedule-payroll.ts', ...(mode === 'chain-setup' ? ['--setup-only'] : [])], env);
      return;
    }
    const scripts = [['h3-regression', 'scripts/test-h3-attendance.ts'], ['rfid-integration', 'scripts/test-rfid-attendance.ts'], ['attendance-payroll-regression', 'scripts/test-batch3-services.ts'], ['h6-regression', 'scripts/test-h6-payroll-foundation.ts']];
    let failed = false;
    for (const [name, script] of scripts) {
      if (mode === 'browser' || (mode === 'rfid' && name !== 'rfid-integration') || (['regressions', 'audit-regressions'].includes(mode) && name === 'rfid-integration')) continue;
      // Retain the older payroll comparisons as an explicit diagnostic mode;
      // acceptance uses the current statutory integration suite below.
      if ((name === 'attendance-payroll-regression' || name === 'h6-regression') && !['regressions', 'audit-regressions'].includes(mode)) continue;
      if (mode === 'current-regressions' && name !== 'h3-regression') continue;
      if (mode === 'scan-fix' && name !== 'rfid-integration') continue;
      try { await command(name, ['node_modules/tsx/dist/cli.mjs', script], env); }
      catch (error) { if (error.code !== 'RFID_COMMAND_FAILED') throw error; failed = true; }
    }
    if (mode === 'current-regressions' || mode === 'test' || mode === 'audit-regressions') {
      await command('current-payroll-integration', ['node_modules/tsx/dist/cli.mjs', '-e', "const { prisma } = require('./src/lib/db/prisma.ts'); require('./scripts/test-payroll-integration.ts').runPayrollIntegration(prisma).catch(error => { console.error('CURRENT_PAYROLL_FAILURE', { code: error.code || error.name, message: error.message }); process.exitCode = 1; }).finally(() => prisma.$disconnect());"], env);
    }
    if (mode === 'test' || mode === 'browser' || mode === 'scan-fix') {
      const browserEnv = { ...env, NODE_ENV: 'development', PLATFORM_ROOT_DOMAIN: 'localhost:3136', PLATFORM_PUBLIC_ORIGIN: 'http://localhost:3136' };
      delete browserEnv.NODE_OPTIONS;
      try { await command('browser', ['scripts/test-rfid-browser.cjs'], browserEnv); }
      catch (error) { if (error.code !== 'RFID_COMMAND_FAILED') throw error; failed = true; }
    }
    if (failed) helper.fail('RFID_TESTS_FAILED');
  } finally {
    // Only the random private schema created by this invocation can be disposed.
    if (created && /^batch3_test_[a-f0-9]{24}$/.test(schema)) await control.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await control.$disconnect();
  }
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'preflight') return preflight();
  if (mode === 'migrate') return migrate();
  if (mode === 'generate') return command('prisma-generate', ['node_modules/prisma/build/index.js', 'generate']);
  if (mode === 'test') return tests();
  if (['browser', 'rfid', 'regressions', 'current-regressions', 'scan-fix', 'chain-audit', 'chain-setup', 'audit-regressions'].includes(mode)) return tests(mode);
  if (mode === 'checks') {
    await command('typescript', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']);
    await command('focused-lint', ['node_modules/eslint/bin/eslint.js', 'src/features/attendance/rfid*.ts', 'src/components/attendance/Rfid*.tsx', 'src/app/api/attendance/rfid', 'src/app/(dashboard)/dashboard/attendance/rfid/page.tsx', 'src/app/attendance-kiosk/page.tsx', 'src/proxy.ts', 'src/features/attendance/service.ts', 'src/app/(dashboard)/dashboard/attendance/page.tsx', 'scripts/rfid-development.cjs', 'scripts/test-rfid-attendance.ts', 'scripts/test-rfid-browser.cjs']);
    return;
  }
  if (mode === 'build') {
    const db = client(config.direct); try { await identity(db); } finally { await db.$disconnect(); }
    return command('build', ['node_modules/next/dist/bin/next', 'build', '--webpack'], { ...config.environment, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled) });
  }
  helper.fail('UNKNOWN_RFID_COMMAND');
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: /^[A-Z_]+$/.test(error.message) ? error.message : undefined })); process.exitCode = 1; }).finally(() => helper.assertOriginalUnchanged(config));
