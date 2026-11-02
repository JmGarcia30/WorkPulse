const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = 'docs/final-defense-qa/batch-3';
fs.mkdirSync(root, { recursive: true });
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (process.argv[2] === 'before') {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(f => f && !f.startsWith(root + '/') && fs.existsSync(f));
  files.push(...['.env', '.env.recovery.local', 'workpulse-rehearsal.env'].filter(fs.existsSync));
  fs.writeFileSync(root + '/baseline.json', JSON.stringify({ capturedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), hashes: Object.fromEntries([...new Set(files)].map(f => [f, hash(f)])) }, null, 2));
  console.log('Preexisting files fingerprinted:', files.length);
} else {
  const before = JSON.parse(fs.readFileSync(root + '/baseline.json'));
  const changed = Object.entries(before.hashes).filter(([file, digest]) => !fs.existsSync(file) || hash(file) !== digest).map(([file]) => file);
  const result = { capturedAt: new Date().toISOString(), headUnchanged: before.head === execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), filesCompared: Object.keys(before.hashes).length, changedPreexistingFiles: changed, status: changed.length ? 'FAIL' : 'PASS' };
  fs.writeFileSync(root + '/preservation.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  if (changed.length || !result.headUnchanged) process.exitCode = 1;
}
