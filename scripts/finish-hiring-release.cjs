/* eslint-disable @typescript-eslint/no-require-imports -- Recovery-only release verification. */
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const migration = '20261022000100_hiring_document_policy';
const directory = 'docs/hiring-policy/release';
const save = (name, value) => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2)); };
async function main() {
  const config = helper.configuration();
  const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
  if (!config.identity.consoleMappingComplete || config.identity.endpointSha256 !== verified.identity.endpointSha256 || config.identity.branchId !== verified.identity.branchId || !verified.h10ChecksumMatch) throw Error('UNVERIFIED_RECOVERY_TARGET');
  const sql = fs.readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8');
  if (sql.replace(/--[^\r\n]*/g, '').trim() !== 'ALTER TABLE "Organization" ADD COLUMN "hiringDocumentRequirements" JSONB;') throw Error('UNEXPECTED_MIGRATION');
  const connections = [];
  for (const url of [config.pooled, config.direct]) {
    const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(url) } }, log: [] });
    try {
      const state = await db.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only`;
      if (state[0].database !== config.identity.database || state[0].schema !== 'public' || state[0].read_only !== 'on') throw Error('LIVE_TARGET_MISMATCH');
      const history = await db.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
      connections.push({ state, history });
    } finally { await db.$disconnect(); }
  }
  if (JSON.stringify(connections[0]) !== JSON.stringify(connections[1])) throw Error('CONNECTION_HISTORY_MISMATCH');
  const history = connections[0].history;
  for (const row of history.filter(row => !row.rolled_back)) {
    if (!row.finished) throw Error('UNFINISHED_MIGRATION');
    const bytes = fs.readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`);
    // Prisma accepts both checkout line-ending variants of an unchanged migration.
    if (![bytes, Buffer.from(bytes.toString().replace(/\r\n/g, '\n')), Buffer.from(bytes.toString().replace(/\r?\n/g, '\r\n'))].some(value => helper.digest(value) === row.checksum)) {
      console.log(JSON.stringify({ checksumMismatch: row.migration_name }));
      throw Error('MIGRATION_CHECKSUM_MISMATCH');
    }
  }
  const pending = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(entry => entry.isDirectory() && !history.some(row => row.migration_name === entry.name && row.finished && !row.rolled_back)).map(entry => entry.name);
  save('target', { capturedAt: new Date().toISOString(), identity: config.identity, connections, pending });
  console.log(JSON.stringify({ branch: config.identity.branchName, branchId: config.identity.branchId, endpointId: config.identity.endpointId, verifiedConnections: 2, applied: history.filter(row => row.finished && !row.rolled_back).length, pending }));
  if (process.argv[2] === 'apply') {
    if (!pending.includes(migration) || pending.some(name => ![migration, '20261021000100_candidate_access'].includes(name))) throw Error('UNEXPECTED_PENDING_MIGRATION');
    const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
    try {
      const before = await helper.fingerprints(db);
      save('data-before', before);
      // A scoped bundle lets Prisma apply ONLY Hiring, without applying Candidate Access.
      // Keep every applied migration so the existing history remains intact.
      const bundle = fs.mkdtempSync('.next/hiring-release-');
      fs.mkdirSync(`${bundle}/migrations`);
      fs.copyFileSync('prisma/schema.prisma', `${bundle}/schema.prisma`);
      fs.copyFileSync('prisma/migrations/migration_lock.toml', `${bundle}/migrations/migration_lock.toml`);
      const included = history.filter(row => row.finished && !row.rolled_back).map(row => row.migration_name).concat(migration);
      for (const name of included) fs.cpSync(`prisma/migrations/${name}`, `${bundle}/migrations/${name}`, { recursive: true });
      // Explicit child-process target only; no shell, dotenv edits or production fallback.
      const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', `${bundle}/schema.prisma`], { env: { ...config.environment, DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href }, encoding: 'utf8', windowsHide: true });
      save('migration', { migration, exitCode: result.status, output: (result.stdout + result.stderr).replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]') });
      if (result.status !== 0) throw Error('RECOVERY_MIGRATION_FAILED');
      const after = await helper.fingerprints(db, before.columns);
      const unchanged = JSON.stringify(before.tables) === JSON.stringify(after.tables);
      const column = await db.$queryRaw`SELECT data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='Organization' AND column_name='hiringDocumentRequirements'`;
      save('data-preservation', { tablesCompared: before.tables.length, existingDataUnchanged: unchanged, column, originalEnvUnchanged: true });
      if (!unchanged || column.length !== 1 || column[0].data_type !== 'jsonb' || column[0].is_nullable !== 'YES' || column[0].column_default !== null) throw Error('POST_MIGRATION_MISMATCH');
      console.log(JSON.stringify({ migrated: migration, tablesPreserved: before.tables.length, existingDataUnchanged: unchanged }));
    } finally { await db.$disconnect(); }
  }
  helper.assertOriginalUnchanged(config);
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: /^[A-Z_]+$/.test(error.message) ? error.message : undefined })); process.exitCode = 1; });
