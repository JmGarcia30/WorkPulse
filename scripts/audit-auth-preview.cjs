/* eslint-disable @typescript-eslint/no-require-imports -- Pinned read-only development audit and local production HTTP smoke; never migrates or authenticates against real accounts. */
const fs = require('node:fs');
const { randomBytes, createHash } = require('node:crypto');
const { parseEnv } = require('node:util');
const { spawn } = require('node:child_process');
const { request: httpRequest } = require('node:http');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const directory = 'docs/auth-preview-sprint1';
const save = (name, value) => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(directory + '/' + name + '.json', JSON.stringify(value, null, 2) + '\n'); };
const protectedFiles = ['.env', '.env.recovery.local', 'scripts/batch0-recovery-environment.cjs', 'scripts/dev-recovery.cjs', 'scripts/execute-batch0-recovery.cjs', 'prisma/schema.prisma'];
const fileHashes = () => Object.fromEntries(protectedFiles.map(name => [name, createHash('sha256').update(fs.readFileSync(name)).digest('hex')]));
async function main() {
  const baseline = fileHashes(), config = helper.configuration();
  if (config.identity.branchName !== 'workpulse-ess-design' || config.identity.branchId !== 'br-damp-fog-azmmxhga' || config.identity.endpointId !== 'ep-wild-mud-az8yzifu') throw Error('UNEXPECTED_DEVELOPMENT_TARGET');
  const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
  let server;
  try {
    const [state] = await db.$queryRaw`SELECT current_database() AS database, current_schema() AS schema, current_setting('default_transaction_read_only') AS read_only, current_setting('neon.branch_id',true) AS branch_id`;
    if (state.read_only !== 'on' || state.database !== config.identity.database || state.schema !== 'public' || (state.branch_id && state.branch_id !== config.identity.branchId)) throw Error('READ_ONLY_TARGET_MISMATCH');
    const migrations = await db.$queryRaw`SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS applied, count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unfinished FROM "_prisma_migrations"`;
    const roles = await db.user.groupBy({ by: ['role'], _count: { _all: true } });
    const accounts = await db.employeeAccount.groupBy({ by: ['status'], _count: { _all: true } });
    const administrators = await db.platformAdministrator.count({ where: { disabledAt: null } });
    const columns = await db.$queryRaw`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('User','EmployeeAccount','PlatformAdministrator','PlatformAdministratorSession','CandidateAccess','OrganizationEmailIntegration','OrganizationEmailOAuthAttempt','RfidKioskSession','CompanyRegistration','AttendanceEvent','DailyAttendanceRecord') ORDER BY table_name, ordinal_position`;
    const before = await helper.fingerprints(db, columns);
    const local = parseEnv(fs.readFileSync('.env', 'utf8')), profile = parseEnv(fs.readFileSync('.env.recovery.local', 'utf8'));
    const variables = ['DATABASE_URL','SESSION_SECRET','PLATFORM_ROOT_DOMAIN','PLATFORM_PUBLIC_ORIGIN','GOOGLE_EMAIL_CLIENT_ID','GOOGLE_EMAIL_CLIENT_SECRET','EMAIL_OAUTH_ENCRYPTION_KEY','SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASSWORD','EMAIL_FROM','GMAIL_USER','GMAIL_APP_PASSWORD','BLOB_READ_WRITE_TOKEN'];
    save('read-only-preflight', { capturedAt: new Date().toISOString(), developmentBranch: config.identity.branchName, targetDistinctFromProtectedOriginal: config.identity.distinctFromProtectedOriginal, readOnly: state.read_only === 'on', migrations: migrations[0], localMigrationDirectories: fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(x => x.isDirectory()).length, roles, employeeAccountStatuses: accounts, activePlatformAdministrators: administrators, linkedVercelProject: fs.existsSync('.vercel/project.json'), environmentPresenceOnly: Object.fromEntries(variables.map(name => [name, { localEnv: !!local[name], recoveryProfile: !!profile[name], currentShell: !!process.env[name] }])) });
    if (!fs.existsSync('.next/BUILD_ID')) throw Error('LOCAL_PRODUCTION_BUILD_MISSING');
    const authority = 'workpulse-sprint1-preview.vercel.app', port = 3141;
    const env = { ...config.environment, NODE_ENV: 'production', SESSION_SECRET: randomBytes(48).toString('hex'), DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), PLATFORM_ROOT_DOMAIN: authority, PLATFORM_PUBLIC_ORIGIN: 'https://' + authority, VERCEL: '1' };
    let output = '';
    // NextURL normalizes 127.0.0.1 to localhost. Keep the initial internal origin
    // identical so internal rewrites cannot be mistaken for external requests.
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', 'localhost', '--port', String(port)], { env, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('LOCAL_HTTP_START_TIMEOUT')), 20000);
      const onData = chunk => { output += chunk.toString(); if (/Ready in/.test(output)) { clearTimeout(timer); resolve(); } };
      server.stdout.on('data', onData); server.stderr.on('data', onData);
      server.once('error', () => { clearTimeout(timer); reject(Error('LOCAL_HTTP_START_FAILED')); });
      server.once('exit', () => { clearTimeout(timer); reject(Error('LOCAL_HTTP_EXITED')); });
    });
    const checks = [];
    async function test(pathname, expectedStatus, options = {}, bodyMatch) {
      // Node 24 fetch replaces a supplied Host header with the connection host.
      // Raw HTTP preserves the exact simulated deployment authority on the wire.
      const response = await new Promise((resolve, reject) => {
        const req = httpRequest({ hostname: 'localhost', port, path: pathname, method: options.method || 'GET', headers: { host: authority, 'x-forwarded-host': authority, 'x-forwarded-proto': 'https', ...options.headers } }, res => {
          let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; });
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
          res.on('error', reject);
        });
        req.setTimeout(15000, () => req.destroy(Error('LOCAL_HTTP_REQUEST_TIMEOUT')));
        req.on('error', reject); req.end(options.body);
      });
      const passed = response.status === expectedStatus && (!bodyMatch || response.body.includes(bodyMatch));
      checks.push({ path: pathname, method: options.method || 'GET', status: response.status, expectedStatus, passed, location: response.headers.location ? new URL(response.headers.location, 'https://' + authority).pathname : null });
    }
    await test('/saga/login', 200);
    if (process.argv.includes('--login-diagnostic')) {
      const diagnostics = output.split(/\r?\n/).filter(line => /Error:|digest:|error code|PrismaClient/.test(line)).map(line => line.replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]')).slice(-6);
      save('login-diagnostic', { checks, diagnostics }); console.log(JSON.stringify({ checks, diagnostics })); return;
    }
    await test('/platform/login', 200);
    await test('/platform', 307);
    await test('/saga/dashboard', 307);
    await test('/saga/employee', 307);
    await test('/dashboard', 307, { headers: { cookie: 'workpulse_path_tenant=saga' } });
    await test('/saga/dashboard', 307, { headers: { cookie: '__Host-workpulse_session=invalid' } });
    await test('/saga/attendance-kiosk', 200, {}, 'Kiosk authorization required');
    await test('/saga/api/attendance/rfid/scan', 401, { method: 'POST', headers: { origin: 'https://' + authority, 'content-type': 'application/json' }, body: '{}' });
    await test('/saga/api/attendance/rfid/kiosk', 403, { method: 'POST', headers: { origin: 'https://' + authority } });
    await test('/saga/api/attendance/rfid/scan', 400, { method: 'POST', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: '{}' });
    await test('/register', 200);
    await test('/api/email-integration/google/callback?error=access_denied', 400);
    await test('/saga/login', 404, { headers: { host: 'unconfigured.invalid', 'x-forwarded-host': 'unconfigured.invalid' } });
    const after = await helper.fingerprints(db, columns);
    const unchanged = JSON.stringify(before.tables) === JSON.stringify(after.tables);
    const protectedFilesUnchanged = JSON.stringify(baseline) === JSON.stringify(fileHashes());
    const result = { capturedAt: new Date().toISOString(), passed: checks.every(x => x.passed) && unchanged && protectedFilesUnchanged, scope: 'Local compiled production server with simulated Vercel Host; NOT a hosted Vercel deployment', assertions: checks.length, checks, protectedTablesUnchanged: unchanged, protectedTableCount: before.tables.length, protectedFilesUnchanged, databaseReadOnly: true };
    save('local-http', result);
    console.log(JSON.stringify(result));
    if (!result.passed) process.exitCode = 1;
  } finally {
    if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => { server.once('exit', resolve); setTimeout(resolve, 5000); }); }
    await db.$disconnect(); helper.assertOriginalUnchanged(config);
    if (JSON.stringify(baseline) !== JSON.stringify(fileHashes())) throw Error('PROTECTED_FILE_CHANGED');
  }
}
main().catch(error => { console.error(JSON.stringify({ code: /^[A-Z_]+$/.test(error.message) ? error.message : error.code || error.name })); process.exitCode = 1; });
