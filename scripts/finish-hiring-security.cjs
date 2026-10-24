/* eslint-disable @typescript-eslint/no-require-imports -- Run the existing production-cookie security test. */
const fs = require('node:fs'), { spawnSync } = require('node:child_process');
// Match the committed hiring-policy runner's production mode; no persistent configuration changes.
const result = spawnSync(process.execPath, ['scripts/test-hiring-candidate-security.cjs'], { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8', windowsHide: true });
fs.writeFileSync('docs/hiring-policy/release/security.json', JSON.stringify({ exitCode: result.status, mode: 'production', output: (result.stdout + result.stderr).split(/\r?\n/).filter(Boolean) }, null, 2));
process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.status ?? 1;
