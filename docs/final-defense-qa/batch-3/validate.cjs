const fs = require('node:fs'), path = require('node:path');
const { profiles } = require('../qa-runner.cjs');
const root = __dirname, report = path.resolve(root, '../FIX-BATCH-3.md');
const links = [...fs.readFileSync(report, 'utf8').matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]);
const missing = links.filter(link => !/^https?:\/\//.test(link) && !fs.existsSync(path.resolve(path.dirname(report), link.replace(/:\d+$/, ''))));
const secrets = Object.values(profiles).flatMap(profile => Object.entries(profile).filter(([key, value]) => /SECRET|TOKEN|PASSWORD|KEY|GMAIL_USER|EMAIL_FROM|DATABASE_URL/.test(key) && value.length >= 12).map(([,value]) => value));
const files = [report];
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, e.name); if (e.isDirectory()) walk(file); else if (/\.(json|log|txt|md|cjs)$/.test(file)) files.push(file); } }
walk(root);
const leaks = files.filter(file => { const data = fs.readFileSync(file, 'utf8'); return secrets.some(secret => data.includes(secret)); });
const results = ['statutory','bir','integration','workflow','presentation','phase3','probes'].map(id => ({ id, ...JSON.parse(fs.readFileSync(path.join(root, 'evidence', id + '.json'), 'utf8')) })).map(({ id, status, assertions, exitCode }) => ({ id, status, assertions, exitCode }));
const summary = { capturedAt: new Date().toISOString(), status: results.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL', statutoryTestCases: 93, birTestCases: 56, databaseSuiteAssertions: results.reduce((sum,r) => sum + (r.assertions || 0), 0), results, limitations: ['Safety-guard passes do not establish November calculation compliance.', 'Readiness mismatch is a reproduced P2 product finding.', 'See original failure and rerun evidence for harness attempt history.'] };
fs.writeFileSync(path.join(root, 'evidence/final-test-summary.json'), JSON.stringify(summary, null, 2));
const result = { capturedAt: new Date().toISOString(), status: missing.length || leaks.length ? 'FAIL' : 'PASS', missingEvidenceLinks: missing, configuredSecretLeaks: leaks, filesInspected: files.length };
fs.writeFileSync(path.join(root, 'validation.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result)); console.log(JSON.stringify(summary));
if (result.status !== 'PASS' || summary.status !== 'PASS') process.exitCode = 1;
