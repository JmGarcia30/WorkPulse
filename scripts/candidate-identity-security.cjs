/* eslint-disable @typescript-eslint/no-require-imports -- Verified disposable environment only. */
const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!verified.h10Applied || !verified.h10ChecksumMatch || verified.identity.endpointSha256 !== config.identity.endpointSha256) throw Error('UNVERIFIED_TARGET');
const directory = 'docs/functional-regression/candidate-identity';
const save = (name, data) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(data, null, 2));
const env = { ...config.environment, FR_IDENTITY_REVIEW: '1', NODE_ENV: 'test', DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href, NODE_OPTIONS: '--require ' + path.resolve('scripts/batch2-test-preload.cjs'), WORKPULSE_BATCH2_PARITY: '1', WORKPULSE_FINAL_UX_PARITY: '1' };
async function run(name, args) {
  const start = performance.now();
  const child = spawn(process.execPath, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', part => output += part);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  save(name, { exitCode: code, elapsedMs: Math.round(performance.now() - start), output: output.replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]').split(/\r?\n/).slice(-100) });
  console.log(JSON.stringify({ name, exitCode: code })); helper.assertOriginalUnchanged(config);
  if (code !== 0) throw Error('CHECK_FAILED');
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'final-http') {
    for (const suite of ['candidate', 'http', 'browser', 'session-unit', 'document-headers']) await run('run-' + suite, ['scripts/profile-security.cjs', suite]);
    return;
  }
  if (['candidate', 'http', 'browser', 'regressions', 'recruitment-core', 'build', 'session-unit', 'document-headers'].includes(mode)) return run('run-' + mode, ['scripts/profile-security.cjs', mode]);
  if (mode === 'dashboard') return run('dashboard-boundary', ['scripts/test-functional-dashboard-boundary.cjs']);
  if (mode === 'lint') {
    const files = ['src/features/careers', 'src/components/careers/VerifyCandidateEmail.tsx', 'src/app/careers/[organizationSlug]/portal/[applicationId]', 'src/app/careers/[organizationSlug]/[jobSlug]/apply/page.tsx', 'src/app/(dashboard)/dashboard/hiring/applicants/[applicationId]/page.tsx', 'src/app/api/recruitment-documents/[id]/route.ts', 'src/app/api/onboarding-documents/[id]/route.ts', 'src/features/hiring/actions.ts', 'src/features/hiring/onboarding-actions.ts', 'scripts/candidate-identity-security.cjs', 'scripts/test-candidate-identity-extra.cjs', 'scripts/test-candidate-identity-http.cjs', 'scripts/test-candidate-document-http.cjs', 'scripts/functional-rollback-browser.cjs', 'scripts/profile-security.cjs'];
    return run('eslint', ['node_modules/eslint/bin/eslint.js', ...files]);
  }
  if (mode === 'integrity') {
    // Reuse the established full-column and catalog verification in an isolated module.
    let source = fs.readFileSync('scripts/functional-regression.cjs', 'utf8');
    source = source.replace("const directory = 'docs/functional-regression';", `const directory = '${directory}';`);
    source = source.replace("save('integrity-summary', result);", "save('integrity-summary', result); if (result.differences.length || !result.schemasUnchanged || !result.catalogUnchanged || !result.migrationsUnchanged || !result.originalEnvUnchanged) throw Error('INTEGRITY_CHANGED');");
    fs.copyFileSync('docs/functional-regression/integrity-before.json', `${directory}/integrity-before.json`);
    const Module = require('node:module'); const compiled = new Module(path.resolve('scripts/functional-regression.cjs'), module); compiled.filename = path.resolve('scripts/functional-regression.cjs'); compiled.paths = module.paths;
    process.argv[2] = 'after'; compiled._compile(source, compiled.filename); return;
  }
  throw Error('UNKNOWN_MODE');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
