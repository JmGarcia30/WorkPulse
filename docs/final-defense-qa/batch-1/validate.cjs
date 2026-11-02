const fs = require('node:fs');
const path = require('node:path');
const { profiles } = require('../qa-runner.cjs');
const report = path.resolve('docs/final-defense-qa/FIX-BATCH-1.md');
const text = fs.readFileSync(report, 'utf8');
const missing = [...text.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]).filter(link => !/^https?:\/\//.test(link) && !fs.existsSync(path.resolve(path.dirname(report), link)));
const secrets = Object.values(profiles).flatMap(profile => Object.entries(profile).filter(([key, value]) => /SECRET|TOKEN|PASSWORD|KEY|GMAIL_USER|EMAIL_FROM|DATABASE_URL/.test(key) && value.length >= 12).map(([, value]) => value));
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file); else if (/\.(json|jsonl|log|md)$/.test(file)) files.push(file);
  }
}
walk('docs/final-defense-qa/batch-1'); files.push(report);
const leaks = files.filter(file => { const body = fs.readFileSync(file, 'utf8'); return secrets.some(secret => body.includes(secret)); });
const result = { capturedAt: new Date().toISOString(), status: missing.length || leaks.length ? 'FAIL' : 'PASS', missingEvidenceLinks: missing, configuredSecretLeaks: leaks, filesInspected: files.length };
fs.writeFileSync('docs/final-defense-qa/batch-1/validation.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result)); if (result.status !== 'PASS') process.exitCode = 1;
