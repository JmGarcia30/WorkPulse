/* eslint-disable @typescript-eslint/no-require-imports -- Migration rehearsal only on the verified isolated production copy. */
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawn } = require('node:child_process');
const { createHash, randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { fingerprints } = require('./batch0-recovery-environment.cjs');
const directory = 'docs/payroll-v2/review', privateDirectory = path.resolve('storage/payroll-v2-review');
const branch = 'br-lingering-dawn-azrdk13o';
const config = parseEnv(fs.readFileSync('.env.payroll-v2-rehearsal.local', 'utf8'));
const url = new URL(config.DATABASE_URL); url.hostname = url.hostname.replace('-pooler.', '.');
const verified = JSON.parse(fs.readFileSync(`${directory}/production-copy-verified.json`, 'utf8'));
if (config.PAYROLL_REHEARSAL_BRANCH !== branch || !verified.passed || verified.identity.branch_id !== branch || verified.identity.endpoint_id !== url.hostname.split('.')[0]) throw Error('UNVERIFIED_MIGRATION_COPY');
const db = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] });
const digest = value => createHash('sha256').update(value).digest('hex');
const protectedFiles = ['.env', '.env.recovery.local', '.env.payroll-v2.local'];
const beforeFiles = Object.fromEntries(protectedFiles.map(file => [file, digest(fs.readFileSync(file))]));
const migration = '20261104000100_payroll_simplification_v2';
const sql = fs.readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8');
const columns = JSON.parse(fs.readFileSync(`${directory}/production-copy-source.json`, 'utf8')).baseline.columns;
const results = { checks: [], migration, migrationSha256: digest(sql), branch, productionWrites: 0, commands: [] };
function check(value, label) { if (!value) throw Error(label); results.checks.push(label); console.log('PASS', label); }
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: options.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { err += chunk; });
    child.once('error', reject); child.once('exit', code => resolve({ code, out, err }));
  });
}
const pgEnv = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: 'require', PGOPTIONS: '-c statement_timeout=120000' };
async function psql(file) { return run(path.join(privateDirectory, 'pg-client/psql.exe'), ['--no-psqlrc', '--set=ON_ERROR_STOP=1', '--file=' + file], { env: pgEnv }); }
async function structure() {
  return db.$queryRaw`SELECT c.relname AS table_name,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname`;
}
async function main() {
  const [identity] = await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id`;
  check(identity.branch_id === branch && identity.endpoint_id === verified.identity.endpoint_id, 'Live target is the verified isolated production copy');
  const resume = process.argv.includes('--resume');
  if (resume) results.checks.push(...JSON.parse(fs.readFileSync(`${directory}/migration-rehearsal-failure.json`, 'utf8')).checks);
  const initial = await fingerprints(db, columns), oldConstraints = (await structure()).filter(row => !['PayrollNotification', 'PayrollInputRevision'].includes(row.table_name));
  check(JSON.stringify(initial.tables) === JSON.stringify(verified.rowFingerprints), 'All copied production records match the restored baseline before rehearsal');
  const names = await db.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
  if (!resume) {
  check(!names.some(row => row.migration_name === migration), 'Payroll V2 migration is unapplied on this copy');
  const failureFile = path.join(privateDirectory, 'migration-failure-probe.sql');
  fs.writeFileSync(failureFile, sql.replace(/COMMIT;\s*$/, 'SELECT 1/0;\nCOMMIT;'));
  const failure = await psql(failureFile);
  check(failure.code !== 0 && /division by zero/.test(failure.err), 'Injected end-of-migration failure is observed');
  const [absent] = await db.$queryRaw`SELECT to_regclass('public."PayrollNotification"')::text AS notification,to_regclass('public."PayrollInputRevision"')::text AS revision`;
  check(absent.notification === null && absent.revision === null && JSON.stringify(await structure()) === JSON.stringify(oldConstraints), 'Failed migration rolls back every new object and leaves original constraints unchanged');
  const environment = { ...process.env, DATABASE_URL: url.href, DIRECT_URL: url.href, NODE_ENV: 'production', VERCEL: '0', VERCEL_ENV: '', NEXT_TELEMETRY_DISABLED: '1', SESSION_SECRET: randomBytes(48).toString('hex'), SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', GMAIL_USER: '', GMAIL_APP_PASSWORD: '' };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const applied = await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: environment });
    fs.writeFileSync(`${directory}/migrate-deploy-${attempt}.log`, applied.out + applied.err);
    check(applied.code === 0, `Prisma migrate deploy attempt ${attempt} succeeds`);
    if (attempt === 2) check(/No pending migrations/.test(applied.out), 'Second Prisma deployment is a no-op');
    results.commands.push({ command: 'prisma migrate deploy', attempt, exitCode: applied.code });
  }
  const directReplay = await psql(path.resolve(`prisma/migrations/${migration}/migration.sql`));
  check(directReplay.code !== 0 && /already exists/.test(directReplay.err), 'Raw SQL replay fails closed instead of hiding schema drift');
  }
  const rollbackFile = path.join(privateDirectory, 'rollback-probe.sql');
  const rollback = fs.readFileSync(`${directory}/rollback-pre-use.sql`, 'utf8').replace(/COMMIT;\s*$/, () => `DO $$ BEGIN IF to_regclass('public."PayrollNotification"') IS NOT NULL OR to_regclass('public."PayrollInputRevision"') IS NOT NULL THEN RAISE EXCEPTION 'rollback objects remain'; END IF; END $$;\nROLLBACK;`);
  fs.writeFileSync(rollbackFile, rollback);
  const rollbackResult = await psql(rollbackFile);
  fs.writeFileSync(`${directory}/rollback-probe.log`, rollbackResult.out + rollbackResult.err);
  check(rollbackResult.code === 0, 'Pre-use down-migration works transactionally and is rolled back to retain the migrated copy');
  const after = await fingerprints(db, columns), currentConstraints = await structure();
  check(JSON.stringify(after.tables) === JSON.stringify(initial.tables), 'All 75 original-table counts and full-row fingerprints remain identical after failure, deploy, retry and rollback probes');
  check(JSON.stringify(currentConstraints.filter(row => !['PayrollNotification', 'PayrollInputRevision'].includes(row.table_name))) === JSON.stringify(oldConstraints), 'Every original constraint remains unchanged');
  const constraints = await db.$queryRaw`SELECT c.relname AS table_name,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid WHERE c.relname IN ('PayrollNotification','PayrollInputRevision') ORDER BY c.relname,k.conname`;
  const triggers = await db.$queryRaw`SELECT c.relname AS table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname IN ('PayrollNotification','PayrollInputRevision') AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`;
  const history = await db.$queryRaw`SELECT migration_name,checksum FROM "_prisma_migrations" WHERE migration_name=${migration} AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  check(history.length === 1 && history[0].checksum === digest(sql), 'Migration history records the reviewed checksum exactly once');
  check(constraints.every(row => row.convalidated) && constraints.filter(row => row.contype === 'f').length === 6, 'All six new tenant-scoped foreign keys are validated');
  check(triggers.length === 6 && triggers.every(row => row.tgenabled === 'O'), 'Insert, update/delete and truncate guards are enabled on both new tables');
  check(protectedFiles.every(file => digest(fs.readFileSync(file)) === beforeFiles[file]), 'Existing environment profiles remain byte-identical');
  results.passed = true; results.constraints = constraints; results.triggers = triggers; results.migrationHistory = history; results.preservation = after.tables;
  fs.writeFileSync(`${directory}/migration-rehearsal.json`, JSON.stringify(results, null, 2));
}
main().catch(error => { fs.writeFileSync(`${directory}/migration-rehearsal-failure.json`, JSON.stringify({ ...results, error: error.code || error.message }, null, 2)); console.error(error.code || error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
