const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const { scrub } = require('../qa-runner.cjs');
const out = path.join(__dirname, 'evidence'); fs.mkdirSync(out, { recursive: true });
const log = fs.createWriteStream(path.join(out, 'browser.log'));
const start = Date.now();
const child = spawn(process.execPath, [path.join(__dirname, 'browser.cjs')], { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { const text = scrub(data.toString()); log.write(text); process.stdout.write(text); });
child.on('error', error => { log.write(scrub(error.message)); process.exitCode = 1; });
child.on('close', code => {
  log.end(); fs.writeFileSync(path.join(out, 'browser-run.json'), JSON.stringify({ capturedAt: new Date().toISOString(), status: code === 0 ? 'PASS' : 'FAIL', exitCode: code, durationMs: Date.now() - start }, null, 2));
  process.exitCode = code || 0;
});
