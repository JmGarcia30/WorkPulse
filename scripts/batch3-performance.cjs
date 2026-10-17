/* eslint-disable @typescript-eslint/no-require-imports -- Node-only isolated test runner. */
const fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const prior = JSON.parse(fs.readFileSync(path.join(helper.directory, 'schema-and-history-verification.json')));
if (!prior.h10Applied || prior.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_TARGET');
const directory = 'docs/performance-audit/batch-3';
fs.mkdirSync(directory, { recursive: true });
const save = (name, value) => fs.writeFileSync(path.join(directory, name + '.json'), JSON.stringify(value, null, 2));
const environment = { ...config.environment, DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href, NODE_ENV: 'test' };
async function command(name, args, env = environment, executable = process.execPath) {
  const start = performance.now(), child = spawn(executable, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', b => output += b);
  const exitCode = await new Promise((r, j) => { child.on('exit', r); child.on('error', j); });
  const result = { name, exitCode, elapsedMs: Math.round(performance.now() - start),
    assertions: output.split(/\r?\n/).filter(l => /^(PASS \d+:|REGRESSION |INTERFACE PASS|H[138] |H10\.|S1 )/.test(l)),
    errorCodes: [...new Set(output.match(/\b(?:P\d{4}|EPERM|EACCES|ENOENT|TS\d{4})\b/g) || [])] };
  if (exitCode) result.diagnostics = output.split(/\r?\n/).filter(l => /H3_FAILURE|error TS|Error:|FAIL:|AssertionError|\.ts[(:]/.test(l)).slice(-12).map(l => l.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]'));
  if (exitCode) result.safeFailures = output.split(/\r?\n/).filter(l => /^\{"code":"[A-Za-z0-9_]+"/.test(l)).map(l => JSON.parse(l));
  save(name, result); console.log(JSON.stringify({ ...result, assertions: result.assertions.length })); return exitCode;
}
async function isolated(mode) {
  const schema = 'batch3_test_' + randomBytes(12).toString('hex');
  if (!/^batch3_test_[a-f0-9]{24}$/.test(schema)) helper.fail('INVALID_SCHEMA');
  const control = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  const url = new URL(config.direct); url.searchParams.set('schema', schema); url.searchParams.set('options', '-c search_path=' + schema + ',public');
  const env = { ...environment, DATABASE_URL: url.href, H10_TEST_DATABASE_URL: url.href, WORKPULSE_BATCH3_ISOLATED: '1', WORKPULSE_BATCH3_SCENARIOS_ONLY: mode === 'scenarios' ? '1' : '0', NODE_OPTIONS: '--require ' + path.resolve('scripts/batch2-test-preload.cjs') };
  let created = false;
  try {
    await control.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"'); created = true;
    if (await command(mode + '-migrations', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env)) throw Error('FIXTURE_MIGRATIONS_FAILED');
    const scripts = ['benchmarks', 'scenarios'].includes(mode) ? ['scripts/test-batch3-services.ts'] : mode === 'h3' ? ['scripts/test-h3-attendance.ts'] : ['scripts/test-h3-attendance.ts', 'scripts/test-h6-payroll-foundation.ts', 'scripts/test-h8-analytics.ts'];
    let failed = false;
    for (const script of scripts) if (await command(mode + '-' + path.basename(script, '.ts'), ['node_modules/tsx/dist/cli.mjs', script], env)) failed = true;
    if (failed) throw Error('ISOLATED_TEST_FAILED');
  } finally {
    if (created) await control.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
    await control.$disconnect(); helper.assertOriginalUnchanged(config);
  }
}
async function main() {
  const mode = process.argv[2];
  if (['benchmarks', 'scenarios', 'services', 'h3'].includes(mode)) return isolated(mode);
  if (mode === 'checks') {
    const files = ['src/features/attendance/service.ts', 'src/features/payroll/service.ts', 'src/features/payroll/generation-inputs.ts', 'scripts/test-h3-attendance.ts', 'scripts/test-batch3-services.ts', 'scripts/batch3-performance.cjs', 'scripts/summarize-batch3-performance.cjs', 'scripts/reference/batch3-attendance.ts', 'scripts/reference/batch3-payroll-service.ts'];
    if (await command('final-typescript', ['node_modules/typescript/bin/tsc', '--noEmit'])) throw Error('TYPESCRIPT_FAILED');
    if (await command('changed-eslint', ['node_modules/eslint/bin/eslint.js', ...files])) throw Error('ESLINT_FAILED');
    if (await command('diff-check', ['diff', '--check'], environment, 'git')) throw Error('DIFF_CHECK_FAILED');
    return;
  }
  const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (mode === 'regressions') {
    let failed = false;
    for (const [name, ...args] of [['h10-1', 'test:h10-1'], ['h10-2', 'test:h10-2'], ['core-ess-leave-payroll-tenancy', 'test:h10-2', '--', '--regressions-only']]) {
      if (await command(name, [npm, 'run', ...args])) failed = true;
    }
    if (failed) throw Error('REGRESSIONS_FAILED');
    return;
  }
  if (mode === 'interface') {
    if (await command('h10-interface', [npm, 'run', 'test:h10-interface'])) throw Error('INTERFACE_FAILED');
    return;
  }
  if (mode === 'build') {
    const env = { ...environment, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled) };
    for (const [name, args] of [['prisma-validation', ['node_modules/prisma/build/index.js', 'validate']], ['typescript', ['node_modules/typescript/bin/tsc', '--noEmit']], ['production-build', ['node_modules/next/dist/bin/next', 'build', '--webpack']]]) {
      if (await command(name, args, env)) throw Error('BUILD_FAILED');
    }
    return;
  }
  throw Error('UNKNOWN_MODE');
}
main().catch(e => { console.error(JSON.stringify({ code: e.code || e.name, message: /^[A-Z_]+$/.test(e.message) ? e.message : undefined })); process.exitCode = 1; });
