const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const { offline, scrub } = require('../qa-runner.cjs');
const out = path.join(__dirname, 'evidence'); fs.mkdirSync(out, { recursive: true });
const targets = ['src/features/account-security', 'src/features/hiring/actions.ts', 'src/lib/auth/actions.ts', 'src/lib/auth/staff-security.ts', 'src/lib/tenant/navigation.ts', 'src/proxy.ts', 'next.config.ts', 'src/components/layout/DashboardSidebarNav.tsx', 'src/app/(auth)/login/page.tsx', 'src/app/(auth)/forgot-password', 'src/app/(auth)/reset-password', 'src/app/(dashboard)/dashboard/profile', 'src/app/(dashboard)/dashboard/hiring/jobs/[jobId]/page.tsx', 'src/app/platform/(protected)/layout.tsx', 'src/app/platform/(protected)/audit-logs'];
const commands = {
  prisma: ['node_modules/prisma/build/index.js', 'validate'],
  typescript: ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
  lint: ['node_modules/eslint/bin/eslint.js', ...targets],
  build: ['node_modules/next/dist/bin/next', 'build', '--webpack'],
  statutory: ['--import', 'tsx', '--test', 'scripts/test-payroll-statutory.ts', 'scripts/test-payroll-bir.ts'],
};
for (const id of process.argv.slice(2)) {
  if (!commands[id]) throw Error('UNKNOWN_CHECK');
  const start = Date.now();
  const r = spawnSync(process.execPath, commands[id], { env: { ...offline, NODE_ENV: 'production' }, encoding: 'utf8', windowsHide: true, maxBuffer: 25e6, timeout: 600000 });
  fs.writeFileSync(path.join(out, id + '.log'), scrub((r.stdout || '') + (r.stderr || '')));
  const result = { capturedAt: new Date().toISOString(), id, status: r.status === 0 ? 'PASS' : 'FAIL', exitCode: r.status, durationMs: Date.now() - start, error: r.error?.code };
  fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); if (r.status !== 0) process.exitCode = 1;
}
