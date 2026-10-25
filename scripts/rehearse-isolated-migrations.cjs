// Only the explicitly authorized rehearsal branch is eligible for database writes.
const fs = require('node:fs');
const { parseEnv } = require('node:util');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { fingerprints } = require('./batch0-recovery-environment.cjs');
const branch = 'br-nameless-sea-azximn2k';
const directory = 'docs/releases/isolated-rehearsal';
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw Error(code); };
const save = (name, value) => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2) + '\n'); };
const protectedPaths = ['.env', '.env.recovery.local', 'scripts/dev-recovery.cjs', 'scripts/batch0-recovery-environment.cjs', 'scripts/execute-batch0-recovery.cjs', 'workpulse-rehearsal.env'];
const protectedHashes = () => Object.fromEntries(protectedPaths.filter(p => fs.existsSync(p)).map(p => [p, digest(fs.readFileSync(p))]));
const original = protectedHashes();
const manifest = JSON.parse(fs.readFileSync('docs/releases/production-rehearsal-manifest.json', 'utf8'));
const profile = parseEnv(fs.readFileSync('workpulse-rehearsal.env', 'utf8'));
const supplied = new URL(profile.REHEARSAL_DATABASE_URL);
const direct = new URL(supplied);
direct.hostname = direct.hostname.replace('-pooler.', '.');
if (!['postgres:', 'postgresql:'].includes(direct.protocol) || !direct.hostname.endsWith('.neon.tech') || direct.pathname !== '/neondb' || (direct.searchParams.get('schema') || 'public') !== 'public') fail('INVALID_REHEARSAL_CONNECTION');
for (const p of ['.env', '.env.recovery.local']) {
  if (!fs.existsSync(p)) continue;
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(p, 'utf8')))) {
    if (!/DATABASE_URL$/.test(key) || !value) continue;
    const other = new URL(value);
    if (other.hostname.replace('-pooler.', '.') === direct.hostname) fail('PROTECTED_ENDPOINT_SELECTED');
  }
}
direct.searchParams.delete('options');
direct.searchParams.set('connect_timeout', '15');
const readUrl = new URL(direct);
readUrl.searchParams.set('options', '-c default_transaction_read_only=on -c statement_timeout=120000');
const reader = new PrismaClient({ datasources: { db: { url: readUrl.href } }, log: [] });
async function identity(db) {
  const [state] = await db.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id,current_setting('neon.parent_branch_id',true) AS parent_branch_id,current_setting('default_transaction_read_only') AS read_only`;
  if (state.branch_id !== branch || state.endpoint_id !== direct.hostname.split('.')[0] || state.database !== 'neondb' || state.schema !== 'public' || state.read_only !== 'on') fail('LIVE_REHEARSAL_IDENTITY_MISMATCH');
  return state;
}
async function history() { return reader.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM public."_prisma_migrations" ORDER BY migration_name,started_at`; }
function verifyFiles() {
  const local = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync(`prisma/migrations/${e.name}/migration.sql`)).map(e => e.name).sort();
  if (JSON.stringify(local) !== JSON.stringify(manifest.migrations.map(m => m.name).sort())) fail('MIGRATION_FILE_SET_CHANGED');
  for (const entry of [...manifest.migrations, ...manifest.staffImplementation]) if (digest(fs.readFileSync(entry.file)) !== entry.sha256) fail('REVIEWED_FILE_CHANGED');
}
function checkHistory(rows, complete = false) {
  if (rows.some(r => !r.finished && !r.rolled_back)) fail('UNRESOLVED_MIGRATION');
  const pending = [];
  for (const entry of manifest.migrations) {
    const applied = rows.filter(r => r.migration_name === entry.name && r.finished && !r.rolled_back);
    const sql = fs.readFileSync(entry.file, 'utf8');
    const hashes = [entry.sha256, digest(sql.replace(/\r\n/g, '\n')), digest(sql.replace(/\r?\n/g, '\r\n'))];
    if (applied.length > 1 || applied.some(r => !hashes.includes(r.checksum))) fail('APPLIED_CHECKSUM_MISMATCH');
    if (!applied.length) pending.push(entry.name);
  }
  if (rows.some(r => !r.rolled_back && !manifest.migrations.some(m => m.name === r.migration_name))) fail('UNKNOWN_APPLIED_MIGRATION');
  const expected = complete ? [] : manifest.migrations.filter(m => m.pendingAgainstCandidate).map(m => m.name);
  if (JSON.stringify(pending) !== JSON.stringify(expected)) fail('BASELINE_PENDING_SET_MISMATCH');
  return pending;
}
async function metadata() {
  return {
    columns: await reader.$queryRaw`SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`,
    constraints: await reader.$queryRaw`SELECT c.relname AS table_name,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname`,
    indexes: await reader.$queryRaw`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`,
    indexValidity: await reader.$queryRaw`SELECT c.relname AS index_name,i.indisvalid,i.indisready FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname`,
    functions: await reader.$queryRaw`SELECT p.proname,p.prosrc,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prorettype='trigger'::regtype ORDER BY p.proname`,
    triggers: await reader.$queryRaw`SELECT c.relname AS table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
    enums: await reader.$queryRaw`SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`
  };
}
function verifyCustomSchema(schema) {
  const sql = manifest.migrations.filter(m => m.pendingAgainstCandidate).map(m => fs.readFileSync(m.file, 'utf8')).join('\n');
  const triggers = [...sql.matchAll(/CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+"([^"]+)"/gi)].map(m => m[1]);
  const constraints = [...sql.matchAll(/\bCONSTRAINT\s+"([^"]+)"/gi)].map(m => m[1]);
  for (const name of triggers) if (!schema.triggers.some(t => t.tgname === name && ['O', 'A'].includes(t.tgenabled))) fail('CUSTOM_TRIGGER_MISSING_OR_DISABLED');
  for (const name of constraints) if (!schema.constraints.some(c => c.conname === name && c.convalidated)) fail('CUSTOM_CONSTRAINT_MISSING_OR_UNVALIDATED');
  for (const match of sql.matchAll(/CREATE\s+FUNCTION\s+"([^"]+)"\(\)[\s\S]*?AS\s+\$\$([\s\S]*?)\$\$/gi)) {
    const actual = schema.functions.find(f => f.proname === match[1]);
    if (!actual || actual.prosrc.replace(/\r\n/g, '\n').trim() !== match[2].replace(/\r\n/g, '\n').trim()) fail('CUSTOM_FUNCTION_BODY_MISMATCH');
  }
  if (schema.indexValidity.some(i => !i.indisvalid || !i.indisready)) fail('INVALID_INDEX');
  return { enabledReviewedTriggers: triggers.length, validatedReviewedConstraints: constraints.length, functionBodiesMatch: true, allIndexesValid: true };
}
async function command(args) {
  const env = { ...process.env, DATABASE_URL: direct.href, DIRECT_URL: direct.href, H10_TEST_DATABASE_URL: direct.href, NODE_OPTIONS: '', PRISMA_HIDE_UPDATE_MESSAGE: '1' };
  delete env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK;
  let output = '';
  const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', ...args], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
  const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  const diffSummary = args[0] === 'migrate' && args[1] === 'diff' ? output.split(/\r?\n/).filter(l => /^(\[|  |No difference)/.test(l) && !/postgres|:\/\/|@|password|credential/i.test(l)).map(l => l.replace(/[a-z0-9.-]+\.neon\.tech/gi, '[HOST]')) : undefined;
  return { exitCode, errorCodes: [...new Set(output.match(/\bP\d{4}\b/g) || [])], applied: output.split(/\r?\n/).filter(l => /^Applying migration `[a-z0-9_]+`$/.test(l)), emptyDiff: output.includes('No difference detected.'), diffSummary, outputHash: digest(output) };
}
async function main() {
  verifyFiles();
  const state = await identity(reader);
  if (process.argv[2] === 'verify') return verifyAfter(state);
  const rows = await history();
  save('preflight', { capturedAt: new Date().toISOString(), identity: state, history: rows, databaseWrites: false });
  console.log(JSON.stringify({ identity: state, ledgerEntries: rows.length, readOnlyPreflight: true }));
  const pending = checkHistory(rows);
  const before = await reader.$transaction(async tx => { await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'); return fingerprints(tx); }, { timeout: 180000 });
  save('before', { capturedAt: new Date().toISOString(), identity: state, ...before, metadata: await metadata(), pending });
  if (process.argv[2] !== 'deploy') { console.log(JSON.stringify({ pending: pending.length, protectedTables: before.tables.length, databaseWrites: false })); return; }
  verifyFiles(); await identity(reader); checkHistory(await history());
  if (JSON.stringify(original) !== JSON.stringify(protectedHashes())) fail('PROTECTED_CONFIGURATION_CHANGED');
  const started = Date.now();
  const deploy = await command(['migrate', 'deploy', '--schema', 'prisma/schema.prisma']);
  save('deploy', { capturedAt: new Date().toISOString(), branch, durationMs: Date.now() - started, ...deploy });
  if (deploy.exitCode !== 0) fail('REHEARSAL_DEPLOY_FAILED');
  return verifyAfter(state);
}
async function verifyAfter(state) {
  const before = JSON.parse(fs.readFileSync(`${directory}/before.json`, 'utf8'));
  if (before.identity.branch_id !== branch || before.identity.endpoint_id !== state.endpoint_id) fail('BASELINE_IDENTITY_MISMATCH');
  await identity(reader); const afterHistory = await history(); checkHistory(afterHistory, true);
  const after = await fingerprints(reader, before.columns);
  const changedTables = before.tables.filter(t => JSON.stringify(t) !== JSON.stringify(after.tables.find(a => a.table === t.table))).map(t => t.table);
  const schema = await metadata();
  save('after', { capturedAt: new Date().toISOString(), identity: state, ...after, history: afterHistory, metadata: schema, changedTables });
  if (changedTables.length) fail('HISTORICAL_RECORDS_CHANGED');
  const customSchema = verifyCustomSchema(schema);
  const diff = await command(['migrate', 'diff', '--from-url', readUrl.href, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code']);
  save('schema-diff', diff);
  const prismaSchemaMatches = diff.exitCode === 0 && diff.emptyDiff;
  const renamedIndexes = (diff.diffSummary || []).filter(l => /Renamed index/.test(l)).map(l => l.match(/Renamed index `([^`]+)` to `([^`]+)`/)).filter(Boolean).map(m => ({ existing: m[1], expected: m[2] }));
  const onlyIndexRenames = diff.exitCode === 2 && renamedIndexes.length > 0 && (diff.diffSummary || []).every(l => /^\[\*\] Changed the `[^`]+` table$/.test(l) || /^  \[\*\] Renamed index `[^`]+` to `[^`]+`$/.test(l));
  const driftPreexisting = onlyIndexRenames && renamedIndexes.every(i => {
    const prior = before.metadata.indexes.find(x => x.indexname === i.existing);
    const afterIndex = schema.indexes.find(x => x.indexname === i.existing);
    return prior && afterIndex && prior.indexdef === afterIndex.indexdef;
  });
  const result = { capturedAt: new Date().toISOString(), branch, passed: prismaSchemaMatches, migrationDeployPassed: true, recordPreservationPassed: true, appliedMigrations: before.pending.length, totalMigrations: manifest.migrations.length, preservedTables: before.tables.length, changedTables, prismaSchemaMatches, schemaDifference: diff.diffSummary, onlyIndexRenames, driftPreexisting, renamedIndexes, customSchema, configurationUnchanged: JSON.stringify(original) === JSON.stringify(protectedHashes()), snapshotProvenance: 'Not independently verified; this tests the user-designated isolated branch only.', productionReleaseApproved: false };
  save('result', result); console.log(JSON.stringify(result));
  if (!prismaSchemaMatches) fail('PRISMA_SCHEMA_DRIFT');
}
main().catch(error => { const code = /^[A-Z_]+$/.test(error.message) ? error.message : (/^P\d{4}$/.test(error.code || '') ? error.code : 'REHEARSAL_OPERATION_FAILED'); const diagnostics = { type: error.constructor.name, engineCode: error.errorCode, codes: [...new Set(String(error.message).match(/\b(?:P\d{4}|EPERM|EACCES|ENOTFOUND|ECONNREFUSED|ETIMEDOUT)\b/g) || [])], cannotReach: /Can't reach database server/.test(error.message), unsupportedStartupParameter: /unsupported startup parameter/.test(error.message), permissionDenied: /permission denied|operation not permitted|EPERM/i.test(error.message) }; save('failure', { capturedAt: new Date().toISOString(), branch, code, diagnostics, configurationUnchanged: JSON.stringify(original) === JSON.stringify(protectedHashes()) }); console.error(JSON.stringify({ code, diagnostics })); process.exitCode = 1; }).finally(async () => { await reader.$disconnect(); if (JSON.stringify(original) !== JSON.stringify(protectedHashes())) { console.error('PROTECTED_CONFIGURATION_CHANGED'); process.exitCode = 1; } });
