// Real production-server HTTP form submissions, using only the disposable schema
// created by test-h10-2-separation.ts. No configured application records are used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { SignJWT } from 'jose';
import { PrismaClient, Role } from '@prisma/client';
import { Temporal } from '@js-temporal/polyfill';

export async function testInterface(db: PrismaClient, databaseUrl: string) {
  let checks = 0;
  const ok = (condition: unknown, message: string) => { assert.ok(condition, message); console.log(`INTERFACE PASS ${++checks}: ${message}`); };
  const day = Temporal.Now.plainDateISO('Asia/Manila');
  const date = (value: string) => new Date(`${value}T00:00:00Z`);
  const organization = await db.organization.create({ data: { name: 'H10 interface isolated', slug: 'st-aloysius', timeZone: 'Asia/Manila' } });
  const other = await db.organization.create({ data: { name: 'Foreign isolated', slug: 'other' } });
  const user = (role: Role, organizationId = organization.id) => db.user.create({ data: { name: role, role, organizationId, email: `${role}-${organizationId}@interface.invalid` } });
  const hr = await user('HR_ADMIN'), admin = await user('ORGANIZATION_ADMIN'), manager = await user('HIRING_MANAGER'), foreign = await user('HR_ADMIN', other.id);
  const secret = process.env.SESSION_SECRET || 'h10_interface_test_only_secret_32_characters';
  async function cookie(actor: typeof hr) {
    const token = await new SignJWT({ userId: actor.id, organizationId: actor.organizationId, role: actor.role, name: actor.name, email: actor.email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
    return `__Host-workpulse_session=${token}; workpulse_path_tenant=saga`;
  }
  let counter = 0;
  async function employee() {
    const suffix = ++counter;
    const job = await db.job.create({ data: { organizationId: organization.id, title: 'Interface job', slug: `interface-${suffix}`, department: 'Test', employmentType: 'Full-time', location: 'Campus', description: 'Fixture', responsibilities: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture' } });
    const applicant = await db.applicant.create({ data: { firstName: 'Interface', lastName: `Person${suffix}`, email: `person${suffix}@interface.invalid`, phone: '0' } });
    const application = await db.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'Fixture' } });
    const person = await db.employee.create({ data: { organizationId: organization.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `EXIT-UI-${suffix}`, firstName: applicant.firstName, lastName: applicant.lastName, email: applicant.email, phone: '0', createdById: hr.id } });
    await db.employmentRecord.create({ data: { employeeId: person.id, jobId: job.id, jobTitle: 'Interface job', department: 'Test', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: date('2025-01-01'), startDate: date('2025-01-01'), salary: 1, payFrequency: 'MONTHLY', effectiveFrom: date('2025-01-01'), createdById: hr.id } });
    const login = await db.user.create({ data: { name: 'Interface employee', role: 'EMPLOYEE', organizationId: organization.id, email: `login${suffix}@interface.invalid` } });
    await db.employeeAccount.create({ data: { organizationId: organization.id, employeeId: person.id, userId: login.id, status: 'ACTIVE', activatedAt: new Date(), createdById: hr.id } });
    return { ...person, login };
  }
  const listener = createServer();
  await new Promise<void>((done, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', done); });
  const address = listener.address(); assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((done, reject) => listener.close(error => error ? reject(error) : done()));
  let output = '';
  const server = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', 'localhost', '--port', String(port)], {
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: databaseUrl, SESSION_SECRET: secret, PLATFORM_ROOT_DOMAIN: `localhost:${port}`, PLATFORM_PUBLIC_ORIGIN: `http://localhost:${port}` }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', value => { output = (output + String(value)).slice(-12000); });
  server.stderr.on('data', value => { output = (output + String(value)).slice(-12000); });
  // NextURL normalizes loopback IPs to localhost; use that hostname for rewrites.
  const origin = `http://localhost:${port}`;
  const base = '/saga/dashboard/employees/exit';
  const hrCookie = await cookie(hr), adminCookie = await cookie(admin);
  async function get(path: string, session = hrCookie, tenantHost?: string) {
    const response = await fetch(`${origin}${path}`, { headers: { cookie: session, ...(tenantHost ? { host: tenantHost, 'x-forwarded-host': tenantHost } : {}) }, redirect: 'manual' });
    return { response, html: await response.text() };
  }
  const decode = (value: string) => value.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  function formFor(html: string, operation: string, itemId?: string) {
    const form = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(match => match[1]).find(body => body.includes(`name="operation" value="${operation}"`) && (!itemId || body.includes(`value="${itemId}"`)));
    assert.ok(form, `Missing rendered ${operation} form`);
    const fields = new FormData();
    for (const input of form.matchAll(/<input\b[^>]*>/g)) {
      const name = input[0].match(/\bname="([^"]*)"/)?.[1], value = input[0].match(/\bvalue="([^"]*)"/)?.[1];
      if (name && (name.startsWith('$ACTION') || /type="hidden"/.test(input[0]))) fields.append(decode(name), decode(value ?? ''));
    }
    return fields;
  }
  async function submit(path: string, operation: string, values: Record<string, string>, session = hrCookie, itemId?: string, rendered?: string) {
    const html = rendered ?? (await get(path, session)).html;
    const fields = formFor(html, operation, itemId);
    for (const [name, value] of Object.entries(values)) fields.set(name, value);
    const response = await fetch(`${origin}${path}`, { method: 'POST', headers: { cookie: session, origin }, body: fields, redirect: 'manual' });
    const body = await response.text();
    assert.ok(response.status < 500, `Server action HTTP ${response.status}: ${output.slice(-3000)}`);
    return { response, html: body };
  }
  try {
    for (let attempt = 0; ; attempt++) {
      try { await fetch(origin); break; } catch { if (attempt >= 100 || server.exitCode !== null) throw new Error(`Test server failed: ${output}`); await new Promise(done => setTimeout(done, 200)); }
    }
    const person = await employee();
    const employeeCookie = await cookie(person.login);
    const beforeEss = await get('/saga/employee', employeeCookie);
    ok(beforeEss.response.status === 200 && beforeEss.html.includes(person.employeeNumber), 'active employee session can access ESS before separation');
    const list = await get(base);
    assert.ok(list.response.status === 200 && list.html.includes('Exit Management'), `Authorized list failed: status=${list.response.status}, location=${list.response.headers.get('location')}, title=${list.html.match(/<title>(.*?)<\/title>/)?.[1]}, text=${list.html.replace(/<[^>]*>/g, ' ').slice(0, 500)}`);
    ok(true, 'authorized tenant-prefixed list renders');
    ok(list.html.includes('/saga/dashboard/employees/exit/new'), 'rendered navigation preserves tenant prefix');
    for (const actor of [manager, person.login, foreign]) {
      const denied = await get(base, await cookie(actor));
      ok(denied.response.status !== 200 || !denied.html.includes('Create exit case'), `${actor.role} / tenant mismatch cannot view Exit administration`);
    }
    async function create(person: Awaited<ReturnType<typeof employee>>, future = false) {
      const effective = future ? day.add({ days: 1 }) : day;
      const response = await submit(`${base}/new`, 'create', { employeeId: person.id, separationType: 'RESIGNATION', reason: 'Verified written resignation for interface test', noticeDate: day.subtract({ months: 2 }).toString(), proposedLastWorkingDay: effective.subtract({ days: 1 }).toString(), proposedEffectiveDate: effective.toString() });
      const found = await db.employeeSeparationCase.findFirst({ where: { employeeId: person.id } });
      assert.ok(found, `Create action did not create a case: ${response.html.slice(-3000)} ${output.slice(-3000)}`);
      return found;
    }
    let found = await create(person);
    const path = `${base}/${found.id}`;
    ok(found.status === 'DRAFT', 'create form produces a draft with pending clearance');
    const stale = (await get(path)).html;
    await submit(path, 'ready', {});
    ok((await db.employeeSeparationCase.findUniqueOrThrow({ where: { id: found.id } })).status === 'DRAFT', 'incomplete clearance cannot mark ready through action');
    await submit(path, 'update', { separationType: 'RESIGNATION', reason: found.reason, noticeDate: day.subtract({ months: 2 }).toString(), proposedLastWorkingDay: day.subtract({ days: 1 }).toString(), proposedEffectiveDate: day.toString() });
    for (const item of await db.employeeClearanceItem.findMany({ where: { caseId: found.id } })) await submit(path, 'clearance', { itemId: item.id, status: 'CLEARED', verified: 'on' }, hrCookie, item.id);
    const staleResponse = await submit(path, 'cancel', { reason: 'Stale submission must fail' }, hrCookie, undefined, stale);
    ok(staleResponse.html.includes('This case changed') && (await db.employeeSeparationCase.findUniqueOrThrow({ where: { id: found.id } })).status === 'IN_PROGRESS', 'stale forms display conflict without overwriting decisions');
    for (const kind of ['NOTICE_SUPERIOR', 'NOTICE_HRMO']) await submit(path, 'review', { kind, evidence: 'Actually verified isolated review reference', verified: 'on' });
    await submit(path, 'ready', {});
    found = await db.employeeSeparationCase.findUniqueOrThrow({ where: { id: found.id } });
    ok(found.status === 'READY_FOR_FINAL_REVIEW', 'clearance and verified reviews permit readiness through rendered forms');
    const approvalForm = (await get(path)).html;
    await submit(path, 'approve', { remarks: 'Attempted unauthorized approval', confirmed: 'on' }, await cookie(manager), undefined, approvalForm);
    await submit(path, 'approve', { remarks: 'Attempted cross-tenant approval', confirmed: 'on' }, await cookie(foreign), undefined, approvalForm);
    ok((await db.employeeSeparationCase.findUniqueOrThrow({ where: { id: found.id } })).status === 'READY_FOR_FINAL_REVIEW', 'forged action submissions cannot bypass role or tenant authorization');
    await submit(path, 'approve', { remarks: 'Verified final approval', confirmed: 'on' }, adminCookie);
    const executionForm = (await get(path)).html;
    await submit(path, 'execute', { remarks: 'Missing confirmation' });
    ok((await db.employee.findUniqueOrThrow({ where: { id: person.id } })).employeeStatus === 'ACTIVE', 'server rejects execution without explicit confirmation');
    await submit(path, 'execute', { remarks: 'Confirmed execution on effective date', confirmed: 'on' });
    found = await db.employeeSeparationCase.findUniqueOrThrow({ where: { id: found.id } });
    ok(found.status === 'COMPLETED' && (await db.employee.findUniqueOrThrow({ where: { id: person.id } })).employeeStatus === 'SEPARATED', 'full HR form workflow completes separation');
    ok((await db.employeeAccount.findUniqueOrThrow({ where: { employeeId: person.id } })).status === 'DISABLED', 'interface execution disables linked ESS account');
    const ess = await get('/saga/employee', employeeCookie);
    ok([303, 307, 308].includes(ess.response.status) && Boolean(ess.response.headers.get('location')?.includes('/login')), 'previously signed employee session is redirected away from ESS after separation');
    const audits = await db.employeeSeparationAudit.count({ where: { caseId: found.id, action: 'SEPARATION_COMPLETED' } });
    await submit(path, 'execute', { remarks: 'Duplicate execution', confirmed: 'on' }, hrCookie, undefined, executionForm);
    ok(await db.employeeSeparationAudit.count({ where: { caseId: found.id, action: 'SEPARATION_COMPLETED' } }) === audits, 'duplicate execution does not duplicate final audit');
    const cancelledPerson = await employee(), cancelled = await create(cancelledPerson);
    await submit(`${base}/${cancelled.id}`, 'cancel', { reason: 'Documented isolated cancellation' });
    ok((await db.employeeSeparationCase.findUniqueOrThrow({ where: { id: cancelled.id } })).status === 'CANCELLED', 'cancellation form preserves a terminal cancelled case');
    const futurePerson = await employee(), future = await create(futurePerson, true), futurePath = `${base}/${future.id}`;
    await submit(futurePath, 'update', { separationType: 'RESIGNATION', reason: future.reason, noticeDate: day.subtract({ months: 2 }).toString(), proposedLastWorkingDay: day.toString(), proposedEffectiveDate: day.add({ days: 1 }).toString() });
    for (const item of await db.employeeClearanceItem.findMany({ where: { caseId: future.id } })) await submit(futurePath, 'clearance', { itemId: item.id, status: 'CLEARED', verified: 'on' }, hrCookie, item.id);
    for (const kind of ['NOTICE_SUPERIOR', 'NOTICE_HRMO']) await submit(futurePath, 'review', { kind, evidence: 'Verified future review', verified: 'on' });
    await submit(futurePath, 'ready', {});
    await submit(futurePath, 'approve', { remarks: 'Approved future separation', confirmed: 'on' });
    await submit(futurePath, 'execute', { remarks: 'Early execution attempt', confirmed: 'on' });
    ok((await db.employeeSeparationCase.findUniqueOrThrow({ where: { id: future.id } })).status === 'APPROVED_PENDING_EFFECTIVE' && (await db.employee.findUniqueOrThrow({ where: { id: futurePerson.id } })).employeeStatus === 'ACTIVE' && (await db.employeeAccount.findUniqueOrThrow({ where: { employeeId: futurePerson.id } })).status === 'ACTIVE', 'future approval and rejected early execution preserve employment and ESS');
    const filtered = await get(`${base}?search=${person.employeeNumber}&status=COMPLETED`);
    ok(filtered.html.includes(person.lastName) && !filtered.html.includes(futurePerson.lastName), 'case search and status filters return matching tenant records');
    // Alternate real RSC requests in one warm server to catch tenant-cache reuse.
    for (let cycle = 0; cycle < 2; cycle++) {
      const sagaPage = await get('/saga/dashboard', hrCookie);
      ok(sagaPage.response.status === 200 && sagaPage.html.includes('Welcome Back,') && sagaPage.html.includes(organization.name) && !sagaPage.html.includes(other.name) && !sagaPage.html.includes('data-dgst=') && !sagaPage.html.includes(':E{'), 'warm SAGA Dashboard retains its own tenant brand');
      const otherPage = await get('/dashboard', await cookie(foreign), `other.localhost:${port}`);
      ok(otherPage.response.status === 200 && otherPage.html.includes('Welcome Back,') && otherPage.html.includes(other.name) && !otherPage.html.includes(organization.name) && !otherPage.html.includes('EXIT-UI-') && !otherPage.html.includes('data-dgst=') && !otherPage.html.includes(':E{'), 'warm second-tenant Dashboard excludes SAGA branding and employee data');
    }
    console.log(`H10 HR interface integration passed: ${checks} checks (real HTTP Server Actions; no browser automation).`);
  } catch (error) {
    console.error(output.slice(-5000)); throw error;
  } finally {
    server.kill();
    if (server.exitCode === null) await new Promise<void>(done => server.once('exit', () => done()));
  }
}
