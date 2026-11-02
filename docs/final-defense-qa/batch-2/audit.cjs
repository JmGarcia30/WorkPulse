const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = 'docs/final-defense-qa/batch-2';
fs.mkdirSync(root, { recursive: true });
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(file => file && fs.existsSync(file));
const preserved = ['REPORT.md', 'BUGS.md', 'TEST-RESULTS.md', 'DEMO-READINESS.md', 'FIX-BATCH-1.md'].map(name => 'docs/final-defense-qa/' + name);
function walk(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, item.name); if (item.isDirectory()) walk(file); else preserved.push(file); } }
walk('docs/final-defense-qa/batch-1');
const snapshot = { capturedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), hashes: Object.fromEntries([...new Set([...tracked, ...preserved, '.env', '.env.recovery.local', 'workpulse-rehearsal.env'])].filter(fs.existsSync).map(file => [file, hash(file)])) };
if (process.argv[2] === 'before') fs.writeFileSync(root + '/baseline.json', JSON.stringify(snapshot, null, 2) + '\n');
else { const before = JSON.parse(fs.readFileSync(root + '/baseline.json')); const changed = Object.entries(before.hashes).filter(([file, digest]) => !fs.existsSync(file) || hash(file) !== digest).map(([file]) => file); const result = { capturedAt: snapshot.capturedAt, headUnchanged: before.head === snapshot.head, changedPreexistingFiles: changed, status: changed.length || before.head !== snapshot.head ? 'FAIL' : 'PASS' }; fs.writeFileSync(root + '/preservation.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result)); if (result.status !== 'PASS') process.exitCode = 1; }
