const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const e = require('../../qa-runner.cjs');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../baseline.json'), 'utf8'));
const intended = new Set(['.env.example', 'scripts/test-prisma-client-cache.cjs', 'src/features/email-integration/google.ts', 'src/lib/db/prisma.ts', 'src/lib/email/index.ts']);
const changed = Object.entries(baseline.hashes).filter(([file, digest]) => !fs.existsSync(file) || hash(file) !== digest).map(([file]) => file);
const unexpected = changed.filter(file => !intended.has(file));
const reports = ['docs/final-defense-qa/IT-EVAL-RELEASE-BLOCKERS.md', path.join(__dirname, 'FINAL-RESOLUTION.md')];
const missing = [];
for (const report of reports) {
  const body = fs.readFileSync(report, 'utf8');
  for (let offset = 0; (offset = body.indexOf('](', offset)) !== -1;) {
    let cursor = offset + 2, depth = 1;
    for (; cursor < body.length && depth; cursor++) { if (body[cursor] === '(') depth++; if (body[cursor] === ')') depth--; }
    const link = body.slice(offset + 2, cursor - 1); offset = cursor;
    if (!/^https?:\/\//.test(link) && !fs.existsSync(path.resolve(path.dirname(report), link.replace(/:\d+$/, '')))) missing.push(link);
  }
}
const files = fs.readdirSync(__dirname).map(file => path.join(__dirname, file)).filter(file => fs.statSync(file).isFile());
files.push(...reports, 'src/lib/db/environment-safety.ts', 'src/instrumentation.ts', 'scripts/test-release-environment.cjs', 'scripts/verify-runtime-database.ts');
const secrets = Object.values(e.profiles).flatMap(profile => Object.entries(profile).filter(([key, value]) => /SECRET|TOKEN|PASSWORD|KEY|GMAIL_USER|EMAIL_FROM|DATABASE_URL/.test(key) && value.length >= 12).map(([, value]) => value));
const leaks = files.filter(file => secrets.some(secret => fs.readFileSync(file, 'utf8').includes(secret)));
const failed = ['environment', 'singleton', 'typescript', 'lint', 'build', 'clone-identity', 'startup'].filter(id => JSON.parse(fs.readFileSync(path.join(__dirname, id + '.json'))).status !== 'PASS');
const result = { capturedAt: new Date().toISOString(), status: unexpected.length || missing.length || leaks.length || failed.length ? 'FAIL' : 'PASS',
  baselineFiles: Object.keys(baseline.hashes).length, byteIdentical: Object.keys(baseline.hashes).length - changed.length,
  intendedChangedFiles: changed.filter(file => intended.has(file)), unexpectedChangedFiles: unexpected,
  missingReportLinks: missing, configuredSecretLeaks: leaks, failedChecks: failed,
  productionWrites: 0, migrationsExecuted: 0, externalMessages: 0, releaseRecommendation: 'NO-GO' };
fs.writeFileSync(path.join(__dirname, 'validation.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result)); if (result.status !== 'PASS') process.exitCode = 1;
