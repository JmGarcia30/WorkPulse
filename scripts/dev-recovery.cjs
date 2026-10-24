/* eslint-disable @typescript-eslint/no-require-imports -- Local Next.js development entry point. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const helper = require('./batch0-recovery-environment.cjs');

function start() {
  const config = helper.configuration();
  const verification = JSON.parse(fs.readFileSync(path.join(helper.directory, 'schema-and-history-verification.json'), 'utf8'));
  if (!verification.h10Applied || !verification.h10ChecksumMatch || verification.identity.endpointSha256 !== config.identity.endpointSha256) {
    helper.fail('UNVERIFIED_RECOVERY_TARGET');
  }
  // Process variables outrank Next's dotenv files. Override both database URLs explicitly.
  // Keep the existing session/auth environment; never inject the audit helper's ephemeral secret.
  const argumentsList = process.argv.slice(2);
  const portIndex = argumentsList.findIndex(value => value === '--port' || value === '-p');
  const selectedPort = portIndex >= 0 ? argumentsList[portIndex + 1] : argumentsList.find(value => value.startsWith('--port='))?.slice('--port='.length) || process.env.PORT || '3000';
  if (!/^\d{1,5}$/.test(selectedPort || '') || Number(selectedPort) < 1 || Number(selectedPort) > 65535) helper.fail('INVALID_LOCAL_PORT');
  const env = {
    ...process.env,
    DATABASE_URL: config.pooled.href,
    H10_TEST_DATABASE_URL: config.direct.href,
    PLATFORM_ROOT_DOMAIN: 'localhost:' + Number(selectedPort),
    PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + Number(selectedPort),
  };
  helper.assertOriginalUnchanged(config);
  console.log('[WorkPulse dev] Using verified disposable workpulse-batch0-recovery. Original .env unchanged.');
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--webpack', ...process.argv.slice(2)], {
    env, stdio: 'inherit', windowsHide: true,
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', () => { console.error('[WorkPulse dev] Failed to start Next.js.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}

try { start(); }
catch (e) {
  console.error('[WorkPulse dev] Recovery profile unavailable or unverified. Check .env.recovery.local and recovery verification; no fallback to production. (' + (e.code || e.name) + ')');
  process.exitCode = 1;
}
