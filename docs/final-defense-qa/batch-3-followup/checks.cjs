const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { offline, scrub } = require('../qa-runner.cjs');
const out = path.join(__dirname, 'evidence'); fs.mkdirSync(out, { recursive: true });
const commands = {
  typescript: ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
  lint: ['node_modules/eslint/bin/eslint.js', 'src/features/payroll/readiness.ts', 'src/features/payroll/second-cutoff-readiness.ts'],
  build: ['node_modules/next/dist/bin/next', 'build', '--webpack'],
};
for (const id of process.argv.slice(2)) {
  if (!commands[id]) throw Error('UNKNOWN_CHECK');
  const start = Date.now();
  const r = spawnSync(process.execPath, commands[id], { env: { ...offline, NODE_ENV: 'production' }, encoding: 'utf8', windowsHide: true, maxBuffer: 25e6, timeout: 600000 });
  fs.writeFileSync(path.join(out, id + '.log'), scrub((r.stdout || '') + (r.stderr || '')));
  const result = { capturedAt: new Date().toISOString(), id, command: 'node ' + commands[id].join(' '), status: r.status === 0 ? 'PASS' : 'FAIL', exitCode: r.status, durationMs: Date.now() - start, error: r.error?.code };
  fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); if (r.status !== 0) process.exitCode = 1;
}
