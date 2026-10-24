/* eslint-disable @typescript-eslint/no-require-imports -- Verified isolated recovery test runner. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const directory = 'docs/platform-admin-phase-1';
const migration = '20261023000100_platform_administration';
const save = (name, value) => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2)); };
async function main() {
  const config = helper.configuration();
  const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
  if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY_TARGET');
  const states = [];
  for (const url of [config.pooled, config.direct]) {
    const reader = new PrismaClient({ datasources: { db: { url: helper.readOnly(url) } }, log: [] });
    try {
      const [state] = await reader.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only`;
      if (state.database !== config.identity.database || state.schema !== 'public' || state.read_only !== 'on') throw Error('TARGET_STATE_MISMATCH');
      const history = await reader.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
      states.push({ state, history });
    } finally { await reader.$disconnect(); }
  }
  if (JSON.stringify(states[0]) !== JSON.stringify(states[1])) throw Error('RECOVERY_CONNECTION_HISTORY_MISMATCH');
  const history = states[0].history.filter(row => !row.rolled_back);
  for (const row of history) {
    const bytes = fs.readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`);
    if (!row.finished || ![bytes, Buffer.from(bytes.toString().replace(/\r\n/g, '\n')), Buffer.from(bytes.toString().replace(/\r?\n/g, '\r\n'))].some(value => helper.digest(value) === row.checksum)) throw Error('MIGRATION_HISTORY_MISMATCH');
  }
  const mode = process.argv[2];
  Object.assign(process.env, config.environment);
  save('target', { identity: config.identity, verified: true });
  console.log('Verified isolated recovery:', config.identity.branchId);
  const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  const before = await helper.fingerprints(db);
  try {
    if (mode === 'migrate' || mode === 'build') {
      let args, environment = { ...config.environment, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct) };
      if (mode === 'migrate') {
        const bundle = fs.mkdtempSync('.next/platform-admin-migration-');
        fs.mkdirSync(`${bundle}/migrations`);
        fs.copyFileSync('prisma/schema.prisma', `${bundle}/schema.prisma`);
        fs.copyFileSync('prisma/migrations/migration_lock.toml', `${bundle}/migrations/migration_lock.toml`);
        for (const name of [...new Set(history.map(row => row.migration_name).concat(migration))]) fs.cpSync(`prisma/migrations/${name}`, `${bundle}/migrations/${name}`, { recursive: true });
        args = ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', `${bundle}/schema.prisma`];
        environment = { ...environment, DATABASE_URL: config.direct.href };
      } else args = ['node_modules/next/dist/bin/next', 'build', '--webpack'];
      const result = spawnSync(process.execPath, args, { env: environment, windowsHide: true, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      const output = ((result.stdout || '') + (result.stderr || '')).replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]');
      save(mode, { exitCode: result.status, output }); console.log(output);
      if (result.status !== 0) throw Error('CHECK_FAILED');
    } else if (mode === 'test') {
      require('tsx/cjs');
      const original = Module._load;
      const context = { headers: new Headers({ host: 'localhost:3000' }), jar: new Map() };
      Module._load = function(name, parent, main) {
        if (name === 'server-only') return {};
        if (name === 'next/headers') return { headers: async () => context.headers, cookies: async () => ({ get: key => context.jar.get(key), set: (key, value, options) => context.jar.set(key, { value, ...options }), delete: key => context.jar.delete(key) }) };
        if (name === 'next/navigation') return { redirect: target => { throw Error('REDIRECT:' + target); }, notFound: () => { throw Error('NOT_FOUND'); } };
        if (name === 'next/cache') return { revalidatePath: () => {} };
        if (name === '@/lib/db/prisma') return { prisma: db };
        if (name.startsWith('@/')) return original.call(this, path.resolve('src', name.slice(2)), parent, main);
        return original.call(this, name, parent, main);
      };
      try { save('tests', await require('./test-platform-admin.cjs')(db, context)); }
      finally { Module._load = original; }
    } else throw Error('EXPECTED_MIGRATE_TEST_OR_BUILD');
  } finally {
    try {
      const after = await helper.fingerprints(db, before.columns);
      const unchanged = JSON.stringify(before.tables) === JSON.stringify(after.tables);
      save(`${mode}-preservation`, { existingDataUnchanged: unchanged, tablesCompared: before.tables.length });
      helper.assertOriginalUnchanged(config);
      if (!unchanged) throw Error('EXISTING_DATA_CHANGED');
    } finally { await db.$disconnect(); }
  }
}
main().catch(error => { console.error(error.code || error.name, /^[A-Z_]+$/.test(error.message) ? error.message : 'RECOVERY_CHECK_FAILED', error.stack?.split('\n').filter(line => /test-platform-admin/.test(line)).join('\n')); process.exitCode = 1; });
