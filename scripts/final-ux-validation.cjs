/* eslint-disable @typescript-eslint/no-require-imports -- Pinned recovery validation only. */
const fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!verified.h10Applied || !verified.h10ChecksumMatch || verified.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_TARGET');
const directory = 'docs/performance-audit/final-ux';
fs.mkdirSync(directory, { recursive: true });
const environment = { ...config.environment, DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href, NODE_ENV: 'test' };
async function run(name, args, env = environment, executable = process.execPath) {
  const start = performance.now(), child = spawn(executable, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', b => output += b);
  const exitCode = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
  const result = { name, exitCode, elapsedMs: Math.round(performance.now() - start), assertions: output.split(/\r?\n/).filter(l => /^(PASS |REGRESSION |H[128] |H10\.|UX )/.test(l)).map(l => l.replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]')) };
  if (exitCode) result.diagnostics = output.split(/\r?\n/).filter(l => /error |warning |Error:|FAIL|AssertionError|\.tsx?[(:]/.test(l)).slice(-25).map(l => l.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]'));
  fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, assertions: result.assertions.length }));
  if (exitCode) throw Error('VALIDATION_FAILED');
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'build') {
    const env = { ...environment, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled) };
    await run('prisma-validation', ['node_modules/prisma/build/index.js', 'validate'], env);
    await run('typescript', ['node_modules/typescript/bin/tsc', '--noEmit'], env);
    await run('production-build', ['node_modules/next/dist/bin/next', 'build', '--webpack'], env);
  } else if (mode === 'regressions') {
    const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    for (const suite of ['test:h1', 'test:h2']) await run(suite.replace(':', '-'), [npm, 'run', 'test:h10-2', '--', '--regression=' + suite]);
  } else if (mode === 'analytics') {
    const schema = 'finalux_test_' + randomBytes(12).toString('hex');
    const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
    const url = new URL(config.direct); url.searchParams.set('schema', schema); url.searchParams.set('options', '-c search_path=' + schema + ',public');
    const env = { ...environment, DATABASE_URL: url.href, H10_TEST_DATABASE_URL: url.href, NODE_OPTIONS: '--require ' + path.resolve('scripts/batch2-test-preload.cjs'), WORKPULSE_BATCH2_PARITY: '1', WORKPULSE_FINAL_UX_PARITY: '1' };
    let created = false;
    try {
      await db.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"'); created = true;
      await run('analytics-migrations', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env);
      await run('analytics-dashboard-parity', ['node_modules/tsx/dist/cli.mjs', 'scripts/test-h8-analytics.ts'], env);
    } finally {
      if (created) await db.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
      await db.$disconnect();
    }
  } else if (mode === 'checks') {
    const files = (await new Promise((resolve, reject) => {
      const child = spawn('git', ['diff', '--name-only', '--diff-filter=ACM'], { windowsHide: true }); let output = '';
      child.stdout.on('data', b => output += b); child.on('error', reject); child.on('exit', code => code ? reject(Error('GIT_FAILED')) : resolve(output.trim().split(/\r?\n/).filter(p => /\.(?:tsx?|cjs)$/.test(p))));
    }));
    const added = ['scripts/final-ux-performance.cjs', 'scripts/final-ux-validation.cjs', 'scripts/final-ux-latency.cjs', 'scripts/summarize-final-ux.cjs', 'scripts/assert-final-ux-profile.ts', 'scripts/test-final-ux-payroll-state.cjs', 'scripts/test-final-ux-hiring.cjs', 'scripts/reference/final-ux-employees.ts', 'scripts/reference/final-ux-dashboard.ts', 'src/features/dashboard/employee-alerts.ts', 'src/app/(dashboard)/dashboard/employees/[employeeId]/loading.tsx'];
    await run('changed-eslint', ['node_modules/eslint/bin/eslint.js', ...new Set([...files, ...added])]);
    await run('payroll-processing-state', ['scripts/test-final-ux-payroll-state.cjs']);
    await run('hiring-query-order-and-tenancy', ['scripts/test-final-ux-hiring.cjs']);
    await run('diff-check', ['diff', '--check'], environment, 'git');
  } else throw Error('UNKNOWN_MODE');
  helper.assertOriginalUnchanged(config);
}
main().catch(e => { console.error(JSON.stringify({ code: e.code || e.name, message: /^[A-Z_]+$/.test(e.message) ? e.message : undefined })); process.exitCode = 1; });
