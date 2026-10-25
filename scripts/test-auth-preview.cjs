/* eslint-disable @typescript-eslint/no-require-imports -- Focused actual-module tests with in-memory database and request boundaries; no network or database writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { randomBytes } = require('node:crypto');
const { hash } = require('bcryptjs');
require('tsx/cjs');

process.env.NODE_ENV = 'production';
process.env.SESSION_SECRET = randomBytes(48).toString('hex');
process.env.PLATFORM_ROOT_DOMAIN = 'workpulse-sprint1-preview.vercel.app';
process.env.PLATFORM_PUBLIC_ORIGIN = 'https://' + process.env.PLATFORM_ROOT_DOMAIN;
process.env.GOOGLE_EMAIL_CLIENT_ID = 'synthetic-client';
process.env.GOOGLE_EMAIL_CLIENT_SECRET = 'synthetic-secret';
process.env.EMAIL_OAUTH_ENCRYPTION_KEY = randomBytes(32).toString('base64');
const authority = process.env.PLATFORM_ROOT_DOMAIN;
const context = { headers: new Headers({ host: authority }), jar: new Map() };
const organizations = [{ id: 'org-saga', slug: 'st-aloysius' }, { id: 'org-other', slug: 'other' }];
let users = [], admin, kiosk, candidate;
const platformSessions = new Map(), attempts = new Map(), checks = [];
const db = {
  user: {
    findFirst: async ({ where }) => users.find(u => (!where.id || u.id === where.id) && (!where.email || u.email === where.email) && u.organizationId === where.organizationId) ?? null,
    findUnique: async ({ where }) => users.find(u => u.id === where.id) ?? null,
  },
  organization: { findUnique: async ({ where }) => organizations.find(o => o.slug === where.slug || o.id === where.id) ?? null },
  platformAdministrator: { findUnique: async ({ where }) => admin && (admin.id === where.id || admin.email === where.email) ? admin : null },
  platformAuthenticationAttempt: {
    findUnique: async ({ where }) => attempts.get(where.key),
    update: async ({ where }) => { attempts.get(where.key).attempts++; },
    upsert: async ({ where, create, update }) => attempts.set(where.key, attempts.has(where.key) ? update : create),
  },
  platformAdministratorSession: {
    create: async ({ data }) => platformSessions.set(data.tokenHash, data),
    findUnique: async ({ where }) => { const s = platformSessions.get(where.tokenHash); return s ? { ...s, administrator: admin } : null; },
    deleteMany: async ({ where }) => platformSessions.delete(where.tokenHash),
  },
  rfidKioskSession: { findFirst: async ({ where }) => kiosk?.organizationId === where.organizationId && kiosk?.tokenHash === where.tokenHash ? kiosk : null },
  candidateAccess: {
    findFirst: async ({ where }) => candidate && candidate.applicationId === where.applicationId && candidate.sessionHash === where.sessionHash && candidate.sessionExpiresAt > where.sessionExpiresAt.gt && !candidate.revoked ? { application: { job: { organizationId: 'org-saga' } } } : null,
    updateMany: async ({ where, data }) => {
      const matches = candidate && candidate.applicationId === where.applicationId && candidate.linkHash === where.linkHash && candidate.delivered && !candidate.revoked && candidate.linkExpiresAt > where.linkExpiresAt.gt && where.application.job.organization.slug === 'st-aloysius';
      if (matches) Object.assign(candidate, data);
      return { count: matches ? 1 : 0 };
    },
  },
  $queryRaw: async () => [{ now: new Date() }],
  $transaction: async operation => operation(db),
};
const original = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'server-only') return {};
  if (name === 'next/headers') return { headers: async () => context.headers, cookies: async () => ({
    get: key => context.jar.get(key), has: key => context.jar.has(key),
    set: (key, value, options) => context.jar.set(key, { value, ...options }), delete: key => context.jar.delete(key),
  }) };
  if (name === 'next/navigation') return { redirect: url => { throw Error('REDIRECT:' + url); }, notFound: () => { throw Error('NOT_FOUND'); } };
  if (name === 'next/cache') return { revalidatePath: () => {} };
  if (name === '@/lib/db/prisma') return { prisma: db };
  if (name === '@/features/organization-branding/read-model') return { getOrganizationBrandingBySlug: async slug => {
    const o = organizations.find(o => o.slug === (slug === 'saga' ? 'st-aloysius' : slug)); return o ? { organizationId: o.id, slug: o.slug } : null;
  } };
  if (name === '@/lib/email') return {};
  if (name === '@/features/hiring/document-access') return {
    candidatePortalMatchesRequestTenant: async slug => ['saga', 'st-aloysius'].includes(slug),
    candidateDocumentMatchesRequestTenant: async id => id === 'org-saga',
  };
  if (name.startsWith('@/')) return original.call(this, path.resolve('src', name.slice(2)), parent, main);
  return original.call(this, name, parent, main);
};
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); };
const reject = async (operation, code, label) => { await assert.rejects(operation, e => e.code === code || e.message === code); check(true, label); };
const cookieSafe = value => value.httpOnly && value.secure && value.path === '/' && !value.domain;

async function main() {
  const { NextRequest } = require('next/server');
  const { proxy } = require('../src/proxy.ts');
  const host = require('../src/lib/tenant/host.ts');
  const routing = require('../src/lib/tenant/routing-context.ts');
  const session = require('../src/lib/auth/session.ts');
  const actions = require('../src/lib/auth/actions.ts');
  const guards = require('../src/lib/auth/guards.ts');
  const request = (pathname, extra = {}, hostname = authority) => new NextRequest('https://' + hostname + pathname, { headers: { host: hostname, ...extra } });
  const adopt = response => {
    context.headers = new Headers({ host: authority });
    for (const [key, value] of response.headers) if (key.startsWith('x-middleware-request-')) context.headers.set(key.slice(21), value);
  };
  check(host.usesTemporaryPathTenancy(authority) && host.tenantOrigin('saga') === '/saga' && host.discoveryOrigin() === '/workspace-discovery', 'Matching Preview hostname selects SAGA path tenancy and local workspace discovery');
  for (const invalid of ['evil.test', 'saga.' + authority + '.evil.test', authority + ',evil.test']) check((await proxy(request('/', {}, invalid))).status === 404, 'Unconfigured/malformed Host fails closed: ' + invalid);
  check((await proxy(request('/saga/login', { 'x-forwarded-host': 'evil.test' }))).status === 404, 'Forwarded-host disagreement cannot select a tenant');
  const login = await proxy(request('/saga/login', { 'x-workpulse-tenant-slug': 'other', [routing.ROUTING_CONTEXT_HEADER]: 'forged' }));
  adopt(login);
  check(new URL(login.headers.get('x-middleware-rewrite')).pathname === '/login' && routing.readRoutingContext(context.headers)?.organizationId === 'org-saga', 'SAGA login rewrites with verified organization context, replacing spoofed headers');
  check(login.cookies.get('workpulse_path_tenant').secure && login.cookies.get('workpulse_path_tenant').httpOnly, 'SAGA routing hint uses a secure HttpOnly cookie');
  const signature = context.headers.get(routing.ROUTING_CONTEXT_HEADER);
  context.headers.set(routing.ROUTING_CONTEXT_HEADER, signature + '!');
  check(routing.readRoutingContext(context.headers) === null, 'Tampered routing signatures are rejected');
  adopt(login);
  const anonymous = await proxy(request('/saga/dashboard'));
  check(new URL(anonymous.headers.get('location')).pathname === '/saga/login', 'Anonymous SAGA dashboard redirects to SAGA login');
  check(new URL((await proxy(request('/dashboard', { cookie: 'workpulse_path_tenant=saga' }))).headers.get('location')).pathname === '/saga/dashboard', 'Remembered bare dashboard preserves SAGA prefix');
  check(new URL((await proxy(request('/login'))).headers.get('location')).pathname === '/workspace-discovery', 'Bare public login uses discovery rather than a tenant guess');
  check(new URL((await proxy(request('/saga/attendance-kiosk'))).headers.get('x-middleware-rewrite')).pathname === '/attendance-kiosk', 'Kiosk path reaches its independent authorization boundary without an HR session');
  const platform = await proxy(request('/platform', { cookie: 'workpulse_path_tenant=saga' }));
  check(!platform.headers.has('x-middleware-request-' + routing.ROUTING_CONTEXT_HEADER), 'Platform routes remain outside remembered SAGA tenant context');

  const password = randomBytes(18).toString('hex'), passwordHash = await hash(password, 4);
  users = [{ id: 'hr', organizationId: 'org-saga', role: 'HR_ADMIN', name: 'Synthetic HR', email: 'hr@fixture.invalid', passwordHash },
    { id: 'foreign', organizationId: 'org-other', role: 'HR_ADMIN', email: 'foreign@fixture.invalid', passwordHash }];
  const form = (email = ' HR@fixture.invalid ', pass = password) => { const f = new FormData(); f.set('email', email); f.set('password', pass); return f; };
  check(!!(await actions.loginAction(form('hr@fixture.invalid', 'wrong'))).error && !context.jar.has(session.COOKIE_NAME), 'Incorrect password cannot create a staff session');
  check(!!(await actions.loginAction(form('foreign@fixture.invalid'))).error, 'Login scopes persisted credential lookup to the request tenant');
  await reject(() => actions.loginAction(form()), 'REDIRECT:/saga/dashboard', 'Valid HR credentials sign in to SAGA dashboard');
  const staffToken = context.jar.get(session.COOKIE_NAME).value;
  check(cookieSafe(context.jar.get(session.COOKIE_NAME)) && session.COOKIE_NAME.startsWith('__Host-'), 'Production staff cookie is host-only, secure, HttpOnly, path /');
  check((await guards.requireBackOfficeContext()).role === 'HR_ADMIN', 'Current HR role can enter back office');
  users[0].role = 'EMPLOYEE'; check(await session.getSession() === null, 'Persisted role changes invalidate issued JWT permissions'); users[0].role = 'HR_ADMIN';
  context.jar.set(session.COOKIE_NAME, { value: staffToken + '!' }); check(await session.getSession() === null, 'Invalid JWT signature fails closed');
  const { SignJWT } = await import('jose');
  const payload = { userId: 'hr', organizationId: 'org-saga', role: 'HR_ADMIN', name: 'Fixture', email: 'hr@fixture.invalid' };
  context.jar.set(session.COOKIE_NAME, { value: await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('-1s').sign(new TextEncoder().encode(process.env.SESSION_SECRET)) });
  check(await session.getSession() === null, 'Expired staff JWT cannot authenticate');
  context.jar.set(session.COOKIE_NAME, { value: staffToken });
  context.headers = new Headers({ host: 'other.' + authority });
  check(await session.getSession() === null, 'Signed SAGA JWT cannot authenticate on another persisted tenant');
  adopt(login);
  for (const role of ['ORGANIZATION_ADMIN', 'HR_ADMIN', 'HIRING_MANAGER', 'EMPLOYEE']) {
    users[0].role = role; await session.createSession({ ...payload, role });
    if (role === 'EMPLOYEE') await reject(() => guards.requireBackOfficeContext(), 'FORBIDDEN', 'Employee cannot enter HR back office');
    else check((await guards.requireBackOfficeContext()).role === role, role + ' has the existing back-office role permission');
  }
  await reject(() => actions.logoutAction(), 'REDIRECT:/saga/login', 'Staff logout preserves SAGA login path');
  check(await session.getSession() === null && !context.jar.has(session.COOKIE_NAME), 'Logout deletes this browser staff session');
  users[0].role = 'HR_ADMIN'; context.jar.set(session.COOKIE_NAME, { value: staffToken });
  check(!!await session.getSession(), 'Recorded limitation: copied staff JWT remains usable after browser-only logout');
  context.jar.clear();
  const { resolveEmployeeSelfContext } = require('../src/features/employee-self-service/access.ts');
  users[0].role = 'EMPLOYEE'; users[0].employeeAccount = { id: 'account', status: 'ACTIVE', organizationId: 'org-saga', employee: { id: 'employee', organizationId: 'org-saga', employeeStatus: 'ACTIVE' }, organization: { id: 'org-saga', timeZone: 'Asia/Manila' } };
  await reject(() => actions.loginAction(form()), 'REDIRECT:/saga/employee', 'Active ESS credentials sign in to SAGA Employee portal');
  check((await resolveEmployeeSelfContext(await session.getSession(), { organizationId: 'org-saga' }, db)).account.id === 'account', 'ESS resolves only its linked active employee');
  users[0].employeeAccount.status = 'DISABLED';
  check(!!(await actions.loginAction(form())).error, 'Disabled employee account cannot sign in');
  await reject(() => resolveEmployeeSelfContext({ ...payload, role: 'EMPLOYEE' }, { organizationId: 'org-saga' }, db), 'ACCOUNT_UNAVAILABLE', 'Existing ESS session loses employee access after account disable');
  context.jar.clear(); context.headers = new Headers({ host: authority });

  const platformService = require('../src/features/platform-admin/service.ts');
  const platformActions = require('../src/features/platform-admin/actions.ts');
  const platformSession = require('../src/features/platform-admin/session.ts');
  admin = { id: 'platform-admin', email: 'admin@fixture.invalid', name: 'Synthetic Admin', passwordHash, disabledAt: null };
  check(!!(await platformActions.platformLoginAction({}, form(admin.email, 'wrong'))).error, 'Platform invalid password creates no session');
  await reject(() => platformActions.platformLoginAction({}, form(admin.email)), 'REDIRECT:/platform', 'Platform credentials create a separate platform login');
  const platformCookie = context.jar.get(platformSession.PLATFORM_COOKIE);
  check(cookieSafe(platformCookie) && platformCookie.sameSite === 'strict' && platformCookie.maxAge === 28800, 'Platform cookie has secure host-only eight-hour strict attributes');
  check((await platformSession.requirePlatformAdministrator()).id === admin.id, 'Persisted active platform session authenticates');
  admin.disabledAt = new Date(); check(await platformService.findPlatformAdministrator(db, platformCookie.value) === null, 'Disabled platform administrator immediately loses access'); admin.disabledAt = null;
  const stored = [...platformSessions.values()][0]; stored.expiresAt = new Date(0);
  check(await platformService.findPlatformAdministrator(db, platformCookie.value) === null, 'Expired platform session is rejected'); stored.expiresAt = new Date(Date.now() + 60000);
  context.headers = new Headers({ host: 'other.' + authority });
  await reject(() => platformSession.requirePlatformAdministrator(), 'NOT_FOUND', 'Platform authentication cannot run on a tenant host');
  context.headers = new Headers({ host: authority });
  await reject(() => platformActions.platformLogoutAction(), 'REDIRECT:/platform/login', 'Platform logout returns to platform login');
  check(await platformService.findPlatformAdministrator(db, platformCookie.value) === null, 'Platform logout revokes copied token server-side');
  for (let i = 0; i < 5; i++) await platformService.authenticatePlatformAdministrator(db, admin.email, 'wrong');
  check(await platformService.authenticatePlatformAdministrator(db, admin.email, password) === null, 'Platform per-identity login throttle blocks exhausted budget');

  const rfid = require('../src/features/attendance/rfid-service.ts');
  const rfidServer = require('../src/features/attendance/rfid-server.ts');
  const transport = require('../src/app/api/attendance/rfid/transport.ts');
  adopt(login);
  for (const role of ['HR_ADMIN', 'ORGANIZATION_ADMIN', 'HIRING_MANAGER', 'EMPLOYEE']) {
    users[0].role = role; await session.createSession({ ...payload, role });
    if (role.endsWith('ADMIN')) check((await rfidServer.rfidHRContext()).actorUserId === 'hr', role + ' may authorize RFID');
    else await reject(() => rfidServer.rfidHRContext(), 'UNAUTHORIZED', role + ' cannot authorize RFID');
  }
  users[0].role = 'HR_ADMIN'; context.jar.clear();
  const kioskToken = randomBytes(32).toString('hex');
  kiosk = { id: 'kiosk', organizationId: 'org-saga', tokenHash: rfid.rfidTokenHash(kioskToken), authorizedById: 'hr', expiresAt: new Date(Date.now() + 60000), revokedAt: null };
  const service = rfid.createRfidService(db, process.env.SESSION_SECRET);
  check(!!await service.getKiosk('org-saga', kioskToken), 'Authorized RFID session works without a staff session');
  await reject(() => service.getKiosk('org-other', kioskToken), 'KIOSK_EXPIRED', 'RFID token cannot cross tenant boundary');
  await reject(() => service.getKiosk('org-saga', '0000000123'), 'KIOSK_EXPIRED', 'Physical card number alone cannot authenticate a kiosk');
  kiosk.revokedAt = new Date(); await reject(() => service.getKiosk('org-saga', kioskToken), 'KIOSK_EXPIRED', 'Revoked RFID session is rejected'); kiosk.revokedAt = null;
  kiosk.expiresAt = new Date(0); await reject(() => service.getKiosk('org-saga', kioskToken), 'KIOSK_EXPIRED', 'Expired RFID session is rejected'); kiosk.expiresAt = new Date(Date.now() + 60000);
  users[0].role = 'HIRING_MANAGER'; await reject(() => service.getKiosk('org-saga', kioskToken), 'UNAUTHORIZED', 'RFID authorization ends when issuing HR loses its authorized role'); users[0].role = 'HR_ADMIN';
  await transport.assertRfidOrigin(new Request('https://' + authority + '/api/attendance/rfid/scan', { headers: { origin: 'https://' + authority } }));
  check(true, 'RFID accepts matching HTTPS Preview origin');
  await reject(() => transport.assertRfidOrigin(new Request('https://' + authority, { headers: { origin: 'https://evil.test' } })), 'INVALID_ORIGIN', 'RFID rejects cross-origin mutation');

  const candidateAccess = require('../src/features/careers/candidate-access.ts');
  check(!await candidateAccess.candidateHasAccess('application', 'saga'), 'Candidate application ID alone grants no access');
  const candidateToken = randomBytes(32).toString('hex');
  candidate = { applicationId: 'application', linkHash: candidateAccess.hashCredential(candidateToken), linkExpiresAt: new Date(Date.now() + 60000), delivered: true, revoked: false };
  check(await candidateAccess.consumeCandidateLink('saga', 'application', candidateToken), 'Delivered one-use candidate verification creates a candidate session');
  check(cookieSafe(context.jar.get(candidateAccess.candidateCookie)) && await candidateAccess.candidateHasAccess('application', 'saga'), 'Verified candidate gets a secure cookie and scoped application access');
  check(!await candidateAccess.consumeCandidateLink('saga', 'application', candidateToken), 'Candidate verification link cannot be replayed');
  check(!await candidateAccess.candidateHasAccess('foreign-application', 'saga') && !await candidateAccess.candidateHasAccess('application', 'other'), 'Candidate credential cannot select another application or tenant');
  candidate.sessionExpiresAt = new Date(0); check(!await candidateAccess.candidateHasAccess('application', 'saga'), 'Expired candidate session fails closed'); candidate.sessionExpiresAt = new Date(Date.now() + 60000);
  candidate.revoked = true; check(!await candidateAccess.candidateHasAccess('application', 'saga'), 'Revoked candidate session fails closed'); candidate.revoked = false;
  context.jar.set(session.COOKIE_NAME, { value: 'invalid' }); check(!await candidateAccess.candidateHasAccess('application', 'saga'), 'Invalid staff cookie cannot fall back to candidate credentials'); context.jar.clear();

  const google = require('../src/features/email-integration/google.ts');
  check(google.googleConfiguration().callback === 'https://' + authority + '/api/email-integration/google/callback', 'Google callback uses exact configured Preview public origin');
  const oauth = new URL(google.authorizationUrl('synthetic-state', 'synthetic-challenge'));
  check(oauth.searchParams.get('code_challenge_method') === 'S256' && oauth.searchParams.get('scope') === 'openid email https://www.googleapis.com/auth/gmail.send', 'Google requests PKCE and minimal Gmail send/verified-email scopes');
  delete process.env.GOOGLE_EMAIL_CLIENT_SECRET; check(!google.googleConfigured(), 'Missing Google credentials fail closed');
  const onboarding = require('../src/features/platform-admin/onboarding.ts');
  assert.throws(() => onboarding.workspaceActivationOrigin('new-company'), e => e.code === 'SETUP_REQUIRED'); check(true, 'New workspace provisioning is deliberately blocked on temporary Vercel path hosting');
  const registration = require('../src/features/company-registration/service.ts');
  await reject(() => registration.verifyCompanyRegistration(db, 'invalid', 'invalid'), 'INVALID_VERIFICATION', 'Malformed registration verification is rejected before database work');
  const { token } = require('../src/features/employee-self-service/activation.ts').createEmployeeInvitation();
  await reject(() => registration.verifyCompanyRegistration(db, token, token), 'SETUP_REQUIRED', 'Registration verification requires supported tenant hosting on Preview');

  const result = { capturedAt: new Date().toISOString(), passed: true, assertions: checks.length, scope: 'Actual modules; in-memory request/database boundaries, not hosted end-to-end', databaseConnections: 0, checks };
  fs.mkdirSync('docs/auth-preview-sprint1', { recursive: true });
  fs.writeFileSync('docs/auth-preview-sprint1/focused-tests.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, assertions: checks.length, databaseConnections: 0 }));
}
main().catch(error => { console.error(JSON.stringify({ passed: false, code: error.code || error.name, message: error.message.slice(0, 400), stack: error.stack?.split('\n').slice(1, 4) })); process.exitCode = 1; }).finally(() => { Module._load = original; });
