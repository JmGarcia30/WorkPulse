/* eslint-disable @typescript-eslint/no-require-imports -- Actual Prisma auth service with request-scoped header/cookie adapters. */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
module.exports = async function testPlatformAdministrator(db, context) {
  const service = require('../src/features/platform-admin/service.ts');
  const session = require('../src/features/platform-admin/session.ts');
  const actions = require('../src/features/platform-admin/actions.ts');
  const tenantSession = require('../src/lib/auth/session.ts');
  const guards = require('../src/lib/auth/guards.ts');
  const { proxy } = require('../src/proxy.ts'), { NextRequest } = require('next/server');
  const { platformPassword } = require('../src/features/platform-admin/credentials.ts');
  const prefix = 'platform-fixture-' + randomBytes(8).toString('hex');
  const email = prefix + '@example.invalid', otherEmail = prefix + '-other@example.invalid', unknownEmail = prefix + '-unknown@example.invalid';
  const password = randomBytes(24).toString('hex'), newPassword = randomBytes(24).toString('hex');
  const checks = []; let admin, orgA, orgB;
  function check(value, scenario) { assert.ok(value, scenario); checks.push(scenario); console.log('PASS:', scenario); }
  async function rejects(operation, message, scenario) { await assert.rejects(operation, error => error.message === message); checks.push(scenario); console.log('PASS:', scenario); }
  if (await db.platformAdministrator.count() || await db.platformAdministratorSession.count() || await db.platformAuthenticationAttempt.count()) throw Error('EMPTY_PLATFORM_FIXTURE_TABLES_REQUIRED');
  try {
    const invokeBootstrap = args => spawnSync(process.execPath, ['scripts/provision-platform-admin.cjs', ...args], { env: process.env, encoding: 'utf8', windowsHide: true });
    const target = invokeBootstrap(['--show-target']);
    const fingerprint = target.stdout.match(/Target fingerprint: ([a-f0-9]{64})/);
    check(target.status === 0 && fingerprint && !target.stdout.includes('postgres'), 'Provisioning target inspection reveals only a credential-free fingerprint');
    check(invokeBootstrap([]).status === 1, 'Provisioning requires an explicitly selected database fingerprint');
    const nonInteractive = invokeBootstrap(['--target', fingerprint[1]]);
    check(nonInteractive.status === 1 && nonInteractive.stderr.includes('INTERACTIVE_TERMINAL_REQUIRED'), 'Provisioning refuses noninteractive password input and cannot run accidentally');
    check(!platformPassword.safeParse('short').success, 'Bootstrap rejects short passwords');
    check(!platformPassword.safeParse('é'.repeat(40)).success, 'Passwords cannot be silently truncated by bcrypt');
    const provisioned = await Promise.allSettled([
      service.provisionInitialAdministrator(db, { email: email.toUpperCase(), name: 'Synthetic platform administrator', password }),
      service.provisionInitialAdministrator(db, { email: otherEmail, name: 'Synthetic competing administrator', password }),
    ]);
    check(provisioned.filter(x => x.status === 'fulfilled').length === 1 && provisioned.some(x => x.status === 'rejected' && x.reason.message === 'PLATFORM_ALREADY_PROVISIONED'), 'Concurrent bootstrap creates exactly one initial administrator');
    admin = await db.platformAdministrator.findFirstOrThrow();
    check(admin.email === admin.email.toLowerCase() && admin.passwordHash !== password, 'Bootstrap normalizes email and stores a password hash');
    await rejects(() => service.provisionInitialAdministrator(db, { email: unknownEmail, name: 'Extra administrator', password }), 'PLATFORM_ALREADY_PROVISIONED', 'Bootstrap cannot become an account-creation backdoor');
    check(await service.authenticatePlatformAdministrator(db, unknownEmail, password) === null, 'Unknown platform identities are rejected');
    check(await service.authenticatePlatformAdministrator(db, admin.email, 'incorrect-password') === null, 'Invalid passwords are rejected');
    const authenticated = await service.authenticatePlatformAdministrator(db, admin.email, password);
    check(authenticated && /^[a-f0-9]{64}$/.test(authenticated.token), 'Valid credentials create a cryptographically random platform session');
    const stored = await db.platformAdministratorSession.findFirstOrThrow();
    check(stored.tokenHash === service.tokenHash(authenticated.token) && stored.tokenHash !== authenticated.token, 'Only hashed session tokens are persisted');
    check((await service.findPlatformAdministrator(db, authenticated.token)).id === admin.id, 'Persisted platform session resolves its administrator');
    check(await service.findPlatformAdministrator(db, 'f'.repeat(64)) === null && await service.findPlatformAdministrator(db, 'forged') === null, 'Forged and malformed session tokens are denied');
    context.jar.set(session.PLATFORM_COOKIE, { value: authenticated.token });
    check((await session.requirePlatformAdministrator()).id === admin.id, 'Platform guard accepts its own active session on the public host');
    check(await tenantSession.getSession() === null, 'Platform cookie alone grants no tenant identity');
    context.jar.set(tenantSession.COOKIE_NAME, { value: authenticated.token });
    check(await tenantSession.getSession() === null, 'Copying an opaque platform token into a tenant cookie fails');
    context.jar.delete(tenantSession.COOKIE_NAME);
    context.headers = new Headers({ host: 'saga.localhost:3000' });
    await rejects(() => session.requirePlatformAdministrator(), 'NOT_FOUND', 'Platform guard rejects tenant hosts even with a platform session');
    context.headers = new Headers({ host: 'localhost:3000', 'x-workpulse-tenant-slug': 'saga' });
    await rejects(() => session.requirePlatformAdministrator(), 'NOT_FOUND', 'Platform guard rejects path-tenant request contexts');
    context.headers = new Headers({ host: 'app.localhost:3000' });
    await rejects(() => session.requirePlatformAdministrator(), 'NOT_FOUND', 'Workspace discovery host cannot serve platform administration');
    context.headers = new Headers({ host: 'localhost:3000' });
    const req = (host, path, cookie) => new NextRequest(`http://${host}${path}`, { headers: { host, ...(cookie ? { cookie } : {}) } });
    check((await proxy(req('saga.localhost:3000', '/platform'))).status === 404, 'Proxy blocks platform paths on tenant hosts');
    const publicResponse = await proxy(req('localhost:3000', '/platform', 'workpulse_path_tenant=saga'));
    check(publicResponse.status === 200 && !publicResponse.headers.has('x-middleware-rewrite'), 'Remembered SAGA routing does not rewrite platform paths');
    check((await proxy(req('saga.localhost:3000', '/dashboard', session.PLATFORM_COOKIE + '=' + authenticated.token))).status === 307, 'Platform cookie cannot pass the tenant route session check');
    check((await actions.platformAccountAction({}, new FormData())).error, 'Account actions independently validate inputs after authorization');
    context.jar.delete(session.PLATFORM_COOKIE);
    for (const role of ['ORGANIZATION_ADMIN', 'HR_ADMIN', 'HIRING_MANAGER', 'EMPLOYEE']) {
      orgA ??= await db.organization.create({ data: { name: 'Synthetic platform isolation A', slug: prefix + '-a' } });
      const user = await db.user.create({ data: { organizationId: orgA.id, name: role, email: prefix + '-' + role.toLowerCase() + '@example.invalid', role } });
      await tenantSession.createSession({ userId: user.id, name: user.name, email: user.email, organizationId: orgA.id, role });
      context.headers = new Headers({ host: orgA.slug + '.localhost:3000' });
      check((await tenantSession.getSession()).userId === user.id, `${role} tenant session remains valid`);
      context.headers = new Headers({ host: 'localhost:3000' });
      await rejects(() => session.requirePlatformAdministrator(), 'REDIRECT:/platform/login', `${role} cannot access platform administration`);
      await rejects(() => actions.platformAccountAction({}, new FormData()), 'REDIRECT:/platform/login', `${role} cannot invoke platform account actions`);
    }
    context.jar.delete(tenantSession.COOKIE_NAME);
    context.jar.set(session.PLATFORM_COOKIE, { value: authenticated.token });
    orgB = await db.organization.create({ data: { name: 'Synthetic platform isolation B', slug: prefix + '-b', careersEnabled: false } });
    const organizationAdmin = await db.user.findFirstOrThrow({ where: { organizationId: orgA.id, role: 'ORGANIZATION_ADMIN' } });
    await tenantSession.createSession({ userId: organizationAdmin.id, email: organizationAdmin.email, name: organizationAdmin.name, role: organizationAdmin.role, organizationId: orgA.id });
    context.headers = new Headers({ host: orgB.slug + '.localhost:3000' });
    await rejects(() => guards.requireBackOfficeContext(), 'UNAUTHENTICATED', 'Existing organization administrator cannot cross into another organization');
    context.jar.delete(tenantSession.COOKIE_NAME);
    context.headers = new Headers({ host: orgA.slug + '.localhost:3000' });
    await rejects(() => guards.requireBackOfficeContext(), 'UNAUTHENTICATED', 'Platform administrator cannot enter tenant back-office data boundary');
    for (const [resource, deniedStatus] of Object.entries({ resumes: 401, 'recruitment-documents': 403, 'onboarding-documents': 403, 'leave-documents': 401 })) {
      const route = require(`../src/app/api/${resource}/[id]/route.ts`);
      const response = await route.GET(req(orgA.slug + '.localhost:3000', `/api/${resource}/synthetic`, session.PLATFORM_COOKIE + '=' + authenticated.token), { params: Promise.resolve({ id: 'synthetic' }) });
      check(response.status === deniedStatus, `Platform identity cannot retrieve ${resource}`);
    }
    context.headers = new Headers({ host: 'localhost:3000' });
    const organizations = await service.listPlatformOrganizations(db, 1);
    const fixture = organizations.find(x => x.id === orgB.id);
    check(fixture && fixture.careersEnabled === false, 'Organization list displays persisted career portal status');
    check(Object.keys(fixture).sort().join(',') === 'careersEnabled,createdAt,id,name,slug,timeZone', 'Organization projection contains only permitted metadata');
    check(!('role' in await session.requirePlatformAdministrator()) && !('organizationId' in await session.requirePlatformAdministrator()), 'Platform identity has no tenant role or membership');
    const wrongSettings = await service.updatePlatformAccount(db, authenticated.token, { name: 'Changed', currentPassword: 'incorrect', newPassword: '' });
    check(wrongSettings.error && (await db.platformAdministrator.findUniqueOrThrow({ where: { id: admin.id } })).name === admin.name, 'Account changes require the current password');
    const changed = await service.updatePlatformAccount(db, authenticated.token, { name: 'Updated synthetic name', currentPassword: password, newPassword: '' });
    check(changed.success && (await service.findPlatformAdministrator(db, authenticated.token)).name === 'Updated synthetic name', 'Own account name can be updated securely');
    const rotated = await service.updatePlatformAccount(db, authenticated.token, { name: 'Updated synthetic name', currentPassword: password, newPassword });
    check(rotated.reauthenticate && await service.findPlatformAdministrator(db, authenticated.token) === null, 'Password change revokes all platform sessions');
    await db.platformAuthenticationAttempt.deleteMany({ where: { key: service.tokenHash('login:' + admin.email) } });
    const two = await Promise.all([service.authenticatePlatformAdministrator(db, admin.email, newPassword), service.authenticatePlatformAdministrator(db, admin.email, newPassword)]);
    check(two.every(Boolean) && two[0].token !== two[1].token, 'Concurrent sign-ins create independent server-backed sessions');
    await service.revokePlatformSession(db, two[0].token);
    check(await service.findPlatformAdministrator(db, two[0].token) === null && !!await service.findPlatformAdministrator(db, two[1].token), 'Logout revokes the selected session without affecting another browser');
    await db.platformAdministratorSession.update({ where: { tokenHash: service.tokenHash(two[1].token) }, data: { expiresAt: new Date(0) } });
    check(await service.findPlatformAdministrator(db, two[1].token) === null, 'Expired sessions cannot authorize requests');
    await db.platformAuthenticationAttempt.deleteMany({ where: { key: service.tokenHash('login:' + admin.email) } });
    const disableSession = await service.authenticatePlatformAdministrator(db, admin.email, newPassword);
    await db.platformAdministrator.update({ where: { id: admin.id }, data: { disabledAt: new Date() } });
    check(await service.findPlatformAdministrator(db, disableSession.token) === null && await service.authenticatePlatformAdministrator(db, admin.email, newPassword) === null, 'Disabling an administrator immediately invalidates access and login');
    await db.platformAdministrator.update({ where: { id: admin.id }, data: { disabledAt: null } });
    await db.platformAuthenticationAttempt.deleteMany({ where: { key: service.tokenHash('login:' + admin.email) } });
    for (let i = 0; i < 5; i++) await service.authenticatePlatformAdministrator(db, admin.email, 'wrong');
    check(await service.authenticatePlatformAdministrator(db, admin.email, newPassword) === null, 'Persistent per-identity throttling blocks login after five attempts');
    await db.platformAuthenticationAttempt.update({ where: { key: service.tokenHash('login:' + admin.email) }, data: { windowStart: new Date(Date.now() - 16 * 60 * 1000) } });
    check(!!await service.authenticatePlatformAdministrator(db, admin.email, newPassword), 'Login throttle expires after the documented window');
    await db.platformAuthenticationAttempt.update({ where: { key: service.tokenHash('login:' + admin.email) }, data: { attempts: 4 } });
    const racedLimit = await Promise.all([service.authenticatePlatformAdministrator(db, admin.email, newPassword), service.authenticatePlatformAdministrator(db, admin.email, newPassword)]);
    check(racedLimit.filter(Boolean).length === 1, 'Concurrent requests cannot bypass the persisted login-attempt limit');
    await db.platformAuthenticationAttempt.deleteMany({ where: { key: service.tokenHash('login:' + admin.email) } });
    const form = new FormData(); form.set('email', admin.email); form.set('password', newPassword);
    await rejects(() => actions.platformLoginAction({}, form), 'REDIRECT:/platform', 'Platform login action completes with a fixed safe redirect');
    const cookie = context.jar.get(session.PLATFORM_COOKIE);
    check(cookie.httpOnly && cookie.sameSite === 'strict' && cookie.path === '/' && cookie.maxAge === 28800, 'Platform session cookie uses HttpOnly, SameSite Strict and an eight-hour lifetime');
    await rejects(() => actions.platformLogoutAction(), 'REDIRECT:/platform/login', 'Platform logout action clears the cookie and redirects to sign-in');
    check(!context.jar.has(session.PLATFORM_COOKIE) && await service.findPlatformAdministrator(db, cookie.value) === null, 'Logout deletes both browser cookie and persistent session');
    return { passed: true, assertions: checks.length, checks, fixturesRemoved: true };
  } finally {
    await db.platformAdministrator.deleteMany({ where: { email: { in: [email, otherEmail] } } });
    await db.platformAuthenticationAttempt.deleteMany({ where: { key: { in: ['platform-login-global', 'login:' + email, 'login:' + otherEmail, 'login:' + unknownEmail, ...(admin ? ['settings:' + admin.id] : [])].map(service.tokenHash) } } });
    const ids = [orgA?.id, orgB?.id].filter(Boolean);
    if (ids.length) { await db.user.deleteMany({ where: { organizationId: { in: ids } } }); await db.organization.deleteMany({ where: { id: { in: ids } } }); }
    context.jar.clear();
  }
};
