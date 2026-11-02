const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { offline, scrub } = require('../../qa-runner.cjs');
const commands = {
  environment: ['scripts/test-release-environment.cjs'],
  singleton: ['scripts/test-prisma-client-cache.cjs'],
  typescript: ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
  lint: ['node_modules/eslint/bin/eslint.js', 'src/lib/db/environment-safety.ts', 'src/instrumentation.ts', 'src/lib/db/prisma.ts', 'src/lib/email/index.ts', 'src/features/email-integration/google.ts', 'scripts/verify-runtime-database.ts', 'scripts/test-release-environment.cjs', 'scripts/test-prisma-client-cache.cjs'],
  build: ['node_modules/next/dist/bin/next', 'build', '--webpack'],
};
for (const id of process.argv.slice(2)) {
  if (!commands[id]) throw Error('UNKNOWN_CHECK');
  const start = Date.now();
  const env = { ...offline, NODE_ENV: 'production' };
  delete env.VERCEL_ENV;
  const r = spawnSync(process.execPath, commands[id], { env, encoding: 'utf8', windowsHide: true, maxBuffer: 25e6, timeout: 600000 });
  fs.writeFileSync(path.join(__dirname, id + '.log'), scrub((r.stdout || '') + (r.stderr || '')));
  const result = { capturedAt: new Date().toISOString(), id, status: r.status === 0 ? 'PASS' : 'FAIL', exitCode: r.status, durationMs: Date.now() - start, error: r.error?.code,
    productionWrites: 0, externalMessages: 0 };
  fs.writeFileSync(path.join(__dirname, id + '.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (r.status !== 0) process.exitCode = 1;
}
