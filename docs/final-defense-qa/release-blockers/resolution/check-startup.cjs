// Verify HTTP rejection, not Next's early Ready banner or process liveness.
const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const { offline, scrub } = require('../../qa-runner.cjs');
async function main() {
  const env = { ...offline, NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview' };
  for (const key of Object.keys(env)) if (key.startsWith('WORKPULSE_DB_')) delete env[key];
  let log = '', child, timer;
  try {
    await new Promise((resolve, reject) => {
      child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '0'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      timer = setTimeout(() => reject(Error('STARTUP_DIAGNOSTIC_TIMEOUT')), 15000);
      child.on('error', reject);
      const receive = chunk => { log += chunk.toString(); if (log.includes('WORKPULSE_DATABASE_IDENTITY_REJECTED')) resolve(); };
      child.stdout.on('data', receive); child.stderr.on('data', receive);
    });
    clearTimeout(timer);
    const origin = log.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    if (!origin) throw Error('NO_LOCAL_SERVER_ORIGIN');
    const response = await fetch(origin + '/login', { signal: AbortSignal.timeout(5000), redirect: 'manual' });
    const result = { capturedAt: new Date().toISOString(), status: response.status >= 500 ? 'PASS' : 'FAIL',
      check: 'Built Next server denies HTTP requests when Preview identity configuration is missing',
      httpStatus: response.status, earlyReadyBannerPrinted: /Ready in/.test(log), productionWrites: 0, externalMessages: 0 };
    fs.writeFileSync(path.join(__dirname, 'startup.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result)); if (result.status !== 'PASS') process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    if (child && child.exitCode === null) {
      const closed = new Promise(resolve => child.once('close', resolve));
      child.kill(); await closed;
    }
    fs.writeFileSync(path.join(__dirname, 'startup.log'), scrub(log));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
