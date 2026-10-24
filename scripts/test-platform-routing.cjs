/* eslint-disable @typescript-eslint/no-require-imports -- Recovery-only synthetic routing and session regression tests. */
const assert = require('node:assert/strict'), { randomBytes } = require('node:crypto');
const { hash } = require('bcryptjs');
module.exports = async function testRouting(db, context) {
  const host = require('../src/lib/tenant/host.ts'), routing = require('../src/lib/tenant/routing-context.ts');
  const tenant = require('../src/lib/tenant/server.ts'), session = require('../src/lib/auth/session.ts');
  const { proxy } = require('../src/proxy.ts'), { NextRequest } = require('next/server');
  const { requireBackOfficeContext } = require('../src/lib/auth/guards.ts');
  const hiring = require('../src/features/hiring/document-access.ts');
  const prefix = 'routing-' + randomBytes(6).toString('hex'), checks = [], secret = randomBytes(24).toString('hex');
  const request = (authority, path = '/', extra = {}) => new NextRequest('http://localhost:3000' + path, { headers: { host: authority, ...extra } });
  const check = (value, scenario) => { assert.ok(value, scenario); checks.push(scenario); console.log('PASS:', scenario); };
  function routedHeaders(response, authority) {
    const headers = new Headers({ host: authority });
    for (const [key, value] of response.headers) if (key.startsWith('x-middleware-request-')) headers.set(key.slice('x-middleware-request-'.length), value);
    return headers;
  }
  let a, b, sagaUser;
  try {
    a = await db.organization.create({ data: { name: 'Synthetic Company A', slug: prefix + '-a', timeZone: 'UTC' } });
    b = await db.organization.create({ data: { name: 'Synthetic Company B', slug: prefix + '-b', timeZone: 'Asia/Manila', careersEnabled: false } });
    const passwordHash = await hash(secret, 12);
    const userA = await db.user.create({ data: { organizationId: a.id, role: 'HR_ADMIN', name: 'Synthetic A HR', email: prefix + '-a@fixture.invalid', passwordHash } });
    const userB = await db.user.create({ data: { organizationId: b.id, role: 'HR_ADMIN', name: 'Synthetic B HR', email: prefix + '-b@fixture.invalid', passwordHash } });
    const saga = await db.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' }, select: { id: true, slug: true } });
    sagaUser = await db.user.create({ data: { organizationId: saga.id, role: 'HR_ADMIN', name: 'Synthetic SAGA routing check', email: prefix + '-saga@fixture.invalid', passwordHash } });
    for (const value of ['evil.test', 'saga.localhost.evil.test:3000', 'saga.localhost:3000,evil.test', 'http://saga.localhost:3000', 'saga.localhost:3000/path', 'a@localhost:3000', 'saga.localhost:03000', 'saga.localhost:65536', 'saga.localhost:0', 'saga.localhost.:3000', 'saga..localhost:3000', ' saga.localhost:3000', 'saga.localhost:3001', 'api.localhost:3000', 'a.b.localhost:3000']) {
      check(host.parsePlatformHost(value, 'localhost:3000').kind === 'invalid', 'Invalid or unconfigured authority rejected: ' + value);
    }
    check(host.parsePlatformHost('SAGA.LOCALHOST:3000', 'localhost:3000').kind === 'tenant', 'Configured authorities normalize case without accepting forwarded lists');
    for (const value of ['evil.test', 'localhost:3000', b.slug + '.localhost:3000', a.slug + '.localhost:3000,evil.test']) {
      check((await proxy(request(a.slug + '.localhost:3000', '/', { 'x-forwarded-host': value }))).status === 404, 'Conflicting forwarded host cannot select a workspace: ' + value);
    }
    check((await proxy(request('evil.test', '/', { 'x-forwarded-host': a.slug + '.localhost:3000' }))).status === 404, 'Known forwarded host cannot rescue an unrecognized actual Host');
    const missing = prefix + '-unknown.localhost:3000';
    for (const path of ['/', '/login', '/dashboard', '/api/leave-documents/synthetic', '/features']) check((await proxy(request(missing, path))).status === 404, 'Unknown organization is rejected before route ' + path);
    const bHost = b.slug + '.localhost:3000', aHost = a.slug + '.localhost:3000';
    const response = await proxy(request(bHost, '/', { 'x-forwarded-host': bHost, 'x-workpulse-tenant-slug': 'saga', [routing.ROUTING_CONTEXT_HEADER]: 'forged', forwarded: 'host=evil.test' }));
    const headers = routedHeaders(response, bHost);
    check(response.status === 200 && new URL(response.headers.get('x-middleware-rewrite')).pathname === '/tenant-entry', 'Persisted Company B subdomain rewrites to its workspace landing');
    check(!headers.has('x-workpulse-tenant-slug') && !headers.has('forwarded') && routing.readRoutingContext(headers).organizationId === b.id, 'Proxy strips spoofed internal context and signs its own persisted organization mapping');
    context.headers = headers;
    check((await tenant.requireRequestTenant()).organizationId === b.id, 'Server independently verifies signed Company B context against persisted organization');
    const tampered = new Headers(headers); tampered.set(routing.ROUTING_CONTEXT_HEADER, tampered.get(routing.ROUTING_CONTEXT_HEADER).slice(0, -1) + '!');
    context.headers = tampered;
    check(await tenant.resolveRequestTenant() === null, 'Tampered internal routing signatures are rejected');
    const replayed = new Headers(headers); replayed.set('host', aHost); replayed.set('x-forwarded-host', aHost); context.headers = replayed;
    check(await tenant.resolveRequestTenant() === null, 'Signed routing context cannot be replayed on another host');
    const now = Date.now; try { Date.now = () => now() + 301000; check(routing.readRoutingContext(headers) === null, 'Expired routing context cannot be reused'); } finally { Date.now = now; }
    context.headers = new Headers({ host: 'localhost:3000', 'x-workpulse-tenant-slug': 'saga' });
    check(await tenant.resolveRequestTenant() === null, 'Unsigned tenant-selection headers cannot create SAGA identity');
    const pathResponse = await proxy(request('localhost:3000', '/saga/login'));
    context.headers = routedHeaders(pathResponse, 'localhost:3000');
    check((await tenant.requireRequestTenant()).organizationId === saga.id && routing.readRoutingContext(context.headers).mode === 'saga-path', 'Existing SAGA path tenancy resolves through signed rewrite context');
    const remembered = await proxy(request('localhost:3000', '/dashboard', { cookie: 'workpulse_path_tenant=saga' }));
    check(remembered.status === 307 && new URL(remembered.headers.get('location')).pathname === '/saga/dashboard', 'Remembered SAGA path routing survives bare dashboard redirects locally');
    const { loginAction } = require('../src/lib/auth/actions.ts');
    const sagaForm = new FormData(); sagaForm.set('email', sagaUser.email); sagaForm.set('password', secret);
    await assert.rejects(() => loginAction(sagaForm), error => error.message === 'REDIRECT:/saga/dashboard');
    check((await session.getSession()).userId === sagaUser.id, 'SAGA path login and existing tenant session format remain compatible');
    context.headers = new Headers({ host: 'saga.localhost:3000' });
    check((await session.getSession()).organizationId === saga.id, 'SAGA subdomain alias resolves the same persisted workspace');
    context.headers = new Headers({ host: 'st-aloysius.localhost:3000' });
    check((await session.getSession()).organizationId === saga.id, 'Canonical SAGA organization subdomain retains account access');
    const { logoutAction } = require('../src/lib/auth/actions.ts');
    await assert.rejects(() => logoutAction(), error => error.message === 'REDIRECT:/login');
    check(true, 'Subdomain logout retains the normal tenant login route');
    context.headers = routedHeaders(pathResponse, 'localhost:3000');
    await session.createSession({ userId: sagaUser.id, email: sagaUser.email, name: sagaUser.name, organizationId: saga.id, role: 'HR_ADMIN' });
    await assert.rejects(() => logoutAction(), error => error.message === 'REDIRECT:/saga/login');
    check(true, 'Verified SAGA path logout explicitly retains its workspace prefix');
    check(await session.getSession() === null, 'SAGA logout removes the tenant session');
    const canonicalSaga = await proxy(request('st-aloysius.localhost:3000', '/careers/st-aloysius/synthetic-job'));
    check(canonicalSaga.status === 200 && !canonicalSaga.headers.has('location'), 'Canonical SAGA careers route does not redirect to itself');
    context.headers = new Headers({ host: aHost });
    const tokenA = await session.createSession({ userId: userA.id, email: userA.email, name: userA.name, organizationId: a.id, role: 'HR_ADMIN' });
    check((await session.getSession()).organizationId === a.id, 'Company A session is valid on its own workspace');
    context.headers = new Headers({ host: bHost });
    check(await session.getSession() === null, 'A valid Company A JWT is rejected at the shared session boundary on Company B');
    await assert.rejects(() => requireBackOfficeContext(), error => error.message === 'UNAUTHENTICATED'); check(true, 'Cross-tenant JWT cannot reach HR back-office context');
    for (const [resource, status] of Object.entries({ resumes: 401, 'leave-documents': 401, 'recruitment-documents': 403, 'onboarding-documents': 403 })) {
      const handler = require(`../src/app/api/${resource}/[id]/route.ts`);
      const result = await handler.GET(request(bHost, '/api/' + resource + '/synthetic', { cookie: session.COOKIE_NAME + '=' + tokenA }), { params: Promise.resolve({ id: 'synthetic' }) });
      check(result.status === status, 'Cross-tenant session cannot access ' + resource);
    }
    check(!await hiring.candidatePortalMatchesRequestTenant(a.slug), 'Tenant context cannot be replaced with a different candidate organization slug');
    for (const path of ['/careers/' + a.slug, '/careers/' + a.slug + '-suffix/job', '/careers/saga/job', '/careers/st-aloysius/job']) check((await proxy(request(bHost, path))).status === 404, 'Company B rejects conflicting tenant career path ' + path);
    context.headers = new Headers({ host: 'localhost:3000' });
    check(await session.getSession() === null, 'Tenant JWT cannot authenticate on the public platform host');
    check(await hiring.candidatePortalMatchesRequestTenant(a.slug), 'Public careers host retains its explicit public applicant entry flow');
    context.headers = new Headers({ host: bHost });
    await session.createSession({ userId: userB.id, email: userB.email, name: userB.name, organizationId: b.id, role: 'HR_ADMIN' });
    check((await requireBackOfficeContext()).organizationId === b.id, 'Company B HR receives only Company B back-office context');
    const policy = { durationMonths: 4, evaluationRequired: true, evaluationCriteria: 'Synthetic Company B performance criteria', maxRenewals: 0, renewalMonths: 0 };
    const savePolicy = require('../src/features/employees/probation-policy-actions.ts').saveOrganizationProbationPolicy;
    check((await savePolicy({ TEACHING: policy, NON_TEACHING: policy })).success, 'Company B HR can save its own organization policy');
    check((await db.organization.findUniqueOrThrow({ where: { id: b.id } })).probationPolicy.TEACHING.durationMonths === 4 && (await db.organization.findUniqueOrThrow({ where: { id: a.id } })).probationPolicy === null, 'Company B configuration does not modify Company A');
    const { resolveHiringDocumentPolicy } = require('../src/features/hiring/document-policy.ts');
    const requirements = resolveHiringDocumentPolicy({ id: b.id, slug: b.slug, hiringDocumentRequirements: null }, 'TEACHING');
    check(!requirements.isSaga && requirements.requirements.length === 1 && requirements.requirements[0].submissionTarget === 'Hiring team', 'Company B does not inherit SAGA hiring requirements');
    const payroll = await require('../src/features/payroll/queries.ts').getPayrollFoundation(b.id);
    check(payroll.employees.length === 0 && payroll.entries.length === 0 && payroll.policies.length === 0, 'Company B payroll sees no other tenant employee, entry or payroll policy');
    context.headers = new Headers({ host: aHost });
    await assert.rejects(() => savePolicy({ TEACHING: policy, NON_TEACHING: policy }), error => error.message === 'UNAUTHENTICATED'); check(true, 'Company B token cannot mutate Company A configuration');
    const publicResponse = await proxy(request('localhost:3000', '/platform', { 'x-workpulse-tenant-slug': 'saga', [routing.ROUTING_CONTEXT_HEADER]: headers.get(routing.ROUTING_CONTEXT_HEADER) }));
    check(!routedHeaders(publicResponse, 'localhost:3000').has(routing.ROUTING_CONTEXT_HEADER), 'Platform requests discard tenant routing claims');
    check((await proxy(request(bHost, '/platform'))).status === 404, 'Tenant hosts cannot serve the System Administrator interface');
    return { passed: true, assertions: checks.length, checks, fixturesRemoved: true };
  } finally {
    const ids = [a?.id, b?.id].filter(Boolean);
    await db.user.deleteMany({ where: { OR: [{ organizationId: { in: ids } }, { email: prefix + '-saga@fixture.invalid' }] } });
    await db.organization.deleteMany({ where: { id: { in: ids } } });
    context.jar.clear(); context.headers = new Headers({ host: 'localhost:3000' });
  }
};
