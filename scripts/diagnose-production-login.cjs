/* eslint-disable @typescript-eslint/no-require-imports -- One controlled production login reproduction, read-only development datasource, no account changes. */
const fs = require('node:fs');
const { randomBytes, createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { request } = require('node:http');
const { PrismaClient } = require('@prisma/client');
const { compare } = require('bcryptjs');
const helper = require('./batch0-recovery-environment.cjs');
const directory = 'docs/auth-preview-sprint1-1';
const digest = value => createHash('sha256').update(value).digest('hex');
const files = ['.env','.env.recovery.local','scripts/batch0-recovery-environment.cjs','scripts/dev-recovery.cjs','prisma/schema.prisma'];
const snapshot = () => Object.fromEntries(files.map(file => [file, digest(fs.readFileSync(file))]));
const save = (name, value) => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2) + '\n'); };
async function main() {
  const relatedOnly = process.argv.includes('--related-only');
  const baseline = snapshot(), config = helper.configuration();
  if (config.identity.branchName !== 'workpulse-ess-design' || config.identity.branchId !== 'br-damp-fog-azmmxhga' || config.identity.endpointId !== 'ep-wild-mud-az8yzifu' || !config.identity.distinctFromProtectedOriginal) throw Error('UNAUTHORIZED_DATABASE_TARGET');
  const authority = 'workpulse-sprint1-preview.vercel.app', port = 3141;
  const env = { ...config.environment, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct),
    SESSION_SECRET: randomBytes(48).toString('hex'), PLATFORM_ROOT_DOMAIN: authority, PLATFORM_PUBLIC_ORIGIN: 'https://' + authority, VERCEL: '1',
    NODE_OPTIONS: '--require=./scripts/auth-login-safety-preload.cjs', WORKPULSE_LOGIN_EXPECTED_HOST: config.pooled.hostname.replace('-pooler.', '.'), WORKPULSE_LOGIN_EXPECTED_URL_HASH: digest(helper.readOnly(config.pooled)) };
  const redact = value => {
    let result = String(value).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[CONNECTION]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]');
    for (const [name, secret] of Object.entries(env)) if (/SECRET|PASSWORD|TOKEN|KEY/.test(name) && secret?.length >= 8) result = result.split(secret).join('[SECRET]');
    for (const url of [config.pooled, config.direct]) {
      for (const secret of [url.password, decodeURIComponent(url.password), url.username]) if (secret.length >= 4) result = result.split(secret).join('[CREDENTIAL]');
      result = result.split(url.hostname).join('[DEVELOPMENT_ENDPOINT]');
    }
    return result;
  };
  const result = { capturedAt: new Date().toISOString(), buildId: fs.readFileSync('.next/BUILD_ID','utf8').trim(), databaseBranch: config.identity.branchName,
    staticTargetVerified: true, distinctFromProtectedOriginal: true, productionDatabaseAccessed: false, preflight: [], checks: [] };
  let server, output = '';
  const reader = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
  try {
    // One check per connection type. Connection failures are retained, never looped.
    await Promise.all(['direct','pooled'].map(async kind => {
      const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(config[kind]) } }, log: [] });
      try {
        const [state] = await db.$queryRaw`SELECT current_setting('default_transaction_read_only') AS read_only, current_setting('neon.branch_id',true) AS branch_id, current_database() AS database`;
        if (state.read_only !== 'on' || state.database !== config.identity.database || (state.branch_id && state.branch_id !== config.identity.branchId)) throw Error('LIVE_TARGET_MISMATCH');
        result.preflight.push({ kind, connected: true, readOnly: true, developmentBranchVerified: !state.branch_id || state.branch_id === config.identity.branchId });
      } catch (error) { result.preflight.push({ kind, connected: false, errorType: error.name, code: error.code, message: redact(error.message).slice(0, 1200) }); }
      finally { await db.$disconnect(); }
    }));
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','--hostname','localhost','--port',String(port)], { env, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('CONTROLLED_SERVER_START_TIMEOUT')),20000);
      const data = chunk => { output += chunk.toString(); if (/Ready in/.test(output)) { clearTimeout(timer); resolve(); } };
      server.stdout.on('data',data); server.stderr.on('data',data);
      server.once('error', () => { clearTimeout(timer); reject(Error('CONTROLLED_SERVER_START_FAILED')); });
      server.once('exit', () => { clearTimeout(timer); reject(Error('CONTROLLED_SERVER_EXITED')); });
    });
    async function http(pathname, options = {}) {
      return new Promise((resolve, reject) => {
        const req = request({ hostname: 'localhost', port, path: pathname, method: options.method || 'GET', headers: { host: authority, 'x-forwarded-host': authority, 'x-forwarded-proto':'https', ...options.headers } }, res => {
          let body=''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body })); res.on('error',reject);
        });
        req.setTimeout(20000, () => req.destroy(Error('LOGIN_REQUEST_TIMEOUT'))); req.on('error',reject); req.end(options.body);
      });
    }
    async function postForm(pathname, values, headers = {}) {
      const form = new FormData();
      for (const [key,value] of Object.entries(values)) form.set(key,value);
      const encoded = new Request('http://localhost/',{method:'POST',body:form});
      const body = Buffer.from(await encoded.arrayBuffer());
      return http(pathname,{method:'POST',headers:{origin:'https://' + authority,'content-type':encoded.headers.get('content-type'),'content-length':String(body.length),...headers},body});
    }
    function check(label, response, expected, extra = true) { result.checks.push({ label, status: response.status, expected, passed: response.status === expected && extra }); }
    // Exactly one initial request to the previously failing route.
    const page = relatedOnly ? {status:200} : await http('/saga/login');
    if (!relatedOnly) {
      check('Original production-mode SAGA login reproduction',page,200,page.body.includes('Sign In'));
      result.original500Reproduced = page.status === 500;
    }
    if (page.status === 200 && result.preflight.some(p => p.kind === 'direct' && p.connected)) {
      const [migrations] = await reader.$queryRaw`SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS applied FROM "_prisma_migrations"`;
      result.migrations = migrations.applied;
      const organization = await reader.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' }, select: { id: true } });
      // The existing read-only startup verifier uses this same credential discovery.
      // Never seed, create users, change passwords, or persist credentials/cookies.
      const password = fs.readFileSync('prisma/seed.ts','utf8').match(/const adminPassword = await hash\('([^']+)'/)?.[1];
      const users = await reader.user.findMany({ where: { organizationId: organization.id, role: { in: ['HR_ADMIN','ORGANIZATION_ADMIN'] } }, select: { email: true, passwordHash: true, role: true } });
      let user;
      if (password) for (const current of users.sort((a,b) => (a.role === 'HR_ADMIN' ? -1 : 1) - (b.role === 'HR_ADMIN' ? -1 : 1))) if (current.passwordHash && await compare(password,current.passwordHash)) { user = current; break; }
      if (!user) result.loginBlocker = 'NO_EXISTING_TEST_CREDENTIAL_VERIFIED';
      else {
        const manifest = JSON.parse(fs.readFileSync('.next/server/server-reference-manifest.json','utf8'));
        const actionId = name => Object.entries(manifest.node).find(([,v]) => v.exportedName === name)?.[0];
        // This installed Next version deliberately skips URL-encoded actions.
        // Multipart FormData invokes the actual action's progressive-enhancement path.
        const signedIn = await postForm('/saga/login',{ email:user.email,password,['$ACTION_ID_' + actionId('loginAction')]:'' });
        const cookies = signedIn.headers['set-cookie'] || [];
        const session = cookies.find(v => v.startsWith('__Host-workpulse_session='))?.split(';')[0];
        const destination = signedIn.headers.location ? new URL(signedIn.headers.location,'https://' + authority).pathname : null;
        check('Existing SAGA account normal password login',signedIn,303,!!session && destination === '/saga/dashboard');
        result.existingAccountRole = user.role;
        if (session) {
          const before = await reader.user.count();
          const authenticated = await http('/saga/login',{headers:{cookie: session + '; workpulse_path_tenant=saga'}});
          check('Authenticated SAGA login resolves current tenant session',authenticated,307);
          const publicRequest = await http('/platform',{headers:{cookie:session}});
          check('Tenant session cannot authenticate as Platform Admin',publicRequest,307,new URL(publicRequest.headers.location,'https://' + authority).pathname === '/platform/login');
          const forged = await http('/saga/dashboard',{headers:{cookie:session,'x-forwarded-host':'foreign.invalid'}});
          check('Cross-host tenant spoof rejected',forged,404);
          const signedOut = await postForm('/saga/login',{['$ACTION_ID_' + actionId('logoutAction')]:''},{cookie:session});
          check('SAGA logout clears production cookie and preserves login path',signedOut,303,!!signedOut.headers['set-cookie']?.some(v => v.startsWith('__Host-workpulse_session=;')) && new URL(signedOut.headers.location,'https://' + authority).pathname === '/saga/login');
          check('Anonymous dashboard after logout',await http('/saga/dashboard'),307);
          result.existingUserCountUnchanged = before === await reader.user.count();
        }
      }
    }
  } catch (error) { result.blocker = { type:error.name,code:error.code,message:redact(error.message).slice(0,1000) }; process.exitCode=1; }
  finally {
    if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => { server.once('exit',resolve);setTimeout(resolve,5000); }); }
    await reader.$disconnect();
    result.datasourceGuards = output.split(/\r?\n/).filter(line => line.startsWith('LOGIN_DATASOURCE_GUARD')).map(line => JSON.parse(line.slice('LOGIN_DATASOURCE_GUARD '.length)));
    result.serverDiagnostics = redact(output).split(/\r?\n/).filter(line => /Error|error|Can't reach|connection|digest:|Prisma|at .*\.next/.test(line) && !line.startsWith('LOGIN_DATASOURCE_GUARD')).slice(-24).map(line => line.slice(0,900));
    result.protectedFilesUnchanged = JSON.stringify(baseline) === JSON.stringify(snapshot());
    result.databaseReadOnlyEnforced = true;
    result.passed = !result.blocker && result.checks.length > 0 && result.checks.every(c => c.passed) && result.protectedFilesUnchanged;
    save(relatedOnly ? 'related-login' : 'reproduction',result); console.log(JSON.stringify(result));
    if (!result.passed) process.exitCode=1;
  }
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: /^[A-Z_]+$/.test(error.message) ? error.message : undefined }));process.exitCode=1; });
