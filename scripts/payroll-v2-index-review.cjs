/* eslint-disable @typescript-eslint/no-require-imports -- Only the isolated rehearsal branch may mutate. */
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { fingerprints } = require('./batch0-recovery-environment.cjs');
const directory = 'docs/payroll-v2/review', privateDirectory = path.resolve('storage/payroll-v2-review');
const profile = parseEnv(fs.readFileSync('.env.payroll-v2-rehearsal.local', 'utf8'));
const url = new URL(profile.DATABASE_URL); url.hostname = url.hostname.replace('-pooler.', '.');
const db = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] });
const source = JSON.parse(fs.readFileSync(`${directory}/production-copy-source.json`, 'utf8'));
const migration = '20261105000100_payroll_v2_index_names';
const sql = fs.readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8');
const checks = [];
function check(value, label) { if (!value) throw Error(label); checks.push(label); console.log('PASS', label); }
function run(command, args, env) { return new Promise((resolve, reject) => { const child = spawn(command, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = ''; child.stdout.on('data', c => { out += c; }); child.stderr.on('data', c => { err += c; }); child.once('error', reject); child.once('exit', code => resolve({ code, out, err })); }); }
async function indexes() { return db.$queryRaw`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`; }
async function main() {
  const [identity] = await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch_id`;
  check(identity.branch_id === 'br-lingering-dawn-azrdk13o', 'Index correction target is the verified isolated copy');
  const beforeIndexes = await indexes();
  const pgEnv = { ...process.env, PGHOST: url.hostname, PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: 'require' };
  const failureFile = path.join(privateDirectory, 'index-failure.sql'); fs.writeFileSync(failureFile, sql.replace(/COMMIT;\s*$/, 'SELECT 1/0;\nCOMMIT;'));
  const failed = await run(path.join(privateDirectory, 'pg-client/psql.exe'), ['--no-psqlrc', '--set=ON_ERROR_STOP=1', '--file=' + failureFile], pgEnv);
  check(failed.code !== 0 && /division by zero/.test(failed.err) && JSON.stringify(await indexes()) === JSON.stringify(beforeIndexes), 'Injected index migration failure rolls back all renames');
  const env = { ...process.env, DATABASE_URL: url.href, DIRECT_URL: url.href, VERCEL: '0', VERCEL_ENV: '', NEXT_TELEMETRY_DISABLED: '1' };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env);
    fs.writeFileSync(`${directory}/index-deploy-${attempt}.log`, result.out + result.err);
    check(result.code === 0 && (attempt !== 2 || /No pending migrations/.test(result.out)), `Index migration deploy ${attempt} succeeds${attempt === 2 ? ' as a no-op' : ''}`);
  }
  const afterIndexes = await indexes();
  const original = rows => rows.filter(row => !['PayrollNotification', 'PayrollInputRevision'].includes(row.tablename));
  check(JSON.stringify(original(beforeIndexes)) === JSON.stringify(original(afterIndexes)), 'Every historical index is unchanged');
  const data = await fingerprints(db, source.baseline.columns);
  check(JSON.stringify(data.tables) === JSON.stringify(source.baseline.tables), 'All 75 original-table fingerprints still match the production snapshot');
  const history = await db.$queryRaw`SELECT migration_name,checksum FROM "_prisma_migrations" WHERE migration_name=${migration} AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  check(history.length === 1 && history[0].checksum === createHash('sha256').update(sql).digest('hex'), 'Index migration is recorded once with the reviewed checksum');
  // Use the datasource URL from env, so credentials never appear in command arguments.
  const diff = await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], env);
  fs.writeFileSync(`${directory}/schema-diff.sql`, diff.out); fs.writeFileSync(`${directory}/schema-diff.log`, diff.err);
  check(diff.code === 0, 'Read-only Prisma schema diff completes');
  check(!/PayrollNotification|PayrollInputRevision/.test(diff.out), 'No new V2 schema drift remains');
  fs.writeFileSync(`${directory}/index-rehearsal.json`, JSON.stringify({ passed: true, branch: identity.branch_id, migration, checks, migrationHistory: history, newIndexes: afterIndexes.filter(row => !original([row]).length), inheritedSchemaDiffNotApplied: diff.out, preservation: data.tables }, null, 2));
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
