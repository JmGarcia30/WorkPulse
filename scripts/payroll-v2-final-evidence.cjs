/* eslint-disable @typescript-eslint/no-require-imports -- Final read-only preservation check on the isolated copy. */
const fs = require('node:fs');
const { parseEnv } = require('node:util');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { fingerprints } = require('./batch0-recovery-environment.cjs');
const directory = 'docs/payroll-v2/review';
const source = JSON.parse(fs.readFileSync(`${directory}/production-copy-source.json`, 'utf8'));
const copy = JSON.parse(fs.readFileSync(`${directory}/production-copy-verified.json`, 'utf8'));
const initial = JSON.parse(fs.readFileSync(`${directory}/initial-implementation-manifest.json`, 'utf8'));
const profile = parseEnv(fs.readFileSync('.env.payroll-v2-rehearsal.local', 'utf8'));
const url = new URL(profile.DATABASE_URL); url.searchParams.set('options', '-c default_transaction_read_only=on');
const db = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] });
const digest = value => createHash('sha256').update(value).digest('hex');
const newTables = ['PayrollNotification', 'PayrollInputRevision'];
async function main() {
  const [identity] = await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch_id,current_setting('default_transaction_read_only') AS read_only`;
  if (identity.branch_id !== 'br-lingering-dawn-azrdk13o' || identity.read_only !== 'on') throw Error('UNVERIFIED_FINAL_READER');
  const rows = await fingerprints(db, source.baseline.columns);
  const histories = await db.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
  const migratedNames = ['20261104000100_payroll_simplification_v2', '20261105000100_payroll_v2_index_names'];
  const originalHistory = histories.filter(row => !migratedNames.includes(row.migration_name));
  const migrations = migratedNames.map(name => ({ name, localSha256: digest(fs.readFileSync(`prisma/migrations/${name}/migration.sql`)), records: histories.filter(row => row.migration_name === name) }));
  const constraints = await db.$queryRaw`SELECT c.relname AS table_name,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname`;
  const triggers = await db.$queryRaw`SELECT c.relname AS table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`;
  const functions = await db.$queryRaw`SELECT p.proname,p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prorettype='trigger'::regtype ORDER BY p.proname`;
  const indexes = await db.$queryRaw`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`;
  const flags = {
    originalDataUnchanged: JSON.stringify(rows.tables) === JSON.stringify(source.baseline.tables),
    originalMigrationHistoryUnchanged: JSON.stringify(originalHistory) === JSON.stringify(source.migrations),
    originalConstraintsUnchanged: JSON.stringify(constraints.filter(row => !newTables.includes(row.table_name))) === JSON.stringify(copy.schema.constraints),
    originalTriggersUnchanged: JSON.stringify(triggers.filter(row => !newTables.includes(row.table_name))) === JSON.stringify(copy.schema.triggers),
    originalFunctionsUnchanged: JSON.stringify(functions.filter(row => !row.proname.startsWith('payroll_v2_'))) === JSON.stringify(copy.schema.functions),
    originalIndexesUnchanged: JSON.stringify(indexes.filter(row => !newTables.includes(row.tablename))) === JSON.stringify(copy.schema.indexes),
    migrationsRecordedExactlyOnce: migrations.every(m => m.records.length === 1 && m.records[0].finished && !m.records[0].rolled_back && m.records[0].checksum === m.localSha256),
    protectedUserAndEnvironmentFilesUnchanged: initial.protectedFiles.every(file => digest(fs.readFileSync(file.path)) === file.sha256),
    uiFilesUnchangedDuringFollowup: initial.files.filter(file => file.path.endsWith('.tsx')).every(file => digest(fs.readFileSync(file.path)) === file.sha256),
  };
  const details = { passed: Object.values(flags).every(Boolean), capturedAt: new Date().toISOString(), identity, flags, originalTables: rows.tables.length, originalRows: rows.tables.reduce((sum, row) => sum + row.count, 0), migrations, rowFingerprints: rows.tables, productionWrites: 0, actualProductionPayrollGenerated: false, buildsDuringFollowup: 0, productionCopyContainsPayrollEntries: source.baseline.tables.find(row => row.table === 'PayrollEntry')?.count ?? null };
  fs.writeFileSync(`${directory}/final-preservation.json`, JSON.stringify(details, null, 2));
  console.log(JSON.stringify({ passed: details.passed, ...flags, tables: details.originalTables, rows: details.originalRows }));
  if (!details.passed) process.exitCode = 1;
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
