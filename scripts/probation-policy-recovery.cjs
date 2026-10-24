/* eslint-disable @typescript-eslint/no-require-imports -- Recovery-only additive migration. */
const fs = require('node:fs'), { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const migration = '20261022000200_organization_probation_policy';
const directory = 'docs/probation-policy';
const save = (name, value) => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2)); };
async function main() {
  const config = helper.configuration();
  const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
  if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY_TARGET');
  const sql = fs.readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8').replace(/--[^\r\n]*/g, '').trim().replace(/\s+/g, ' ');
  if (sql !== 'ALTER TABLE "Organization" ADD COLUMN "probationPolicy" JSONB; ALTER TABLE "Offer" ADD COLUMN "probationPolicySnapshot" JSONB;') throw Error('UNEXPECTED_MIGRATION');
  const connections = [];
  for (const url of [config.pooled, config.direct]) {
    const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(url) } }, log: [] });
    try {
      const state = await db.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only`;
      if (state[0].database !== config.identity.database || state[0].schema !== 'public' || state[0].read_only !== 'on') throw Error('TARGET_STATE_MISMATCH');
      const history = await db.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
      connections.push({ state, history });
    } finally { await db.$disconnect(); }
  }
  if (JSON.stringify(connections[0]) !== JSON.stringify(connections[1])) throw Error('CONNECTION_HISTORY_MISMATCH');
  const history = connections[0].history.filter(row => !row.rolled_back);
  for (const row of history) {
    const bytes = fs.readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`);
    if (!row.finished || ![bytes, Buffer.from(bytes.toString().replace(/\r\n/g, '\n')), Buffer.from(bytes.toString().replace(/\r?\n/g, '\r\n'))].some(value => helper.digest(value) === row.checksum)) throw Error('MIGRATION_HISTORY_MISMATCH');
  }
  const pending = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(entry => entry.isDirectory() && !history.some(row => row.migration_name === entry.name)).map(entry => entry.name);
  save('target', { identity: config.identity, connections, pending });
  console.log(JSON.stringify({ verifiedBranch: config.identity.branchId, endpoint: config.identity.endpointId, pending }));
  if (process.argv[2] !== 'apply' || !pending.includes(migration)) return;
  if (pending.some(name => ![migration, '20261021000100_candidate_access'].includes(name))) throw Error('UNEXPECTED_PENDING_MIGRATION');
  const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  try {
    const before = await helper.fingerprints(db);
    save('data-before', before);
    const bundle = fs.mkdtempSync('.next/probation-release-');
    fs.mkdirSync(`${bundle}/migrations`);
    fs.copyFileSync('prisma/schema.prisma', `${bundle}/schema.prisma`);
    fs.copyFileSync('prisma/migrations/migration_lock.toml', `${bundle}/migrations/migration_lock.toml`);
    for (const name of history.map(row => row.migration_name).concat(migration)) fs.cpSync(`prisma/migrations/${name}`, `${bundle}/migrations/${name}`, { recursive: true });
    const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', `${bundle}/schema.prisma`], { env: { ...config.environment, DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href }, windowsHide: true, encoding: 'utf8' });
    save('migration', { migration, exitCode: result.status, output: (result.stdout + result.stderr).replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]') });
    if (result.status !== 0) throw Error('RECOVERY_MIGRATION_FAILED');
    const after = await helper.fingerprints(db, before.columns);
    const unchanged = JSON.stringify(before.tables) === JSON.stringify(after.tables);
    save('data-preservation', { existingDataUnchanged: unchanged, tablesCompared: before.tables.length });
    if (!unchanged) throw Error('EXISTING_DATA_CHANGED');
    helper.assertOriginalUnchanged(config);
    console.log(JSON.stringify({ migrationApplied: migration, tablesPreserved: before.tables.length }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error.code || error.name, /^[A-Z_]+$/.test(error.message) ? error.message : ''); process.exitCode = 1; });
