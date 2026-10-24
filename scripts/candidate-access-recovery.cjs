/* eslint-disable @typescript-eslint/no-require-imports -- Identity-verified recovery migration and preservation checks only. */
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const directory = 'docs/uat/candidate-access';
const migration = '20261021000100_candidate_access';
const save = (name, value) => {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2));
};
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(`${helper.directory}/schema-and-history-verification.json`));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY_TARGET');
const sql = fs.readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8');
if (helper.digest(sql.replace(/\r\n/g, '\n')) !== '51c987efcad680b6e25053e795911098a42bded92d58e2b972e2bef5dd92771d') throw Error('UNEXPECTED_MIGRATION_SQL');

async function schema(db) {
  return {
    columns: await db.$queryRaw`SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='CandidateAccess' ORDER BY ordinal_position`,
    indexes: await db.$queryRaw`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='CandidateAccess' ORDER BY indexname`,
    foreignKeys: await db.$queryRaw`SELECT c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname='CandidateAccess' AND c.contype='f' ORDER BY c.conname`,
  };
}
function checkSchema(actual) {
  const names = ['applicationId', 'linkHash', 'linkExpiresAt', 'delivered', 'sessionHash', 'sessionExpiresAt', 'revoked', 'lastSentAt', 'windowStartedAt', 'sendCount'];
  const types = ['text', 'text', 'timestamp without time zone', 'boolean', 'text', 'timestamp without time zone', 'boolean', 'timestamp without time zone', 'timestamp without time zone', 'integer'];
  if (JSON.stringify(actual.columns.map(c => c.column_name)) !== JSON.stringify(names) || actual.columns.some((c, i) => c.data_type !== types[i])) throw Error('COLUMN_MISMATCH');
  if (actual.columns.some(c => c.is_nullable !== (['applicationId', 'delivered', 'revoked', 'windowStartedAt', 'sendCount'].includes(c.column_name) ? 'NO' : 'YES'))) throw Error('NULLABILITY_MISMATCH');
  if (actual.indexes.length !== 3 || actual.indexes.some(i => !i.indexdef.includes('UNIQUE INDEX')) || !['CandidateAccess_pkey', 'CandidateAccess_linkHash_key', 'CandidateAccess_sessionHash_key'].every(n => actual.indexes.some(i => i.indexname === n))) throw Error('INDEX_MISMATCH');
  if (actual.foreignKeys.length !== 1 || !actual.foreignKeys[0].definition.includes('REFERENCES "Application"(id) ON UPDATE CASCADE ON DELETE CASCADE')) throw Error('FOREIGN_KEY_MISMATCH');
}
async function main() {
  const mode = process.argv[2];
  if (!['preflight', 'apply', 'verify'].includes(mode)) throw Error('UNKNOWN_MODE');
  const histories = [];
  for (const url of [config.pooled, config.direct]) {
    const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(url) } }, log: [] });
    try {
      const state = await db.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only`;
      if (state[0].database !== config.identity.database || state[0].schema !== 'public' || state[0].read_only !== 'on') throw Error('TARGET_STATE_MISMATCH');
      histories.push(await db.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`);
    } finally { await db.$disconnect(); }
  }
  if (JSON.stringify(histories[0]) !== JSON.stringify(histories[1])) throw Error('CONNECTION_HISTORY_MISMATCH');
  const history = histories[0].filter(r => !r.rolled_back);
  for (const row of history) {
    const file = `prisma/migrations/${row.migration_name}/migration.sql`;
    if (!row.finished || !fs.existsSync(file)) throw Error('MIGRATION_HISTORY_MISMATCH');
    const bytes = fs.readFileSync(file, 'utf8');
    if (![bytes, bytes.replace(/\r\n/g, '\n'), bytes.replace(/\r?\n/g, '\r\n')].some(v => helper.digest(v) === row.checksum)) throw Error('MIGRATION_CHECKSUM_MISMATCH');
  }
  const local = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  const pending = local.filter(name => !history.some(r => r.migration_name === name));
  if (pending.some(name => name !== migration)) throw Error('UNEXPECTED_PENDING_MIGRATION');
  const applied = history.some(r => r.migration_name === migration);
  const db = new PrismaClient({ datasources: { db: { url: mode === 'apply' ? config.direct.href : helper.readOnly(config.direct) } }, log: [] });
  try {
    const parent = await db.$queryRaw`SELECT c.data_type,c.is_nullable FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='Application' AND c.column_name='id'`;
    const parentKey = await db.$queryRaw`SELECT pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c WHERE c.conrelid='public."Application"'::regclass AND c.contype='p'`;
    if (parent.length !== 1 || parent[0].data_type !== 'text' || parent[0].is_nullable !== 'NO' || parentKey[0]?.definition !== 'PRIMARY KEY (id)') throw Error('PARENT_DEPENDENCY_MISMATCH');
    const actual = await schema(db);
    if (applied) checkSchema(actual);
    else if (actual.columns.length || actual.indexes.length || actual.foreignKeys.length) throw Error('UNEXPECTED_EXISTING_CANDIDATE_OBJECTS');
    if (mode !== 'verify') save('preflight', { capturedAt: new Date().toISOString(), branchName: config.identity.branchName, identityMatched: true, connectionsVerified: 2, appliedCount: history.length, pending, migration, parent, parentKey, additiveSqlSha256: helper.digest(sql.replace(/\r\n/g, '\n')) });
    if (mode === 'apply' && !applied) {
      if (pending.length !== 1) throw Error('UNEXPECTED_PENDING_SET');
      const before = await helper.fingerprints(db);
      save('data-before', before);
      // Rehearse the exact unmodified SQL and constraint enforcement, then roll back.
      const rollback = Error('REHEARSAL_ROLLBACK');
      let rehearsed;
      try {
        await db.$transaction(async tx => {
          await tx.$executeRawUnsafe("SET LOCAL lock_timeout='5s'");
          for (const statement of sql.split(';').filter(s => s.trim())) await tx.$executeRawUnsafe(statement);
          rehearsed = await schema(tx); checkSchema(rehearsed);
          await tx.$executeRawUnsafe('SAVEPOINT candidate_fk_probe');
          let rejected = false;
          try { await tx.$executeRaw`INSERT INTO "CandidateAccess" ("applicationId") VALUES ('uat-nonexistent-parent-probe')`; }
          catch (e) { rejected = e.meta?.code === '23503'; }
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT candidate_fk_probe');
          if (!rejected) throw Error('ORPHAN_INSERT_NOT_REJECTED');
          throw rollback;
        }, { timeout: 60000 });
      } catch (e) { if (e !== rollback) throw e; }
      if ((await schema(db)).columns.length) throw Error('REHEARSAL_DID_NOT_ROLL_BACK');
      save('rehearsal', { passed: true, exactSqlRolledBack: true, orphanForeignKeyRejected: true, schema: rehearsed });
      // Only reviewed applied history and the sole missing migration enter this bundle.
      fs.mkdirSync('.next', { recursive: true });
      const bundle = fs.mkdtempSync('.next/candidate-access-release-');
      fs.mkdirSync(`${bundle}/migrations`);
      fs.copyFileSync('prisma/schema.prisma', `${bundle}/schema.prisma`);
      fs.copyFileSync('prisma/migrations/migration_lock.toml', `${bundle}/migrations/migration_lock.toml`);
      for (const name of history.map(r => r.migration_name).concat(migration)) fs.cpSync(`prisma/migrations/${name}`, `${bundle}/migrations/${name}`, { recursive: true });
      const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', `${bundle}/schema.prisma`], { env: { ...config.environment, DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href }, windowsHide: true, encoding: 'utf8' });
      save('migration', { migration, exitCode: result.status, output: `${result.stdout || ''}${result.stderr || ''}`.replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]') });
      if (result.status !== 0) throw Error('RECOVERY_MIGRATION_FAILED');
      checkSchema(await schema(db));
      const after = await helper.fingerprints(db, before.columns);
      const unchanged = JSON.stringify(before.tables) === JSON.stringify(after.tables);
      const empty = await db.candidateAccess.count() === 0;
      save('migration-preservation', { tablesCompared: before.tables.length, existingDataUnchanged: unchanged, candidateAccessEmpty: empty });
      if (!unchanged || !empty) throw Error('MIGRATION_PRESERVATION_FAILED');
    }
    if (mode === 'verify') {
      if (!applied || pending.length) throw Error('MIGRATION_STILL_PENDING');
      const before = JSON.parse(fs.readFileSync(`${directory}/data-before.json`));
      const after = await helper.fingerprints(db, before.columns);
      const unchanged = JSON.stringify(before.tables) === JSON.stringify(after.tables);
      const empty = await db.candidateAccess.count() === 0;
      const [tables] = await db.$queryRaw`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name<>'_prisma_migrations'`;
      save('final-preservation', { capturedAt: new Date().toISOString(), appliedCount: history.length, pending, schema: actual, tablesCompared: before.tables.length, applicationTableCount: tables.count, existingDataUnchanged: unchanged, candidateAccessEmptyAfterTests: empty, originalEnvUnchanged: true });
      if (!unchanged || !empty || tables.count !== before.tables.length + 1) throw Error('REGRESSION_PRESERVATION_FAILED');
    }
    helper.assertOriginalUnchanged(config);
    console.log(JSON.stringify({ mode, verifiedRecovery: true, appliedBeforeRun: history.length, pendingBeforeRun: pending, passed: true }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: /^[A-Z_]+$/.test(error.message) ? error.message : undefined })); process.exitCode = 1; });
