// Read-only, unauthenticated baseline. Does not verify unreleased features.
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const profile = path.resolve('node_modules/.cache/workpulse-release/browser-baseline-' + Date.now());
const r = spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--user-data-dir=' + profile, '--dump-dom',
  'https://work-pulse-omega.vercel.app/saga/login',
], { windowsHide: true, encoding: 'utf8', timeout: 30000, maxBuffer: 5e6 });
const html = r.stdout || '';
const result = { capturedAt: new Date().toISOString(), status: r.status === 0 && /type="password"/.test(html) ? 'PASS' : 'BLOCKED',
  check: 'Chrome unauthenticated existing production login form only', url: 'https://work-pulse-omega.vercel.app/saga/login',
  passwordInputRendered: /type="password"/.test(html), browserExitCode: r.status, error: r.error?.code,
  newReleaseFeaturesVerified: false, authenticationAttempts: 0, productionBusinessWrites: 0, externalMessages: 0 };
fs.writeFileSync(path.join(__dirname, 'browser-baseline.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result)); if (result.status !== 'PASS') process.exitCode = 1;
