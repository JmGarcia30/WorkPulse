/* eslint-disable @typescript-eslint/no-require-imports -- Authorized read-only production dump; writes are pinned to a new isolated branch. */
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { fingerprints } = require('./batch0-recovery-environment.cjs');
const directory = 'docs/payroll-v2/review';
const privateDirectory = path.resolve('storage/payroll-v2-review');
const toolsDirectory = path.join(privateDirectory, 'pg-client');
const sourceUrl = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
const targetProfile = parseEnv(fs.readFileSync('.env.payroll-v2-rehearsal.local', 'utf8'));
const targetUrl = new URL(targetProfile.DATABASE_URL);
const sourceBranch = 'br-hidden-violet-azjl3vam', targetBranch = 'br-lingering-dawn-azrdk13o';
const sourceEndpoint = 'ep-weathered-mouse-azpx765h';
const normalized = url => url.hostname.replace('-pooler.', '.');
if (normalized(sourceUrl).split('.')[0] !== sourceEndpoint || targetProfile.PAYROLL_REHEARSAL_BRANCH !== targetBranch || normalized(sourceUrl) === normalized(targetUrl)) throw Error('UNVERIFIED_COPY_TARGET');
sourceUrl.hostname = normalized(sourceUrl); targetUrl.hostname = normalized(targetUrl);
sourceUrl.searchParams.set('options', '-c default_transaction_read_only=on -c statement_timeout=300000');
targetUrl.searchParams.set('connect_timeout', '30');
const source = new PrismaClient({ datasources: { db: { url: sourceUrl.href } }, log: [] });
const target = new PrismaClient({ datasources: { db: { url: targetUrl.href } }, log: [] });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const protectedFiles = ['.env', '.env.recovery.local', '.env.payroll-v2.local'];
const protectedHashes = () => Object.fromEntries(protectedFiles.map(file => [file, digest(fs.readFileSync(file))]));
const beforeFiles = protectedHashes();
function save(name, value) { fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2)); }
function pgEnvironment(url, readOnly) {
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '30', PGOPTIONS: readOnly ? '-c default_transaction_read_only=on -c statement_timeout=300000' : '-c statement_timeout=300000' };
}
function run(name, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(toolsDirectory, name + '.exe'), args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject); child.once('exit', code => {
      if (code) { fs.writeFileSync(path.join(privateDirectory, name + '-error.log'), stderr); reject(Error(name.toUpperCase() + '_FAILED_' + code)); }
      else resolve(stdout);
    });
  });
}
async function identity(db, branch, readOnly) {
  const [state] = await db.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id,current_setting('default_transaction_read_only') AS read_only`;
  if (state.branch_id !== branch || state.schema !== 'public' || (readOnly && state.read_only !== 'on')) throw Error('LIVE_COPY_IDENTITY_MISMATCH');
  return state;
}
async function schemaMetadata(db) {
  return {
    constraints: await db.$queryRaw`SELECT c.relname AS table_name,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname`,
    triggers: await db.$queryRaw`SELECT c.relname AS table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
    functions: await db.$queryRaw`SELECT p.proname,p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prorettype='trigger'::regtype ORDER BY p.proname`,
    indexes: await db.$queryRaw`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`,
    enums: await db.$queryRaw`SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
  };
}
async function compareSchema(original, restored) {
  const differences = [];
  const normalized = structuredClone(restored);
  for (const constraint of original.constraints) {
    const copy = normalized.constraints.find(row => row.table_name === constraint.table_name && row.conname === constraint.conname);
    if (!copy || JSON.stringify(copy) === JSON.stringify(constraint)) continue;
    // PostgreSQL's dump/reparse flattens an associative AND group in this existing CHECK.
    // Permit only this named, otherwise identical expression and prove boundary/null truth equivalence.
    if (constraint.table_name !== 'WorkScheduleBreak' || constraint.conname !== 'WorkScheduleBreak_range_check'
      || copy.definition.replace(/[()]/g, '') !== constraint.definition.replace(/[()]/g, '') || /\bOR\b/.test(copy.definition)) continue;
    const left = constraint.definition.replace(/^CHECK /, ''), right = copy.definition.replace(/^CHECK /, '');
    const [probe] = await target.$queryRawUnsafe(`SELECT bool_and((${left}) IS NOT DISTINCT FROM (${right})) AS equivalent, count(*)::int AS cases FROM (VALUES (NULL::integer),(-1),(0),(1),(86399),(86400),(86401)) a("startSecond") CROSS JOIN (VALUES (NULL::integer),(-1),(0),(1),(86399),(86400),(86401)) b("endSecond")`);
    if (!probe.equivalent || probe.cases !== 49) throw Error('CHECK_SEMANTICS_CHANGED');
    differences.push({ table: constraint.table_name, constraint: constraint.conname, source: constraint.definition, restored: copy.definition, equivalent: true, boundaryAndNullCases: probe.cases });
    copy.definition = constraint.definition;
  }
  return { compatible: JSON.stringify(original) === JSON.stringify(normalized), textIdentical: JSON.stringify(original) === JSON.stringify(restored), differences };
}
async function verifyRestored(sourceEvidence, targetIdentity) {
  const restored = await fingerprints(target, sourceEvidence.baseline.columns);
  const schema = await schemaMetadata(target);
  const comparison = await compareSchema(sourceEvidence.schema, schema);
  const dataMatches = JSON.stringify(restored.tables) === JSON.stringify(sourceEvidence.baseline.tables);
  const filesUnchanged = JSON.stringify(beforeFiles) === JSON.stringify(protectedHashes());
  const evidence = { passed: dataMatches && comparison.compatible && filesUnchanged, identity: targetIdentity, sourceReadOnly: true, sourceSnapshotDumpSha256: sourceEvidence.dumpSha256, dataMatches, schemaMatches: comparison.compatible, schemaTextIdentical: comparison.textIdentical, schemaEquivalenceProbes: comparison.differences, protectedFilesUnchanged: filesUnchanged, appTableCount: restored.tables.length, rowFingerprints: restored.tables, schema, rawDumpLocation: 'Ignored private storage only; not included in review artifacts', note: 'Object ownership and ACLs intentionally use isolated database role; app schema/constraints/functions/triggers/indexes/enums and all app rows compared separately.' };
  save('production-copy-verified', evidence);
  if (!evidence.passed) throw Error('PRODUCTION_COPY_COMPARISON_FAILED');
  console.log(JSON.stringify({ passed: true, appTableCount: restored.tables.length, sourceReadOnly: true, targetBranch, dataMatches, schemaMatches: comparison.compatible, schemaTextIdentical: comparison.textIdentical, equivalenceProbes: comparison.differences.length, protectedFilesUnchanged: filesUnchanged }));
}
async function main() {
  const targetIdentity = await identity(target, targetBranch, false);
  if (process.argv.includes('--verify-restored')) {
    const saved = JSON.parse(fs.readFileSync(`${directory}/production-copy-source.json`, 'utf8'));
    if (saved.sourceIdentity.branch_id !== sourceBranch || saved.targetIdentity.branch_id !== targetBranch) throw Error('UNVERIFIED_RESTORED_COPY');
    return verifyRestored(saved, targetIdentity);
  }
  const tables = await target.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
  if (tables.length) throw Error('RESTORE_REQUIRES_NEW_EMPTY_TEST_DATABASE');
  const dumpPath = path.join(privateDirectory, 'production.dump');
  let sourceEvidence;
  if (process.argv.includes('--restore-existing-dump')) {
    sourceEvidence = JSON.parse(fs.readFileSync(`${directory}/production-copy-source.json`, 'utf8'));
    if (sourceEvidence.sourceIdentity.branch_id !== sourceBranch || sourceEvidence.targetIdentity.branch_id !== targetBranch || sourceEvidence.dumpSha256 !== digest(fs.readFileSync(dumpPath))) throw Error('UNVERIFIED_EXISTING_DUMP');
  } else {
    if (fs.existsSync(dumpPath)) throw Error('PROTECTED_DUMP_ALREADY_EXISTS');
    await source.$transaction(async tx => {
    const sourceIdentity = await identity(tx, sourceBranch, true);
    if (sourceIdentity.endpoint_id !== sourceEndpoint) throw Error('WRONG_PRODUCTION_ENDPOINT');
    const [snapshot] = await tx.$queryRaw`SELECT pg_export_snapshot() AS snapshot`;
    const baseline = await fingerprints(tx);
    const schema = await schemaMetadata(tx);
    const migrations = await tx.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
    await run('pg_dump', ['--format=custom', '--compress=6', '--no-owner', '--no-acl', '--schema=public', '--snapshot=' + snapshot.snapshot, '--file=' + dumpPath], pgEnvironment(sourceUrl, true));
    sourceEvidence = { capturedAt: new Date().toISOString(), sourceIdentity, targetIdentity, snapshotConsistency: 'Production hashes and pg_dump share one exported REPEATABLE READ snapshot', sourceReadOnly: true, productionSqlMutations: 0, baseline, schema, migrations, dumpSha256: digest(fs.readFileSync(dumpPath)), dumpBytes: fs.statSync(dumpPath).size };
    save('production-copy-source', sourceEvidence);
    }, { isolationLevel: 'RepeatableRead', timeout: 600000 });
  }
  // A schema-filtered dump omits extension installation; restore the source's extension prerequisites first.
  await identity(source, sourceBranch, true);
  const extensions = await source.$queryRaw`SELECT e.extname,e.extversion,n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname<>'plpgsql' ORDER BY e.extname`;
  for (const extension of extensions) {
    if (!['btree_gist', 'pgcrypto', 'citext', 'uuid-ossp', 'pg_trgm', 'vector'].includes(extension.extname) || extension.schema !== 'public' || !/^[0-9.]+$/.test(extension.extversion)) throw Error('UNREVIEWED_EXTENSION_DEPENDENCY');
    await identity(target, targetBranch, false);
    await target.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS "' + extension.extname + '" WITH SCHEMA public VERSION \'' + extension.extversion + '\'');
  }
  save('production-copy-extensions', { sourceReadOnly: true, targetBranch, extensions, reason: 'Initial all-or-nothing restore identified btree_gist prerequisite; no source rows or schema were modified.' });
  const listing = await run('pg_restore', ['--list', dumpPath], pgEnvironment(targetUrl, false));
  const restoreList = path.join(privateDirectory, 'restore.list');
  // The empty target already has the standard public namespace. Restore every contained app object.
  fs.writeFileSync(restoreList, listing.split(/\r?\n/).filter(line => !/^\d+;.*\bSCHEMA - public\b/.test(line)).join('\n'));
  await run('pg_restore', ['--no-owner', '--no-acl', '--single-transaction', '--exit-on-error', '--dbname=' + decodeURIComponent(targetUrl.pathname.slice(1)), '--use-list=' + restoreList, dumpPath], pgEnvironment(targetUrl, false));
  await verifyRestored(sourceEvidence, targetIdentity);
}
main().catch(error => { console.error(error.code || error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED]')); process.exitCode = 1; }).finally(async () => { await source.$disconnect(); await target.$disconnect(); });
