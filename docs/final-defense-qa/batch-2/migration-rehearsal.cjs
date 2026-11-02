const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { profiles, offline, save, scrub } = require('../qa-runner.cjs');
const directory = 'docs/final-defense-qa/batch-2';
const migration = '20261027000100_company_registration_otp';
const hash = value => createHash('sha256').update(value).digest('hex');

async function main() {
  const profile = profiles['.env.recovery.local'];
  const target = new URL(profile.H10_TEST_DATABASE_URL);
  assert.notEqual(target.hostname.replace('-pooler.', '.'), new URL(profiles['.env'].DATABASE_URL).hostname.replace('-pooler.', '.'));
  const read = new URL(target); read.searchParams.set('options', '-c default_transaction_read_only=on');
  const reader = new PrismaClient({ datasources: { db: { url: read.href } }, log: [] });
  let identity;
  try { identity = (await reader.$queryRawUnsafe("SELECT current_database() AS database,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id,current_setting('default_transaction_read_only') AS read_only"))[0]; }
  finally { await reader.$disconnect(); }
  assert.equal(identity.branch_id, profile.WORKPULSE_TEST_NEON_BRANCH_ID);
  assert.equal(identity.endpoint_id, profile.WORKPULSE_TEST_NEON_ENDPOINT_ID);
  assert.equal(identity.read_only, 'on');
  const schema = 'batch2_otp_' + randomBytes(12).toString('hex');
  const control = new PrismaClient({ datasources: { db: { url: target.href } }, log: [] });
  try { assert.equal((await control.$queryRawUnsafe("SELECT extname FROM pg_extension WHERE extname='btree_gist'")).length, 1); await control.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"'); }
  finally { await control.$disconnect(); }
  fs.mkdirSync(directory + '/evidence', { recursive: true });
  fs.appendFileSync(directory + '/evidence/owned-schemas.jsonl', JSON.stringify({ schema, identity, test: 'B2-migration-rehearsal', createdAt: new Date().toISOString() }) + '\n');
  target.searchParams.set('schema', schema); target.searchParams.set('options', '-c search_path=' + schema + ',public');
  const env = { ...offline, NODE_ENV: 'test', DATABASE_URL: target.href, H10_TEST_DATABASE_URL: target.href, PLATFORM_ROOT_DOMAIN: 'localhost:3000', PLATFORM_PUBLIC_ORIGIN: 'http://localhost:3000' };
  Object.assign(process.env, env);
  const bundle = path.join(directory, 'migration-bundle');
  fs.mkdirSync(bundle + '/migrations', { recursive: true });
  fs.copyFileSync('prisma/schema.prisma', bundle + '/schema.prisma');
  fs.copyFileSync('prisma/migrations/migration_lock.toml', bundle + '/migrations/migration_lock.toml');
  const migrations = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  assert.equal(migrations.at(-1), migration); assert.equal(migrations.length, 39);
  for (const name of migrations.filter(name => name !== migration)) { fs.mkdirSync(bundle + '/migrations/' + name); fs.copyFileSync('prisma/migrations/' + name + '/migration.sql', bundle + '/migrations/' + name + '/migration.sql'); }
  function deploy(label) {
    let result;
    for (let attempt = 0; attempt < 8; attempt++) { result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', bundle + '/schema.prisma'], { env, encoding: 'utf8', windowsHide: true, timeout: 180000 }); if (result.status === 0 || !String(result.stderr).includes('P1002')) break; }
    fs.writeFileSync(directory + '/evidence/' + label + '.log', scrub((result.stdout || '') + (result.stderr || ''))); assert.equal(result.status, 0, label + ' migration deployment'); return result.stdout;
  }
  deploy('B2-before-38');
  const db = new PrismaClient({ datasources: { db: { url: target.href } }, log: [] });
  const checks = [];
  const ok = (value, label) => { assert(value, label); checks.push(label); console.log('PASS ' + label); };
  try {
    const columns = () => db.$queryRawUnsafe('SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name=\'CompanyRegistration\' ORDER BY ordinal_position', schema);
    const beforeColumns = await columns();
    ok(!beforeColumns.some(column => column.column_name === 'otpHash'), 'B2-M01 isolated baseline has 38 migrations and no OTP columns');
    const { hash: passwordHash } = require('bcryptjs');
    const password = randomBytes(24).toString('hex'), hashedPassword = await passwordHash(password, 4);
    const proof = randomBytes(32).toString('base64url'), stranger = randomBytes(32).toString('base64url');
    const legacyToken = randomBytes(32).toString('base64url');
    const marker = 'migration-' + randomBytes(5).toString('hex');
    const org = await db.organization.create({ data: { name: 'Synthetic existing organization', slug: marker }, select: { id: true } });
    const definitions = [
      { suffix: 'pending', token: legacyToken, expires: new Date(Date.now() + 3600000), verified: null, org: null, delivery: 'SENT' },
      { suffix: 'expired', token: randomBytes(32).toString('base64url'), expires: new Date(0), verified: null, org: null, delivery: 'SENT' },
      { suffix: 'verified', token: null, expires: new Date(0), verified: new Date('2026-10-01'), org: org.id, delivery: 'SENT' },
      { suffix: 'failed', token: randomBytes(32).toString('base64url'), expires: new Date(Date.now() + 3600000), verified: null, org: null, delivery: 'FAILED' },
    ];
    for (const record of definitions) await db.$executeRawUnsafe('INSERT INTO "CompanyRegistration" (id,email,"companyName","administratorName","passwordHash","browserHash","tokenHash","expiresAt","deliveryStatus","verifiedAt","organizationId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::"OrganizationInvitationDelivery",$10,$11,$12)', marker + '-' + record.suffix, marker + '-' + record.suffix + '@fixture.invalid', marker + '-' + record.suffix, 'Synthetic HR', record.verified ? null : hashedPassword, hash(proof), record.token ? hash(record.token) : null, record.expires, record.delivery, record.verified, record.org, new Date());
    const oldRows = () => db.$queryRawUnsafe('SELECT id,email,"companyName","administratorName","passwordHash","browserHash","tokenHash","expiresAt","lastIssuedAt","deliveryStatus","verifiedAt","organizationId","createdAt","updatedAt" FROM "CompanyRegistration" ORDER BY id');
    const beforeRows = hash(JSON.stringify(await oldRows()));
    fs.mkdirSync(bundle + '/migrations/' + migration); fs.copyFileSync('prisma/migrations/' + migration + '/migration.sql', bundle + '/migrations/' + migration + '/migration.sql');
    deploy('B2-apply-otp');
    const afterColumns = await columns();
    const added = afterColumns.filter(column => !beforeColumns.some(old => old.column_name === column.column_name));
    assert.deepEqual(added.map(column => column.column_name), ['otpHash', 'otpNonce', 'otpAttempts']);
    ok(beforeColumns.every(column => JSON.stringify(column) === JSON.stringify(afterColumns.find(item => item.column_name === column.column_name))), 'B2-M02 existing column definitions unchanged; exactly three additive columns');
    ok(hash(JSON.stringify(await oldRows())) === beforeRows, 'B2-M03 pending, expired, verified and failed legacy rows preserve every original field');
    const defaults = await db.$queryRawUnsafe('SELECT "otpHash","otpNonce","otpAttempts" FROM "CompanyRegistration"');
    ok(defaults.length === 4 && defaults.every(row => row.otpHash === null && row.otpNonce === null && row.otpAttempts === 0), 'B2-M04 existing rows receive nullable OTP fields and zero attempt default');
    const history = await db.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
    ok(history.length === 39 && history.at(-1).migration_name === migration, 'B2-M05 39 successful migration records after upgrade');
    const noOp = deploy('B2-repeat-deploy');
    ok(noOp.includes('No pending migrations'), 'B2-M06 repeat Prisma deploy is a no-op');
    require('tsx/cjs'); const Module = require('node:module'), original = Module._load;
    Module._load = function(name, parent, main) { if (name === 'server-only') return {}; return original.call(this, name, parent, main); };
    const service = require(path.resolve('src/features/company-registration/service.ts'));
    const senderMessages = [], sender = async message => { assert(message.to.endsWith('@fixture.invalid')); senderMessages.push(message); return { success: true, mode: 'smtp', id: 'synthetic' }; };
    const legacy = await service.verifyCompanyRegistration(db, legacyToken, stranger, password);
    ok(!!legacy.loginUrl && !!(await db.companyRegistration.findUniqueOrThrow({ where: { id: marker + '-pending' } })).verifiedAt, 'B2-M07 pre-migration pending legacy link verifies cross-device after upgrade');
    await assert.rejects(() => service.verifyCompanyRegistration(db, definitions[1].token, proof), error => error.code === 'INVALID_VERIFICATION');
    ok(true, 'B2-M08 pre-migration expired legacy link stays expired');
    const email = marker + '-new@fixture.invalid';
    await service.registerCompany(db, { companyName: marker + '-new', administratorName: 'Synthetic HR', email, password }, proof, sender);
    const firstCode = senderMessages.at(-1).code;
    ok(/^\d{6}$/.test(firstCode) && !await db.user.findUnique({ where: { email } }), 'B2-M09 six-digit OTP issuance creates no tenant user before verification');
    await db.companyRegistration.update({ where: { email }, data: { lastIssuedAt: new Date(0) } });
    await service.resendCompanyVerification(db, email, stranger, sender, password);
    await assert.rejects(() => service.verifyCompanyRegistration(db, firstCode, proof, '', email), error => error.code === 'INVALID_VERIFICATION');
    ok(true, 'B2-M10 cross-device resend invalidates the previous OTP');
    const currentCode = senderMessages.at(-1).code;
    await db.companyRegistration.update({ where: { email }, data: { expiresAt: new Date(0) } });
    await assert.rejects(() => service.verifyCompanyRegistration(db, currentCode, proof, '', email), error => error.code === 'EXPIRED_CODE');
    ok(true, 'B2-M11 expired OTP cannot activate an organization');
    await db.companyRegistration.update({ where: { email }, data: { lastIssuedAt: new Date(0) } });
    await service.resendCompanyVerification(db, email, stranger, sender, password);
    await service.verifyCompanyRegistration(db, senderMessages.at(-1).code, stranger, password, email);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    ok(user.role === 'HR_ADMIN' && !!user.organizationId && (await db.organization.count()) === 3, 'B2-M12 verified cross-device OTP creates exactly its own HR tenant');
    await assert.rejects(() => service.verifyCompanyRegistration(db, senderMessages.at(-1).code, stranger, password, email), error => error.code === 'USED_CODE');
    ok(true, 'B2-M13 used OTP cannot create another tenant');
    Module._load = original;
    const sql = fs.readFileSync('prisma/migrations/' + migration + '/migration.sql', 'utf8');
    save('B2-migration-rehearsal', { status: 'PASS', capturedAt: new Date().toISOString(), schema, identity, migration, migrationSha256: hash(sql), legacyRowsPreserved: 4, addedColumns: added, assertions: checks.length, checks, emails: 'in-memory synthetic-only sender; real SMTP tested separately', productionModified: false });
  } finally { await db.$disconnect(); }
}
main().catch(error => { save('B2-migration-rehearsal-failure', { status: 'FAIL', code: error.code || error.name, message: scrub(error.message) }); console.error(scrub(error.message)); process.exitCode = 1; });
