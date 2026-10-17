/* eslint-disable @typescript-eslint/no-require-imports -- Recovery-only validation runner. */
const fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const directory = 'docs/runtime-recovery';
fs.mkdirSync(directory, { recursive: true });
const env = { ...config.environment, DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href, NODE_ENV: 'test' };
async function run(name, args, environment = env, executable = process.execPath) {
  const start = performance.now(), child = spawn(executable, args, { env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', b => output += b);
  const exitCode = await new Promise((r, j) => { child.on('exit', r); child.on('error', j); });
  const result = { name, exitCode, elapsedMs: Math.round(performance.now() - start), assertions: output.split(/\r?\n/).filter(l => /^(PASS \d+:|REGRESSION |INTERFACE PASS|H10\.|S1 )/.test(l)).map(l => l.replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]')), errorCodes: [...new Set(output.match(/\b(?:P\d{4}|TS\d{4}|EPERM)\b/g) || [])] };
  if (exitCode) result.diagnostics = output.split(/\r?\n/).filter(l => /error TS|Error:|FAIL:|AssertionError/.test(l)).slice(-10).map(l => l.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]'));
  fs.writeFileSync(directory + '/' + name + '.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, assertions: result.assertions.length }));
  if (exitCode) throw Error('VALIDATION_FAILED');
}
async function main() {
  const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (process.argv[2] === 'tests') return run('isolated-regressions', [npm, 'run', 'test:h10-2', '--', '--regressions-only']);
  if (process.argv[2] === 'interface') return run('h10-interface', [npm, 'run', 'test:h10-interface']);
  if (process.argv[2] === 'build') {
    const production = { ...env, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled) };
    await run('prisma-validation', ['node_modules/prisma/build/index.js', 'validate'], production);
    await run('typescript', ['node_modules/typescript/bin/tsc', '--noEmit'], production);
    await run('production-build', ['node_modules/next/dist/bin/next', 'build', '--webpack'], production);
    return;
  }
  if (process.argv[2] === 'checks') {
    await run('startup-regression', ['scripts/test-runtime-startup.cjs']);
    await run('eslint', ['node_modules/eslint/bin/eslint.js', 'src/components/layout/DashboardHeader.tsx', 'scripts/dev-recovery.cjs', 'scripts/check-runtime-recovery.cjs', 'scripts/test-runtime-startup.cjs', 'scripts/runtime-recovery-validation.cjs', 'scripts/verify-runtime-recovery.cjs']);
    await run('diff-check', ['diff', '--check'], env, 'git'); return;
  }
  throw Error('UNKNOWN_MODE');
}
main().catch(e => { console.error(JSON.stringify({ code: e.code || e.name })); process.exitCode = 1; });
