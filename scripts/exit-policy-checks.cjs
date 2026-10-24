/* eslint-disable @typescript-eslint/no-require-imports -- Run checks only with verified recovery environment. */
const fs = require('node:fs'), { spawnSync } = require('node:child_process');
const helper = require('./batch0-recovery-environment.cjs'), config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
const commands = {
  cache: ['scripts/test-prisma-client-cache.cjs'],
  generate: ['node_modules/prisma/build/index.js', 'generate'],
  types: ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
  lint: ['node_modules/eslint/bin/eslint.js', 'src/features/separation', 'src/features/dashboard/read-model.ts', 'src/app/(employee)/employee/resignation', 'src/components/employee-self-service/EmployeeNav.tsx', 'src/app/(dashboard)/dashboard/employees/exit', 'src/app/(dashboard)/dashboard/settings/exit', 'src/app/(dashboard)/dashboard/organization/page.tsx', 'src/lib/db/prisma.ts', 'scripts/test-prisma-client-cache.cjs', 'scripts/test-exit-organization-policy.cjs', 'scripts/test-exit-policy-interface.cjs', 'scripts/exit-policy-recovery.cjs', 'scripts/exit-policy-checks.cjs', 'scripts/final-pay-recovery.cjs', 'scripts/test-final-pay.cjs', 'scripts/test-final-pay-interface.cjs', 'scripts/test-ess-resignation.cjs', 'scripts/test-ess-resignation-interface.cjs', 'scripts/ess-resignation-recovery.cjs'],
  build: ['node_modules/next/dist/bin/next', 'build', '--webpack'],
};
const args = commands[process.argv[2]];
if (!args) throw Error('UNKNOWN_CHECK');
const result = spawnSync(process.execPath, args, { env: { ...config.environment, DATABASE_URL: helper.readOnly(config.pooled) }, windowsHide: true, stdio: 'inherit' });
helper.assertOriginalUnchanged(config);
process.exitCode = result.status ?? 1;
