/* eslint-disable @typescript-eslint/no-require-imports -- Isolated startup regression without a database. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('scripts/dev-recovery.cjs', 'utf8');
let checks = 0;
function exercise(verification, missingProfile = false) {
  let spawned = null;
  const environment = { DATABASE_URL: 'protected-original', H10_TEST_DATABASE_URL: 'protected-original-direct', SESSION_SECRET: 'existing-test-session-secret' };
  const processMock = { env: environment, execPath: process.execPath, argv: ['node', 'script', '--port', '3000'], on() {}, exitCode: 0 };
  const helper = {
    directory: 'verified',
    configuration() {
      if (missingProfile) throw Object.assign(Error('PROFILE_MISSING'), { code: 'PROFILE_MISSING' });
      return { pooled: { href: 'approved-recovery-pooled' }, direct: { href: 'approved-recovery-direct' }, profile: { SESSION_SECRET: 'local-only-session-secret-at-least-32-characters' }, environment: { ...environment, SESSION_SECRET: 'local-only-session-secret-at-least-32-characters', SMTP_HOST: '', BLOB_READ_WRITE_TOKEN: '' }, identity: { endpointSha256: 'approved', branchName: 'development', branchId: 'br-development', endpointId: 'ep-development', checkpointBranchId: null, originalEnvSha256: 'original' } };
    },
    assertOriginalUnchanged() {},
    fail(code) { throw Object.assign(Error(code), { code }); },
  };
  vm.runInNewContext(source, { process: processMock, console: { log() {}, error() {} }, require: Object.assign(name => {
    if (name === 'node:fs') return { readFileSync: () => JSON.stringify(verification) };
    if (name === 'node:path') return require('node:path');
    if (name === 'node:child_process') return { spawn(executable, args, options) { spawned = { executable, args, options }; return { on() {}, kill() {} }; } };
    if (name === './batch0-recovery-environment.cjs') return helper;
    throw Error('UNEXPECTED_IMPORT');
  }, { resolve: () => 'next-cli' }) });
  return { spawned, processMock, environment };
}
const valid = { startupVerified: true, h10Applied: true, h10ChecksumMatch: true, identity: { endpointSha256: 'approved', branchName: 'development', branchId: 'br-development', endpointId: 'ep-development', checkpointBranchId: null, originalEnvSha256: 'original' } };
const good = exercise(valid);
assert.equal(good.spawned.options.env.DATABASE_URL, 'approved-recovery-pooled');
assert.equal(good.spawned.options.env.H10_TEST_DATABASE_URL, 'approved-recovery-direct');
assert.equal(good.spawned.options.env.SESSION_SECRET, 'local-only-session-secret-at-least-32-characters');
assert.equal(good.spawned.options.env.SMTP_HOST, '');
assert.equal(good.spawned.options.env.BLOB_READ_WRITE_TOKEN, '');
assert.equal(good.environment.DATABASE_URL, 'protected-original');
assert.deepEqual(Array.from(good.spawned.args), ['next-cli', 'dev', '--webpack', '--port', '3000']);
console.log(`PASS ${++checks}: child uses recovery URLs and local session, disables integrations, and preserves CLI arguments`);
for (const proof of [{ ...valid, startupVerified: false }, { ...valid, h10Applied: false }, { ...valid, h10ChecksumMatch: false }, { ...valid, identity: { ...valid.identity, endpointSha256: 'other' } }, { ...valid, identity: { ...valid.identity, branchId: 'br-other' } }, { ...valid, missingColumns: ['Organization.finalPayPolicy'] }, { ...valid, pendingMigrations: ['unreviewed'] }]) {
  const blocked = exercise(proof);
  assert.equal(blocked.spawned, null); assert.equal(blocked.processMock.exitCode, 1);
  console.log(`PASS ${++checks}: unverified recovery configuration cannot launch or fall back to production`);
}
assert.equal(exercise(valid, true).spawned, null);
console.log(`PASS ${++checks}: missing recovery profile fails closed`);
