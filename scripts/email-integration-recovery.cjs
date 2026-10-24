/* eslint-disable @typescript-eslint/no-require-imports -- Isolated recovery-only migration and test runner. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const directory = 'docs/email-integration';
const migrations = ['20261023000400_organization_gmail_integration', '20261024000100_saga_recruitment_sender', '20261024000200_hr_email_delivery'];
const save = (name, value) => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2)); };

async function main() {
  const mode = process.argv[2];
  if (!['migrate', 'test', 'templates', 'workflows', 'regression', 'build'].includes(mode)) throw Error('EXPECTED_EMAIL_CHECK_MODE');
  const config = helper.configuration();
  const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json', 'utf8'));
  if (!config.identity.consoleMappingComplete || config.identity.branchId !== 'br-broad-forest-az55xwfe' || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256 || !verified.h10Applied || !verified.h10ChecksumMatch) throw Error('UNVERIFIED_RECOVERY_TARGET');
  const histories = [];
  for (const url of [config.pooled, config.direct]) {
    const reader = new PrismaClient({ datasources: { db: { url: helper.readOnly(url) } }, log: [] });
    try {
      const [state] = await reader.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only`;
      if (state.database !== config.identity.database || state.schema !== 'public' || state.read_only !== 'on') throw Error('TARGET_STATE_MISMATCH');
      histories.push(await reader.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`);
    } finally { await reader.$disconnect(); }
  }
  if (JSON.stringify(histories[0]) !== JSON.stringify(histories[1])) throw Error('RECOVERY_CONNECTION_HISTORY_MISMATCH');
  const history = histories[0].filter(row => !row.rolled_back);
  for (const row of history) {
    const bytes = fs.readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`);
    if (!row.finished || ![bytes, Buffer.from(bytes.toString().replace(/\r\n/g, '\n')), Buffer.from(bytes.toString().replace(/\r?\n/g, '\r\n'))].some(value => helper.digest(value) === row.checksum)) throw Error('MIGRATION_HISTORY_MISMATCH');
  }
  Object.assign(process.env, config.environment, ['test', 'templates', 'workflows'].includes(mode) ? { EMAIL_OAUTH_ENCRYPTION_KEY: require('node:crypto').randomBytes(32).toString('base64'), GOOGLE_EMAIL_CLIENT_ID: 'synthetic-test-client', GOOGLE_EMAIL_CLIENT_SECRET: 'synthetic-test-secret' } : {});
  save('target', { identity: config.identity, verified: true });
  console.log('Verified isolated recovery:', config.identity.branchId);
  const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  const before = await helper.fingerprints(db);
  try {
    if (mode === 'migrate' || mode === 'build') {
      let args;
      const environment = { ...config.environment, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct) };
      if (mode === 'migrate') {
        fs.mkdirSync('.next', { recursive: true });
        const bundle = fs.mkdtempSync('.next/email-integration-migration-');
        fs.mkdirSync(`${bundle}/migrations`);
        fs.copyFileSync('prisma/schema.prisma', `${bundle}/schema.prisma`);
        fs.copyFileSync('prisma/migrations/migration_lock.toml', `${bundle}/migrations/migration_lock.toml`);
        // Include applied history plus ONLY the Gmail integration migrations.
        for (const name of new Set(history.map(row => row.migration_name).concat(migrations))) fs.cpSync(`prisma/migrations/${name}`, `${bundle}/migrations/${name}`, { recursive: true });
        args = ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', `${bundle}/schema.prisma`];
        environment.DATABASE_URL = config.direct.href;
      } else args = ['node_modules/next/dist/bin/next', 'build', '--webpack'];
      const result = spawnSync(process.execPath, args, { env: environment, windowsHide: true, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      const output = ((result.stdout || '') + (result.stderr || '')).replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]');
      save(mode, { exitCode: result.status, output }); console.log(output);
      if (result.status !== 0) throw Error('CHECK_FAILED');
    } else if (mode === 'regression') {
      require('tsx/cjs');
      const { createHash, randomBytes } = require('node:crypto');
      const digest = value => createHash('sha256').update(value).digest('hex');
      const globalKey = digest('platform-login-global');
      const fixtureKey = digest('registration-regression:' + randomBytes(16).toString('hex'));
      // Existing suites clean up their global login counter. Give that counter its
      // own namespace so current operator login history is never changed/deleted.
      const rewrite = value => {
        if (value === globalKey) return fixtureKey;
        if (Array.isArray(value)) return value.map(rewrite);
        if (value && typeof value === 'object' && !(value instanceof Date)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]));
        return value;
      };
      const wrap = client => new Proxy(client, { get(target, key) {
        if (key === '$transaction') return (callback, options) => target.$transaction(tx => callback(wrap(tx)), options);
        if (key === 'platformAuthenticationAttempt') return new Proxy(target[key], { get(delegate, method) { const value = Reflect.get(delegate, method); return typeof value === 'function' ? args => value.call(delegate, rewrite(args)) : value; } });
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      const scoped = wrap(db), original = Module._load;
      const context = { headers: new Headers({ host: 'localhost:3000' }), jar: new Map() };
      Module._load = function(name, parent, main) {
        if (name === 'server-only') return {};
        if (name === 'next/headers') return { headers: async () => context.headers, cookies: async () => ({ get: key => context.jar.get(key), set: (key, value, options) => context.jar.set(key, { value, ...options }), delete: key => context.jar.delete(key) }) };
        if (name === 'next/navigation') return { redirect: target => { throw Error('REDIRECT:' + target); }, notFound: () => { throw Error('NOT_FOUND'); } };
        if (name === 'next/cache') return { revalidatePath: () => {} };
        if (name === '@/lib/db/prisma') return { prisma: scoped };
        if (name.startsWith('@/')) return original.call(this, path.resolve('src', name.slice(2)), parent, main);
        return original.call(this, name, parent, main);
      };
      try {
        save('routing-regression', await require('./test-platform-routing.cjs')(scoped, context));
        save('manual-onboarding-regression', await require('./test-platform-onboarding.cjs')(scoped, context));
      } finally {
        Module._load = original;
        await db.platformAuthenticationAttempt.deleteMany({ where: { key: fixtureKey } });
      }
    } else {
      require('tsx/cjs');
      const original = Module._load;
      const context = { headers: new Headers({ host: 'localhost:3000' }), jar: new Map() };
      const rollback = Error('ROLLBACK_EMAIL_INTEGRATION_FIXTURES');
      let result, hrResult, workflowResult;
      try {
        await db.$transaction(async tx => {
          const scoped = new Proxy(tx, { get(target, key) { return key === '$transaction' ? callback => callback(scoped) : Reflect.get(target, key); } });
          Module._load = function(name, parent, main) {
            if (name === 'server-only') return {};
            if (name === 'next/headers') return { headers: async () => context.headers, cookies: async () => ({ get: key => context.jar.get(key), set: (key, value, options) => context.jar.set(key, { value, ...options }), delete: key => context.jar.delete(key) }) };
            if (name === 'next/navigation') return { redirect: target => { throw Error('REDIRECT:' + target); }, notFound: () => { throw Error('NOT_FOUND'); } };
            if (name === 'next/cache') return { revalidatePath: () => {} };
            if (name === '@/lib/db/prisma') return { prisma: scoped };
            if (name.startsWith('@/')) return original.call(this, path.resolve('src', name.slice(2)), parent, main);
            return original.call(this, name, parent, main);
          };
          if (mode === 'workflows') workflowResult = await require('./test-hr-email-workflows.cjs')(scoped, context);
          else {
            if (mode === 'test') result = await require('./test-email-integration.cjs')(scoped, context);
            hrResult = await require('./test-hr-email-templates.cjs')(scoped, context);
          }
          throw rollback;
        }, { maxWait: 10000, timeout: mode === 'workflows' ? 300000 : 180000 });
      } catch (error) { if (error !== rollback) throw error; }
      finally { Module._load = original; }
      if (result) save('tests', { ...result, fixturesRolledBack: true });
      if (hrResult) save('hr-template-tests', { ...hrResult, fixturesRolledBack: true });
      if (workflowResult) save('hr-workflow-tests', { ...workflowResult, fixturesRolledBack: true });
    }
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
main().catch(error => { console.error(error.code || error.name, /^[A-Z_]+$/.test(error.message) ? error.message : 'EMAIL_INTEGRATION_RECOVERY_CHECK_FAILED', error.stack?.split('\n').filter(line => /test-(email-integration|hr-email-templates|hr-email-workflows)/.test(line)).join('\n')); process.exitCode = 1; });
