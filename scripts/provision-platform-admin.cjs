/* eslint-disable @typescript-eslint/no-require-imports -- Operator-only interactive bootstrap. */
// Does not load or change .env. DATABASE_URL must be explicitly supplied by the operator.
const { createHash } = require('node:crypto');
const { createInterface } = require('node:readline/promises');
const { Writable } = require('node:stream');
const Module = require('node:module');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) throw Error('POSTGRES_TARGET_REQUIRED');
  const identity = [target.hostname.replace('-pooler.', '.'), target.port || '5432', target.pathname, target.searchParams.get('schema') || 'public'].join('|');
  const fingerprint = createHash('sha256').update(identity).digest('hex');
  if (process.argv.length === 3 && process.argv[2] === '--show-target') { console.log('Target fingerprint:', fingerprint); return; }
  if (process.argv.length !== 4 || process.argv[2] !== '--target' || process.argv[3] !== fingerprint) throw Error('EXPLICIT_MATCHING_TARGET_FINGERPRINT_REQUIRED');
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw Error('INTERACTIVE_TERMINAL_REQUIRED');
  let hidden = false;
  const output = new Writable({ write(chunk, _encoding, done) { if (!hidden) process.stderr.write(chunk); done(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const db = new PrismaClient({ datasources: { db: { url: target.href } }, log: [] });
  try {
    const confirm = await rl.question('Create the FIRST platform administrator on the fingerprinted database? Type CREATE INITIAL PLATFORM ADMIN: ');
    if (confirm !== 'CREATE INITIAL PLATFORM ADMIN') throw Error('CANCELLED');
    const name = await rl.question('Administrator name: '), email = await rl.question('Administrator email: ');
    hidden = true; process.stderr.write('Password (14–72 characters, at most 72 UTF-8 bytes; hidden): ');
    const password = await rl.question(''); process.stderr.write('\nConfirm password (hidden): ');
    const confirmation = await rl.question(''); process.stderr.write('\n');
    if (password !== confirmation) throw Error('PASSWORDS_DO_NOT_MATCH');
    require('tsx/cjs');
    const original = Module._load;
    let provision;
    try {
      Module._load = function(name, parent, main) { if (name === 'server-only') return {}; return original.call(this, name, parent, main); };
      provision = require('../src/features/platform-admin/service.ts').provisionInitialAdministrator;
    } finally { Module._load = original; }
    await provision(db, { name, email, password });
    console.log('Initial platform administrator provisioned. Sign in at /platform/login on the public platform host.');
  } finally { rl.close(); await db.$disconnect(); }
}
main().catch(error => { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'PROVISIONING_FAILED: verify target, migration, and credential requirements.'); process.exitCode = 1; });
