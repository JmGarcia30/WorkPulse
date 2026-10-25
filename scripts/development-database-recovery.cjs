/* eslint-disable @typescript-eslint/no-require-imports -- Branch-scoped development recovery. */
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const mode = process.argv[2] || 'checkpoint';
const read = name => JSON.parse(fs.readFileSync(helper.directory + '/' + name + '.json', 'utf8'));
const normalized = url => url.hostname.replace('-pooler.', '.');
const protectedUrl = new URL(require('node:util').parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
const checkpoint = new URL(config.profile.WORKPULSE_TEST_NEON_CHECKPOINT_DATABASE_URL);
const checkpointId = config.profile.WORKPULSE_TEST_NEON_CHECKPOINT_BRANCH_ID;
const checkpointEndpoint = config.profile.WORKPULSE_TEST_NEON_CHECKPOINT_ENDPOINT_ID;
const checkpointParent = config.profile.WORKPULSE_TEST_NEON_CHECKPOINT_PARENT_BRANCH_ID;
if (config.identity.branchName !== 'workpulse-ess-design' || config.identity.branchId !== 'br-damp-fog-azmmxhga' || config.identity.endpointId !== 'ep-wild-mud-az8yzifu') helper.fail('UNEXPECTED_DEVELOPMENT_TARGET');
if (!/^br-[a-z0-9-]+$/.test(checkpointId || '') || checkpointId === config.identity.branchId || checkpointParent !== config.identity.branchId) helper.fail('CHECKPOINT_PARENT_MISMATCH');
if (!['postgres:', 'postgresql:'].includes(checkpoint.protocol) || !checkpoint.hostname.endsWith('.neon.tech') || normalized(checkpoint).split('.')[0] !== checkpointEndpoint || checkpoint.pathname !== config.direct.pathname || (checkpoint.searchParams.get('schema') || 'public') !== 'public') helper.fail('INVALID_CHECKPOINT_TARGET');
if ([normalized(protectedUrl), normalized(config.direct)].includes(normalized(checkpoint))) helper.fail('PROTECTED_OR_DEVELOPMENT_CHECKPOINT_ENDPOINT');
const checkpointDirect = new URL(checkpoint);
checkpointDirect.hostname = normalized(checkpointDirect);
const client = url => new PrismaClient({ datasources: { db: { url: helper.readOnly(url) } }, log: [] });
async function identity(db, branchId, endpointId) {
  const [state] = await db.$queryRaw`SELECT current_database() AS database, current_schema() AS schema, current_setting('default_transaction_read_only') AS read_only, current_setting('neon.branch_id',true) AS branch_id, current_setting('neon.endpoint_id',true) AS endpoint_id, current_setting('neon.parent_branch_id',true) AS parent_branch_id`;
  if (state.branch_id !== branchId || state.endpoint_id !== endpointId || state.database !== config.identity.database || state.schema !== 'public' || state.read_only !== 'on') helper.fail('LIVE_IDENTITY_MISMATCH');
  if (branchId === checkpointId && state.parent_branch_id && state.parent_branch_id !== checkpointParent) helper.fail('LIVE_CHECKPOINT_PARENT_MISMATCH');
  return state;
}
async function history(db) {
  return db.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
}
async function schema(db) {
  return db.$queryRaw`SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`;
}
async function verifyCheckpoint() {
  const development = client(config.direct), saved = client(checkpointDirect), supplied = client(checkpoint);
  try {
    const developmentState = await identity(development, config.identity.branchId, config.identity.endpointId);
    const checkpointState = await identity(saved, checkpointId, checkpointEndpoint);
    const suppliedState = await identity(supplied, checkpointId, checkpointEndpoint);
    const developmentHistory = await history(development), checkpointHistory = await history(saved);
    if (JSON.stringify(developmentHistory) !== JSON.stringify(checkpointHistory)) helper.fail('CHECKPOINT_HISTORY_MISMATCH');
    if (developmentHistory.some(m => !m.finished && !m.rolled_back)) helper.fail('UNRESOLVED_MIGRATION');
    const developmentSchema = await schema(development), checkpointSchema = await schema(saved);
    if (JSON.stringify(developmentSchema) !== JSON.stringify(checkpointSchema)) helper.fail('CHECKPOINT_SCHEMA_MISMATCH');
    const before = await helper.fingerprints(development), copy = await helper.fingerprints(saved, before.columns);
    if (JSON.stringify(before.tables) !== JSON.stringify(copy.tables)) helper.fail('CHECKPOINT_DATA_MISMATCH');
    helper.assertOriginalUnchanged(config);
    const evidence = { capturedAt: new Date().toISOString(), identity: config.identity, developmentState, checkpointState, suppliedState, checkpointBranchId: checkpointId, checkpointEndpointId: checkpointEndpoint, checkpointParentBranchId: checkpointParent, parentEvidence: checkpointState.parent_branch_id ? 'Live SQL and user-supplied Console metadata' : 'User-confirmed Console metadata; parent is not exposed by SQL', suppliedConnectionPooled: checkpoint.hostname.includes('-pooler.'), directConnectionVerified: true, identicalMigrationHistory: true, identicalSchema: true, identicalExistingRecords: true, protectedTables: before.tables.length, migrationHistory: developmentHistory, recoveryReady: true, checkpointWritesPerformed: false, recreation: 'Create a replacement development child from this retained checkpoint via Neon Console. Never reset or restore production.', recreationRehearsal: 'Read-only recovery-source identity, schema, migration history, and all original-column table fingerprints verified. No destructive restore or branch creation was performed.', originalEnvUnchanged: true };
    helper.save('development-checkpoint-verification', evidence);
    const baselinePath = helper.directory + '/development-protected-data-before.json';
    if (fs.existsSync(baselinePath)) helper.fail('DEVELOPMENT_BASELINE_ALREADY_EXISTS');
    helper.save('development-protected-data-before', { identity: config.identity, capturedAt: new Date().toISOString(), ...before });
    console.log(JSON.stringify({ checkpoint: 'PASS', checkpointBranchId: checkpointId, checkpointEndpointId: checkpointEndpoint, checkpointParentBranchId: checkpointParent, directConnectionVerified: true, recoveryReady: true, protectedTables: before.tables.length }));
  } finally {
    await Promise.all([development.$disconnect(), saved.$disconnect(), supplied.$disconnect()]);
    helper.assertOriginalUnchanged(config);
  }
}
function assertEvidence(evidence) {
  for (const key of ['branchName', 'branchId', 'endpointId', 'endpointSha256', 'checkpointBranchId', 'originalEnvSha256']) {
    if (evidence.identity[key] !== config.identity[key]) helper.fail('RECOVERY_EVIDENCE_IDENTITY_CHANGED');
  }
}
async function run(name, args) {
  const env = { ...config.environment, DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href };
  const child = spawn(process.execPath, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data; });
  const exitCode = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
  const result = { capturedAt: new Date().toISOString(), identity: config.identity, name, exitCode, errorCodes: [...new Set(output.match(/\b(?:P\d{4}|EPERM|EACCES|ENOENT)\b/g) || [])], summary: output.split(/\r?\n/).filter(line => /^(Applying migration|All migrations|The following migration|Generated Prisma Client|✔ Generated Prisma Client|Error:|\{"verification")/.test(line)).map(line => line.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]')) };
  helper.save(name, result);
  helper.assertOriginalUnchanged(config);
  console.log(JSON.stringify({ name, exitCode, errorCodes: result.errorCodes, summary: result.summary }));
  if (exitCode !== 0) helper.fail('RECOVERY_COMMAND_FAILED');
}
async function verifyData() {
  const baseline = read('development-protected-data-before');
  const source = read('development-checkpoint-verification');
  assertEvidence(baseline); assertEvidence(source);
  const development = client(config.direct), saved = client(checkpointDirect);
  try {
    await identity(development, config.identity.branchId, config.identity.endpointId);
    await identity(saved, checkpointId, checkpointEndpoint);
    const after = await helper.fingerprints(development, baseline.columns);
    const retained = await helper.fingerprints(saved, baseline.columns);
    const changedDevelopmentTables = baseline.tables.filter(table => JSON.stringify(table) !== JSON.stringify(after.tables.find(t => t.table === table.table))).map(t => t.table);
    const changedCheckpointTables = baseline.tables.filter(table => JSON.stringify(table) !== JSON.stringify(retained.tables.find(t => t.table === table.table))).map(t => t.table);
    const checkpointHistoryUnchanged = JSON.stringify(await history(saved)) === JSON.stringify(source.migrationHistory);
    helper.save('development-protected-data-after', { capturedAt: new Date().toISOString(), identity: config.identity, ...after, changedDevelopmentTables, changedCheckpointTables, checkpointHistoryUnchanged, originalEnvUnchanged: true });
    if (changedDevelopmentTables.length || changedCheckpointTables.length || !checkpointHistoryUnchanged) helper.fail('PROTECTED_RECORDS_CHANGED');
    console.log(JSON.stringify({ protectedData: 'PASS', unchangedTables: baseline.tables.length, checkpointUnchanged: true }));
  } finally { await Promise.all([development.$disconnect(), saved.$disconnect()]); helper.assertOriginalUnchanged(config); }
}
async function migrate() {
  const evidence = read('development-checkpoint-verification'), baseline = read('development-protected-data-before');
  assertEvidence(evidence); assertEvidence(baseline);
  if (!evidence.recoveryReady || evidence.checkpointBranchId !== checkpointId || evidence.checkpointEndpointId !== checkpointEndpoint || evidence.checkpointParentBranchId !== checkpointParent) helper.fail('UNVERIFIED_CHECKPOINT');
  const review = read('development-recovery-preflight');
  const reviewed = Object.keys(review.pendingMigrationSha256).sort();
  if (reviewed.length !== 11) helper.fail('UNEXPECTED_REVIEWED_MIGRATION_COUNT');
  const development = client(config.direct);
  try {
    await identity(development, config.identity.branchId, config.identity.endpointId);
    const migrations = await history(development);
    if (migrations.some(m => !m.finished && !m.rolled_back)) helper.fail('UNRESOLVED_MIGRATION');
    const local = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync('prisma/migrations/' + e.name + '/migration.sql')).map(e => e.name).sort();
    const pending = [];
    for (const name of local) {
      const bytes = fs.readFileSync('prisma/migrations/' + name + '/migration.sql'), sql = bytes.toString();
      const applied = migrations.filter(m => m.migration_name === name && m.finished && !m.rolled_back);
      const hashes = [helper.digest(bytes), helper.digest(sql.replace(/\r\n/g, '\n')), helper.digest(sql.replace(/\r?\n/g, '\r\n'))];
      if (applied.some(m => !hashes.includes(m.checksum))) helper.fail('APPLIED_MIGRATION_CHECKSUM_MISMATCH');
      if (!applied.length) {
        pending.push(name);
        if (review.pendingMigrationSha256[name] !== helper.digest(bytes)) helper.fail('REVIEWED_MIGRATION_CHANGED');
      }
    }
    if (JSON.stringify(pending) !== JSON.stringify(reviewed)) helper.fail('UNEXPECTED_PENDING_MIGRATIONS');
    // Recheck the complete retained recovery source and original development records immediately before deployment.
    await verifyData();
    helper.save('development-migration-authorization', { capturedAt: new Date().toISOString(), identity: config.identity, checkpointBranchId: checkpointId, checkpointParentBranchId: checkpointParent, checkpointEndpointId: checkpointEndpoint, basis: 'User authorized these eleven reviewed migrations on workpulse-ess-design after checkpoint verification.', reviewedMigrations: pending, reviewedSha256: review.pendingMigrationSha256, checkpointWritesAllowed: false, productionAccessAllowed: false });
    await run('development-migration-deploy', ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma']);
    const after = await history(development);
    for (const name of reviewed) {
      if (!after.some(m => m.migration_name === name && m.finished && !m.rolled_back && m.checksum === review.pendingMigrationSha256[name])) helper.fail('MIGRATION_APPLICATION_NOT_VERIFIED');
    }
    await verifyData();
    // Finalize in a separate invocation after this process releases its Windows engine DLL.
    console.log(JSON.stringify({ migrationsApplied: reviewed.length, nextCommand: 'node scripts/development-database-recovery.cjs finalize' }));
  } finally { await development.$disconnect(); helper.assertOriginalUnchanged(config); }
}
async function finalize() {
  const deploy = read('development-migration-deploy');
  assertEvidence(deploy);
  if (deploy.exitCode !== 0) helper.fail('MIGRATION_DEPLOY_NOT_SUCCESSFUL');
  // On Windows, regenerate before loading the native query engine in this process.
  await run('development-prisma-generate', ['node_modules/prisma/build/index.js', 'generate', '--schema', 'prisma/schema.prisma']);
  await run('development-prisma-validation', ['node_modules/prisma/build/index.js', 'validate', '--schema', 'prisma/schema.prisma']);
  await run('development-connection-refresh', ['scripts/batch0-recovery-environment.cjs']);
  await run('development-schema-verification', ['scripts/execute-batch0-recovery.cjs', 'verify-startup']);
  const db = client(config.direct);
  try {
    await identity(db, config.identity.branchId, config.identity.endpointId);
    const applied = await history(db), review = read('development-recovery-preflight');
    for (const [name, checksum] of Object.entries(review.pendingMigrationSha256)) {
      if (helper.digest(fs.readFileSync('prisma/migrations/' + name + '/migration.sql')) !== checksum || !applied.some(m => m.migration_name === name && m.finished && !m.rolled_back && m.checksum === checksum)) helper.fail('MIGRATION_APPLICATION_NOT_VERIFIED');
    }
    await verifyData();
    helper.save('development-migration-completion', { capturedAt: new Date().toISOString(), identity: config.identity, appliedMigrations: Object.keys(review.pendingMigrationSha256), appliedCount: applied.filter(m => m.finished && !m.rolled_back).length, preservedOriginalTables: read('development-protected-data-before').tables.length, checkpointUnchanged: true, prismaClientRegenerated: true, startupSchemaVerified: true, originalEnvUnchanged: true });
  } finally { await db.$disconnect(); }
}
async function main() {
  if (mode === 'checkpoint') return verifyCheckpoint();
  if (mode === 'migrate') return migrate();
  if (mode === 'verify-data') return verifyData();
  if (mode === 'finalize') return finalize();
  helper.fail('UNKNOWN_MODE');
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: /^[A-Z_]+$/.test(error.message) ? error.message : undefined })); process.exitCode = 1; });
