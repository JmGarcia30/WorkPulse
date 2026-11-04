/* eslint-disable @typescript-eslint/no-require-imports -- Read-only Git evidence export, no index mutations. */
const fs = require('node:fs');
const pathModule = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const directory = 'docs/payroll-v2/review';
fs.mkdirSync(directory, { recursive: true });
const digest = value => createHash('sha256').update(value).digest('hex');
function git(args) { const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }); if (result.status > 1) throw Error('GIT_EXPORT_FAILED'); return result.stdout; }
const tracked = git(['diff', '--name-only', 'HEAD', '--', 'src', 'prisma', 'scripts']).trim().split(/\r?\n/).filter(file => file && (!file.startsWith('scripts/') || /payroll/.test(file)));
const added = git(['ls-files', '--others', '--exclude-standard', '--', 'src', 'prisma', 'scripts']).trim().split(/\r?\n/).filter(path => path && (/^(src|prisma)\//.test(path) || /scripts\/(payroll-v2|test-payroll-v2)/.test(path)));
const scripts = ['scripts/payroll-v2-environment.cjs', 'scripts/payroll-v2-browser.cjs', 'scripts/test-payroll-v2.ts', 'scripts/test-payroll-v2-edges.ts'];
const files = [...new Set([...tracked, ...added, ...scripts.filter(path => fs.existsSync(path))])].sort();
let patch = git(['diff', '--binary', '--no-ext-diff', 'HEAD', '--', ...files.filter(path => !added.includes(path))]);
for (const path of added) patch += git(['diff', '--no-index', '--binary', '--no-ext-diff', '--', '/dev/null', path]);
const name = process.argv[2] || 'implementation';
if (!/^[a-z-]+$/.test(name)) throw Error('INVALID_EVIDENCE_NAME');
fs.writeFileSync(`${directory}/${name}.patch`, patch);
const protectedFiles = ['.env', '.env.recovery.local', 'docs/final-defense-qa/release-blockers/emergency/browser-baseline.json', 'docs/final-defense-qa/release-blockers/emergency/commit-review.json', 'docs/final-defense-qa/release-blockers/session-key-fix/RESULT.md'];
const record = { baseCommit: git(['rev-parse', 'HEAD']).trim(), branch: git(['branch', '--show-current']).trim(), patchSha256: digest(patch), files: files.map(path => ({ path, sha256: digest(fs.readFileSync(path)) })), protectedFiles: protectedFiles.filter(path => fs.existsSync(path)).map(path => ({ path, sha256: digest(fs.readFileSync(path)) })) };
fs.writeFileSync(`${directory}/${name}-manifest.json`, JSON.stringify(record, null, 2));
if (name === 'implementation') {
  const initial = JSON.parse(fs.readFileSync(`${directory}/initial-implementation-manifest.json`, 'utf8'));
  const initialPatch = fs.readFileSync(`${directory}/initial-implementation.patch`);
  const root = 'storage/payroll-v2-review/initial-tree';
  const marker = `${root}/.reconstructed`;
  if (!fs.existsSync(marker)) {
    for (const file of initial.files) {
      if (!/^(src|prisma|scripts)\//.test(file.path) || file.path.includes('..')) throw Error('UNSAFE_BASELINE_PATH');
      const target = `${root}/${file.path}`;
      fs.mkdirSync(pathModule.dirname(target), { recursive: true });
      const original = spawnSync('git', ['show', `${initial.baseCommit}:${file.path}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (original.status === 0) fs.writeFileSync(target, original.stdout);
    }
    const applied = spawnSync('git', ['apply', '--unsafe-paths', '--directory=' + root, `${directory}/initial-implementation.patch`], { encoding: 'utf8' });
    if (applied.status !== 0) { fs.writeFileSync('storage/payroll-v2-review/baseline-apply-error.log', applied.stderr); throw Error('BASELINE_RECONSTRUCTION_FAILED'); }
    fs.writeFileSync(marker, digest(initialPatch));
  }
  if (fs.readFileSync(marker, 'utf8') !== digest(initialPatch)) throw Error('BASELINE_PATCH_CHANGED');
  let delta = '';
  for (const file of files) {
    const previous = `${root}/${file}`;
    const diff = git(['diff', '--no-index', '--binary', '--no-ext-diff', '--', fs.existsSync(previous) ? previous : '/dev/null', file]);
    delta += diff.replaceAll('a/' + root + '/', 'a/');
  }
  fs.writeFileSync(`${directory}/followup.patch`, delta);
  const verification = spawnSync('git', ['apply', '--reverse', '--check', `${directory}/implementation.patch`], { encoding: 'utf8' });
  fs.writeFileSync(`${directory}/diff-verification.json`, JSON.stringify({ passed: verification.status === 0, completePatchSha256: digest(patch), followupPatchSha256: digest(delta), initialPatchSha256: digest(initialPatch), completePatchReverseCheck: verification.status, includesUntrackedSourceAndMigrationFiles: true, excludesEnvironmentCredentialsAndProductionRows: true }, null, 2));
  // tsconfig includes all **/*.ts: do not leave reconstructed comparison sources in the workspace.
  const cleanupRoot = pathModule.resolve(root);
  if (pathModule.dirname(cleanupRoot) !== pathModule.resolve('storage/payroll-v2-review')
    || !cleanupRoot.startsWith(pathModule.resolve('.') + pathModule.sep)
    || fs.lstatSync(cleanupRoot).isSymbolicLink()) throw Error('UNSAFE_BASELINE_CLEANUP');
  fs.rmSync(cleanupRoot, { recursive: true });
  if (verification.status !== 0) throw Error('EXPORTED_PATCH_VERIFICATION_FAILED');
}
console.log(JSON.stringify({ fileCount: files.length, patchSha256: record.patchSha256, baseCommit: record.baseCommit }));
