/* eslint-disable @typescript-eslint/no-require-imports -- Isolated, database-free transport and identity regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(file), m = new Module(filename, module);
  m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
  m.require = name => Object.hasOwn(mocks, name) ? mocks[name] : Module.prototype.require.call(m, name);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText, filename);
  return m.exports;
}
async function main() {
  let checks = 0;
  const check = (label, fn) => { fn(); checks++; console.log('PASS:', label); };
  const { databaseTarget, verifyDatabaseIdentity, assertHostedSessionSecret, productionDatabase: prod } = load('src/lib/db/environment-safety.ts');
  const clone = { ...prod, branch: 'br-odd-field-azce2cjf', endpoint: 'ep-patient-cake-az9urbbj' };
  function profile(target, environment = 'preview') {
    return { VERCEL: '1', VERCEL_ENV: environment, SESSION_SECRET: 'fixture-only-runtime-session-secret-long-enough', WORKPULSE_DB_PROJECT_ID: target.project,
      WORKPULSE_DB_BRANCH_ID: target.branch, WORKPULSE_DB_ENDPOINT_ID: target.endpoint, WORKPULSE_DB_DATABASE: target.database,
      DATABASE_URL: `postgresql://fixture:fixture@${target.endpoint}.c-3.ap-southeast-1.aws.neon.tech/${target.database}?sslmode=require` };
  }
  check('local profiles unchanged', () => assert.equal(databaseTarget({}), null));
  check('hosted public session template rejected', () => assert.throws(() => assertHostedSessionSecret({ VERCEL_ENV: 'production', SESSION_SECRET: 'workpulse_secret_key_change_in_production_32chars!' }), { message: 'WORKPULSE_SESSION_SECRET_REJECTED' }));
  check('hosted missing session key rejected', () => assert.throws(() => assertHostedSessionSecret({ VERCEL_ENV: 'production' }), { message: 'WORKPULSE_SESSION_SECRET_REJECTED' }));
  check('hosted non-template session key accepted', () => assert.doesNotThrow(() => assertHostedSessionSecret(profile(clone))));
  check('hosted missing environment rejected', () => assert.throws(() => databaseTarget({ VERCEL: '1' })));
  check('unknown hosted environment rejected', () => assert.throws(() => databaseTarget({ VERCEL_ENV: 'staging' })));
  check('missing expected identity rejected', () => assert.throws(() => databaseTarget({ VERCEL_ENV: 'preview' })));
  check('production tuple accepted', () => assert.deepEqual(databaseTarget(profile(prod, 'production')), prod));
  check('separate configured endpoint accepted (not proof of deployed Preview)', () => assert.deepEqual(databaseTarget(profile(clone)), clone));
  check('pooled endpoint accepted', () => { const env = profile(clone); env.DATABASE_URL = env.DATABASE_URL.replace('.c-3.', '-pooler.c-3.'); assert.deepEqual(databaseTarget(env), clone); });
  for (const [label, change] of [
    ['production target in Preview', e => Object.assign(e, profile(prod))],
    ['production branch with other endpoint', e => e.WORKPULSE_DB_BRANCH_ID = prod.branch],
    ['wrong project', e => e.WORKPULSE_DB_PROJECT_ID = 'another-project'],
    ['different production binding', e => e.VERCEL_ENV = 'production'],
    ['wrong host', e => e.DATABASE_URL = e.DATABASE_URL.replace(clone.endpoint, prod.endpoint)],
    ['wrong database', e => e.DATABASE_URL = e.DATABASE_URL.replace('/neondb?', '/other?')],
    ['schema override', e => e.DATABASE_URL += '&schema=other'],
    ['endpoint routing override', e => e.DATABASE_URL += '&options=endpoint%3D' + prod.endpoint],
    ['duplicate parameter', e => e.DATABASE_URL += '&sslmode=disable'],
    ['TLS disabled', e => e.DATABASE_URL = e.DATABASE_URL.replace('sslmode=require', 'sslmode=disable')],
    ['malformed URL', e => e.DATABASE_URL = 'secret-not-a-url'],
  ]) check(label + ' rejected without disclosing URL', () => {
    const env = profile(clone); change(env);
    assert.throws(() => databaseTarget(env), { message: 'WORKPULSE_DATABASE_IDENTITY_REJECTED' });
  });
  const row = { database: clone.database, branch_id: clone.branch, endpoint_id: clone.endpoint };
  assert.equal((await verifyDatabaseIdentity(clone, async () => [row])).branch, clone.branch); checks++;
  for (const rows of [[], [row, row], [{ ...row, branch_id: null }], [{ ...row, endpoint_id: prod.endpoint }], [{ ...row, database: 'other' }]]) {
    await assert.rejects(verifyDatabaseIdentity(clone, async () => rows), { message: 'WORKPULSE_DATABASE_IDENTITY_REJECTED' }); checks++;
  }
  await assert.rejects(verifyDatabaseIdentity(clone, async () => { throw new Error('provider-error-with-secret'); }), { message: 'WORKPULSE_DATABASE_IDENTITY_REJECTED' }); checks++;
  assert.equal(JSON.parse(fs.readFileSync('vercel.json', 'utf8')).git.deploymentEnabled, false); checks++;
  const originalEnv = { ...process.env }, priorFetch = global.fetch;
  let transports = 0, deliveries = 0, requests = 0;
  const smtp = { createTransport() { transports++; return { async sendMail() { deliveries++; } }; } };
  try {
    process.env.VERCEL_ENV = 'preview';
    const mail = load('src/lib/email/index.ts', { nodemailer: smtp, '@/lib/tenant/host': {}, './recruitment': {}, './hr': {} });
    for (const sensitive of [true, false]) {
      assert.equal((await mail.sendEmail({ to: 'real-recipient@example.com', subject: 'fixture', html: 'secret-body', sensitive })).success, false); checks++;
    }
    assert.equal(transports, 0); assert.equal(deliveries, 0); assert.equal(mail.getEmailLogs().length, 0); checks++;
    global.fetch = async () => { requests++; return { ok: true }; };
    const google = load('src/features/email-integration/google.ts', { 'server-only': {}, '@/lib/tenant/host': {}, './crypto': { encryptionConfigured: () => false } });
    await assert.rejects(google.googleProvider.send('synthetic-token', 'synthetic-message'), { code: 'SEND_FAILED' });
    assert.equal(requests, 0); checks++;
    process.env.VERCEL_ENV = 'production';
    await google.googleProvider.send('synthetic-token', 'synthetic-message');
    assert.equal(requests, 1); checks++;
    Object.assign(process.env, { GMAIL_USER: 'sender@fixture.invalid', GMAIL_APP_PASSWORD: 'fixture-password' });
    assert.equal((await mail.sendEmail({ to: 'recipient@fixture.invalid', subject: 'fixture', html: 'fixture', sensitive: true })).success, true);
    assert.equal(transports, 1); assert.equal(deliveries, 1); checks++;

    Object.assign(process.env, { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production', VERCEL_URL: 'work-pulse-staged-fixture.vercel.app', PLATFORM_ROOT_DOMAIN: 'work-pulse-omega.vercel.app', PLATFORM_PUBLIC_ORIGIN: 'https://work-pulse-omega.vercel.app' });
    const host = load('src/lib/tenant/host.ts');
    const classify = (value, forwarded) => host.classifyRequestHost(new Headers({ host: value, ...(forwarded ? { 'x-forwarded-host': forwarded } : {}) })).kind;
    check('own provider-assigned Production hostname accepted', () => assert.equal(classify(process.env.VERCEL_URL), 'public'));
    check('staged hostname supports path tenancy', () => assert.equal(host.usesTemporaryPathTenancy(process.env.VERCEL_URL), true));
    check('canonical production hostname retained', () => assert.equal(classify('work-pulse-omega.vercel.app'), 'public'));
    check('unrelated Vercel deployment rejected', () => assert.equal(classify('attacker.vercel.app'), 'invalid'));
    check('nested staged-host tenant rejected', () => assert.equal(classify('evil.' + process.env.VERCEL_URL), 'invalid'));
    check('forwarded host cannot select staged deployment', () => assert.equal(classify('attacker.vercel.app', process.env.VERCEL_URL), 'invalid'));
    check('conflicting forwarded host rejected', () => assert.equal(classify(process.env.VERCEL_URL, 'attacker.vercel.app'), 'invalid'));
    check('staged hostname port override rejected', () => assert.equal(classify(process.env.VERCEL_URL + ':443'), 'invalid'));
    process.env.VERCEL_ENV = 'preview';
    check('Production staging exception unavailable to Preview', () => assert.equal(classify(process.env.VERCEL_URL), 'invalid'));
    process.env.VERCEL_ENV = 'production'; delete process.env.PLATFORM_ROOT_DOMAIN;
    check('staged hostname cannot rescue missing root configuration', () => assert.equal(classify(process.env.VERCEL_URL), 'invalid'));

    // Exercise the actual startup hook: a mismatch prevents readiness and never logs provider errors.
    Object.assign(process.env, profile(clone), { NEXT_RUNTIME: 'nodejs' });
    const info = console.info; const logs = []; let disconnects = 0;
    class Database {
      async $queryRaw() { return [row]; }
      async $disconnect() { disconnects++; }
    }
    const safety = { databaseTarget, verifyDatabaseIdentity, assertHostedSessionSecret };
    try {
      console.info = (...args) => logs.push(args);
      const hook = load('src/instrumentation.ts', { './lib/db/environment-safety': safety, '@prisma/client': { PrismaClient: Database } });
      await hook.register();
      assert.equal(logs.length, 1); assert.equal(disconnects, 1); checks++;
      assert.ok(!JSON.stringify(logs).includes('postgresql://')); checks++;
      class WrongDatabase extends Database { async $queryRaw() { return [{ ...row, endpoint_id: prod.endpoint }]; } }
      const wrongHook = load('src/instrumentation.ts', { './lib/db/environment-safety': safety, '@prisma/client': { PrismaClient: WrongDatabase } });
      await assert.rejects(wrongHook.register(), { message: 'WORKPULSE_DATABASE_IDENTITY_REJECTED' });
      assert.equal(logs.length, 1); assert.equal(disconnects, 2); checks++;
    } finally { console.info = info; }
  } finally {
    for (const key of Object.keys(process.env)) if (!Object.hasOwn(originalEnv, key)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    global.fetch = priorFetch;
  }
  console.log(JSON.stringify({ status: 'PASS', checks, databaseWrites: 0, externalMessages: 0 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
