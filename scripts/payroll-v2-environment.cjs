/* eslint-disable @typescript-eslint/no-require-imports -- Isolated verification launcher. */
const fs = require('node:fs');
const { parseEnv } = require('node:util');
const { spawn } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const rehearsal = process.argv.includes('--rehearsal');
const branch = rehearsal ? 'br-lingering-dawn-azrdk13o' : 'br-green-king-azcpyvmo';
const profile = parseEnv(fs.readFileSync(rehearsal ? '.env.payroll-v2-rehearsal.local' : '.env.payroll-v2.local', 'utf8'));
const url = new URL(profile.DATABASE_URL);
if ((profile.PAYROLL_V2_TEST_BRANCH ?? profile.PAYROLL_REHEARSAL_BRANCH) !== branch || !url.hostname.endsWith('.neon.tech')) throw Error('UNVERIFIED_TEST_PROFILE');
for (const file of ['.env', '.env.recovery.local']) {
  if (!fs.existsSync(file)) continue;
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(file, 'utf8')))) {
    if (/DATABASE_URL$/.test(key) && value && new URL(value).hostname.replace('-pooler.', '.') === url.hostname.replace('-pooler.', '.')) throw Error('PROTECTED_DATABASE_SELECTED');
  }
}
const original = createHash('sha256').update(fs.readFileSync('.env')).digest('hex');
Object.assign(process.env, profile, { NODE_ENV: 'production', VERCEL: '0', VERCEL_ENV: '', NEXT_TELEMETRY_DISABLED: '1', SESSION_SECRET: randomBytes(48).toString('hex'), SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', GMAIL_USER: '', GMAIL_APP_PASSWORD: '', BLOB_READ_WRITE_TOKEN: '', GOOGLE_AI_API_KEY: '' });
async function main() {
  const db = new PrismaClient({ log: [] });
  try {
    const [identity] = await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch_id, current_setting('neon.endpoint_id',true) AS endpoint_id, current_database() AS database`;
    if (identity.branch_id !== branch || identity.endpoint_id !== url.hostname.replace('-pooler.', '.').split('.')[0]) throw Error('LIVE_TEST_IDENTITY_MISMATCH');
    console.log(JSON.stringify({ isolatedIdentity: identity, project: 'purple-tree-62095489' }));
  } finally { await db.$disconnect(); }
  const args = process.argv.slice(2);
  if (args[0] === '--rehearsal') args.shift();
  if (args.length) {
    const child = spawn(process.execPath, args, { env: process.env, stdio: 'inherit' });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    process.exitCode = code || 0;
  }
  if (createHash('sha256').update(fs.readFileSync('.env')).digest('hex') !== original) throw Error('ORIGINAL_ENV_CHANGED');
}
main().catch(error => { console.error(error.code || error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED]')); process.exitCode = 1; });
