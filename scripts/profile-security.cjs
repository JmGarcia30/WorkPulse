/* eslint-disable @typescript-eslint/no-require-imports -- Isolated recovery security validation. */
const fs = require('node:fs'), path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const candidateReview = process.env.FR_CANDIDATE_REVIEW === '1';
const directory = process.env.FR_IDENTITY_REVIEW === '1' ? 'docs/functional-regression/candidate-identity' : candidateReview ? 'docs/functional-regression/candidate-documents' : 'docs/functional-regression/profile-security';
fs.mkdirSync(directory, { recursive: true });
const save = (name, data) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(data, null, 2));
const env = { ...config.environment, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct) };
async function run(name, executable, args, extra = {}) {
  const started = performance.now();
  const child = spawn(executable, args, { env: { ...env, ...extra }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => output += chunk);
  const status = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
  const safe = output.replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]');
  const result = { exitCode: Number.isInteger(status) ? status : 1, elapsedMs: Math.round(performance.now() - started), output: safe.split(/\r?\n/).filter(Boolean).slice(-100) };
  save(name, result); console.log(JSON.stringify({ name, exitCode: result.exitCode, elapsedMs: result.elapsedMs }));
  helper.assertOriginalUnchanged(config);
  return result.exitCode;
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'baseline-build') {
    for (const name of ['stale-role-profile', 'role-browser-scenarios', 'stale-role-browser']) fs.copyFileSync(`docs/functional-regression/${name}.json`, `${directory}/before-${name}.json`);
    const baseline = path.resolve('storage/profile-security/baseline-' + Date.now());
    fs.mkdirSync(baseline, { recursive: true });
    fs.mkdirSync('storage/profile-security', { recursive: true });
    const archive = path.resolve('storage/profile-security/pre-sprint.tar');
    for (const [command, args] of [['git', ['archive', '--format=tar', '-o', archive, 'HEAD']], ['tar', ['-xf', archive, '-C', baseline]]]) {
      const result = spawnSync(command, args, { windowsHide: true, encoding: 'utf8' });
      if (result.status !== 0) throw Error('BASELINE_EXTRACT_FAILED');
    }
    fs.symlinkSync(path.resolve('node_modules'), path.join(baseline, 'node_modules'), 'junction');
    save('baseline-source', { commit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).stdout.trim(), source: 'entire HEAD archive; no working-tree optimization or security changes', copiedEnvironmentFiles: false });
    const status = await run('baseline-build', process.execPath, ['node_modules/next/dist/bin/next', 'build', baseline, '--webpack']);
    // Keep the archived source outside the root project's TypeScript glob.
    const destination = path.resolve('node_modules/.cache/workpulse-built-baseline-' + Date.now());
    if (!baseline.startsWith(path.resolve('storage/profile-security') + path.sep) || !destination.startsWith(path.resolve('node_modules/.cache') + path.sep)) throw Error('INVALID_BASELINE_MOVE');
    fs.renameSync(baseline, destination);
    save('baseline-directory', { directory: destination });
    return status;
  }
  if (mode === 'baseline-http') return run(mode, process.execPath, ['scripts/functional-rollback-browser.cjs'], { FR_ROLE_ONLY: '1', FR_SECURITY_BASELINE: '1', FR_BASELINE_DIRECTORY: JSON.parse(fs.readFileSync(`${directory}/baseline-directory.json`)).directory });
  if (mode === 'http') return run(mode, process.execPath, ['scripts/functional-rollback-browser.cjs'], { FR_PROFILE_SECURITY: '1' });
  if (mode === 'candidate') return run(mode, process.execPath, ['scripts/functional-rollback-browser.cjs'], { FR_CANDIDATE_DOCUMENTS: '1' });
  if (mode === 'deleted-documents') return run(mode, process.execPath, ['scripts/functional-rollback-browser.cjs'], { FR_CANDIDATE_DOCUMENTS: '1', FR_DELETED_DOCUMENTS: '1' });
  if (mode === 'browser') return run(mode, process.execPath, ['scripts/functional-rollback-browser.cjs'], { FR_SECURITY_FUNCTIONAL: '1' });
  if (mode === 'build') {
    for (const [name, args] of [['prisma', ['node_modules/prisma/build/index.js', 'validate']], ['typescript', ['node_modules/typescript/bin/tsc', '--noEmit']], ['build', ['node_modules/next/dist/bin/next', 'build', '--webpack']]]) if (await run(name, process.execPath, args)) return 1;
    return 0;
  }
  if (mode === 'checks') {
    const files = ['src/lib/auth/session.ts', 'src/lib/auth/guards.ts', 'src/app/(dashboard)/dashboard/employees/[employeeId]/page.tsx', 'src/app/api/resumes/[id]/route.ts', 'src/app/api/recruitment-documents/[id]/route.ts', 'src/app/api/onboarding-documents/[id]/route.ts', 'scripts/functional-rollback-browser.cjs', 'scripts/profile-security.cjs', 'scripts/test-profile-security-http.cjs', 'scripts/test-profile-session.cjs'];
    if (candidateReview) files.push('src/features/hiring/document-access.ts', 'src/features/hiring/recruitment-document-actions.ts', 'src/features/hiring/onboarding-actions.ts', 'src/features/hiring/resume-parser-actions.ts', 'src/features/careers/portal-actions.ts', 'scripts/test-candidate-document-http.cjs', 'scripts/test-candidate-document-headers.cjs');
    if (await run('eslint', process.execPath, ['node_modules/eslint/bin/eslint.js', ...files])) return 1;
    return run('diff-check', 'git', ['diff', '--check']);
  }
  if (mode === 'session-unit') return run(mode, process.execPath, ['scripts/test-profile-session.cjs']);
  if (mode === 'document-headers') return run(mode, process.execPath, ['scripts/test-candidate-document-headers.cjs']);
  if (mode === 'storage-metadata') {
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
    try {
      const rows = await db.$queryRaw`SELECT 'Document' AS kind, count(*)::int AS files, count(*) FILTER (WHERE "storageKey" ~* '^https?://')::int AS url_keys, count(*) FILTER (WHERE "applicationId" IS NULL)::int AS unassigned FROM "Document"
        UNION ALL SELECT 'RecruitmentDocument',count(*)::int,count(*) FILTER (WHERE "storageKey" ~* '^https?://')::int,0 FROM "RecruitmentDocument" WHERE "storageKey" IS NOT NULL
        UNION ALL SELECT 'OnboardingTask',count(*)::int,count(*) FILTER (WHERE "storageKey" ~* '^https?://')::int,0 FROM "OnboardingTask" WHERE "storageKey" IS NOT NULL`;
      save('storage-metadata', { readOnly: true, rows, rawKeysOrUrlsSaved: false, hostedAssetPermissionsInspected: false });
      helper.assertOriginalUnchanged(config); console.log(JSON.stringify({ metadataOnly: true, urlKeys: rows.reduce((count, row) => count + row.url_keys, 0) }));
    } finally { await db.$disconnect(); }
    return 0;
  }
  if (mode === 'recruitment-core') return run(mode, process.execPath, ['scripts/functional-rollback-services.cjs', 'h1'], { NODE_ENV: 'test', DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href, NODE_OPTIONS: '--require ' + path.resolve('scripts/batch2-test-preload.cjs'), WORKPULSE_FINAL_UX_PARITY: '1' });
  if (mode === 'regressions') {
    const testEnv = { NODE_ENV: 'test', DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href, NODE_OPTIONS: '--require ' + path.resolve('scripts/batch2-test-preload.cjs'), WORKPULSE_BATCH2_PARITY: '1', WORKPULSE_FINAL_UX_PARITY: '1' };
    for (const file of ['test-h4-employee-self-service.ts', 'test-h8-analytics.ts', 'test-final-ux-hiring.cjs', 'test-final-ux-payroll-state.cjs', 'test-runtime-startup.cjs']) {
      const args = file.endsWith('.ts') ? ['node_modules/tsx/dist/cli.mjs', 'scripts/' + file] : ['scripts/' + file];
      if (await run(file.replace(/\.(?:ts|cjs)$/, ''), process.execPath, args, testEnv)) return 1;
    }
    return 0;
  }
  throw Error('UNKNOWN_MODE');
}
main().then(code => { if (code) process.exitCode = code; }).catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: /^[A-Z_]+$/.test(error.message) ? error.message : undefined })); process.exitCode = 1; });
