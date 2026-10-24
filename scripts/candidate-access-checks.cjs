/* eslint-disable @typescript-eslint/no-require-imports -- Focused checks pinned to verified recovery; never load protected DB URLs in children. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(`${helper.directory}/schema-and-history-verification.json`));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY_TARGET');
const directory = 'docs/uat/candidate-access';
const commands = {
  unit: ['scripts/test-hiring-candidate-security.cjs'],
  headers: ['scripts/test-candidate-document-headers.cjs'],
  types: ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
  validate: ['node_modules/prisma/build/index.js', 'validate'],
  status: ['node_modules/prisma/build/index.js', 'migrate', 'status'],
  lint: ['node_modules/eslint/bin/eslint.js', 'scripts/candidate-access-recovery.cjs', 'scripts/candidate-access-checks.cjs', 'scripts/candidate-test-http.cjs', 'scripts/test-candidate-conversion-regression.cjs', 'scripts/functional-rollback-browser.cjs', 'scripts/test-candidate-document-http.cjs', 'scripts/test-candidate-identity-extra.cjs', 'scripts/test-hiring-candidate-security.cjs', 'scripts/test-candidate-document-headers.cjs'],
  build: ['node_modules/next/dist/bin/next', 'build', '--webpack'],
  http: ['scripts/functional-rollback-browser.cjs'],
  regression: ['scripts/test-candidate-conversion-regression.cjs'],
};
const mode = process.argv[2];
if (!commands[mode]) throw Error('UNKNOWN_CHECK');
const environment = { ...config.environment, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), FR_IDENTITY_REVIEW: '1', FR_CANDIDATE_DOCUMENTS: '1', FR_CANDIDATE_EVIDENCE_DIRECTORY: directory, NODE_OPTIONS: '--require ' + path.resolve('scripts/batch2-test-preload.cjs'), WORKPULSE_BATCH2_PARITY: '1', WORKPULSE_FINAL_UX_PARITY: '1' };
// Only rollback harnesses get a writable fixture connection; their fallback app connections stay read-only.
if (['http', 'regression'].includes(mode)) Object.assign(environment, { DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href });
if (mode === 'regression') environment.NODE_ENV = 'test';
const started = performance.now();
const result = spawnSync(process.execPath, commands[mode], { env: environment, windowsHide: true, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const output = `${result.stdout || ''}${result.stderr || ''}`.replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(`${directory}/${mode}.json`, JSON.stringify({ capturedAt: new Date().toISOString(), exitCode: result.status, errorCode: result.error?.code, elapsedMs: Math.round(performance.now() - started), output: output.split(/\r?\n/).filter(Boolean).slice(-120) }, null, 2));
helper.assertOriginalUnchanged(config);
console.log(JSON.stringify({ mode, exitCode: result.status, evidence: `${directory}/${mode}.json` }));
if (result.status !== 0) console.error(output.slice(-3500));
process.exitCode = result.status ?? 1;
