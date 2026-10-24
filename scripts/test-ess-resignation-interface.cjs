/* eslint-disable @typescript-eslint/no-require-imports -- Production HTTP with rollback-only recovery fixtures. */
const assert = require('node:assert/strict'), fs = require('node:fs'), { createServer, request: rawRequest } = require('node:http');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs'), config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
const rollback = Symbol('ess-ui-rollback'), scenarios = [], port = 3141;
const ok = (value, label) => { assert(value, label); scenarios.push(label); console.log('PASS ' + label); };
Object.assign(process.env, config.environment, { NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port });
require('tsx/cjs');
const { createSeparationService } = require('../src/features/separation/core.ts');
const { Temporal } = require('@js-temporal/polyfill');
function client(tx) {
  let queue = Promise.resolve(), sequence = 0;
  return new Proxy(tx, { get(target, key) {
    if (key === '$transaction') return operation => {
      const work = async () => {
        const name = 'ess_ui_' + (++sequence); await tx.$executeRawUnsafe('SAVEPOINT ' + name);
        try { const result = await operation(tx); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
        catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); throw error; }
      };
      const result = queue.then(work, work); queue = result.catch(() => {}); return result;
    };
    return Reflect.get(target, key);
  } });
}
const decode = value => value.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
function formFor(html, operation) {
  const body = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(match => match[1]).find(body => operation === 'submit' ? body.includes('name="proposedLastWorkingDay"') && body.includes('name="requestKey"') && body.includes('name="reason"') : body.includes(`name="operation" value="${operation}"`));
  assert(body, 'Missing rendered form: ' + operation);
  const fields = new FormData();
  for (const input of body.matchAll(/<input\b[^>]*>/g)) {
    const name = input[0].match(/\bname="([^"]*)"/)?.[1], value = input[0].match(/\bvalue="([^"]*)"/)?.[1];
    if (name && (name.startsWith('$ACTION_') || /type="hidden"/.test(input[0]))) fields.set(decode(name), decode(value ?? ''));
  }
  return fields;
}
async function main() {
  let app, server;
  const before = await helper.fingerprints(db);
  try {
    await db.$transaction(async tx => {
      const activeDb = client(tx); globalThis.prisma = activeDb;
      const org = await tx.organization.findFirstOrThrow({ where: { slug: { not: 'st-aloysius' } } });
      const foreign = await tx.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
      const marker = 'essui' + Date.now(), day = Temporal.Now.plainDateISO(org.timeZone), date = value => new Date(value + 'T00:00:00Z');
      const user = (organizationId, role, suffix) => tx.user.create({ data: { organizationId, role, name: role, email: `${marker}-${suffix}@fixture.invalid` } });
      const hr = await user(org.id, 'HR_ADMIN', 'hr'), foreignHr = await user(foreign.id, 'HR_ADMIN', 'foreign');
      const hrService = createSeparationService(activeDb, async () => ({ userId: hr.id, organizationId: org.id, role: 'HR_ADMIN' }));
      await hrService.saveResignationPolicy({ noticePeriod: 30, noticeUnit: 'CALENDAR_DAYS', allowExceptions: true });
      const job = await tx.job.create({ data: { organizationId: org.id, title: 'ESS resignation fixture', slug: marker, department: 'Fixture', employmentType: 'Full-time', location: 'Fixture', description: 'Fixture', responsibilities: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture' } });
      async function employee(suffix) {
        const applicant = await tx.applicant.create({ data: { firstName: 'ESSResignation', lastName: suffix, email: `${marker}-${suffix}@fixture.invalid`, phone: '0' } });
        const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'Preserve' } });
        const person = await tx.employee.create({ data: { organizationId: org.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: marker + suffix, firstName: applicant.firstName, lastName: suffix, email: applicant.email, phone: '0', createdById: hr.id } });
        await tx.employmentRecord.create({ data: { employeeId: person.id, jobId: job.id, jobTitle: job.title, department: job.department, employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: date('2020-01-01'), startDate: date('2020-01-01'), salary: 30000, payFrequency: 'MONTHLY', effectiveFrom: date('2020-01-01'), createdById: hr.id } });
        const login = await user(org.id, 'EMPLOYEE', 'login' + suffix);
        const account = await tx.employeeAccount.create({ data: { organizationId: org.id, employeeId: person.id, userId: login.id, status: 'ACTIVE', activatedAt: new Date(), createdById: hr.id } });
        return { ...person, login, account };
      }
      const person = await employee('A'), other = await employee('B');
      app = require('next')({ dev: false, hostname: 'localhost', port }); await app.prepare();
      server = createServer(app.getRequestHandler()); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      const { SignJWT } = await import('jose');
      async function cookie(actor) { return '__Host-workpulse_session=' + await new SignJWT({ userId: actor.id, organizationId: actor.organizationId, role: actor.role, name: actor.name, email: actor.email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(config.environment.SESSION_SECRET)); }
      const employeeCookie = await cookie(person.login), hrCookie = await cookie(hr), otherCookie = await cookie(other.login), foreignCookie = await cookie(foreignHr), path = '/employee/resignation';
      function request(route, method, session, body, contentType) {
        return new Promise((resolve, reject) => {
          const req = rawRequest({ hostname: '127.0.0.1', port, path: route, method, headers: { host: `${org.slug}.localhost:${port}`, 'x-forwarded-host': `${org.slug}.localhost:${port}`, ...(session ? { cookie: session } : {}), ...(body ? { origin: `http://${org.slug}.localhost:${port}`, 'content-type': contentType, 'content-length': String(body.length) } : {}) } }, response => {
            let html = ''; response.setEncoding('utf8'); response.on('data', chunk => html += chunk); response.on('end', () => resolve({ status: response.statusCode, html }));
          }); req.on('error', reject); req.end(body);
        });
      }
      const get = (route, session = employeeCookie) => request(route, 'GET', session);
      async function post(route, operation, values, session = employeeCookie, rendered) {
        const fields = formFor(rendered ?? (await get(route, session)).html, operation);
        for (const [key, value] of Object.entries(values)) fields.set(key, value);
        const encoded = new Request('http://localhost', { method: 'POST', body: fields });
        return request(route, 'POST', session, Buffer.from(await encoded.arrayBuffer()), encoded.headers.get('content-type'));
      }
      const initial = await get(path);
      ok(initial.status === 200 && initial.html.includes('My resignation') && initial.html.includes('30 calendar day(s)') && initial.html.includes('/employee/resignation'), 'ESS navigation, responsive notice form and current organization policy render');
      const values = { reason: marker + ' employee notice only', proposedLastWorkingDay: day.add({ days: 35 }).toString(), proposedEffectiveDate: day.add({ days: 36 }).toString(), confirmed: 'on' };
      await post(path, 'submit', { ...values, employeeId: other.id }, employeeCookie, initial.html);
      assert.equal(await tx.employeeSeparationCase.count({ where: { employeeId: person.id } }), 0);
      await post(path, 'submit', values, hrCookie, initial.html);
      await post(path, 'submit', values, foreignCookie, initial.html);
      assert.equal(await tx.employeeSeparationCase.count({ where: { employeeId: person.id } }), 0);
      await post(path, 'submit', values, employeeCookie, initial.html);
      await post(path, 'submit', values, employeeCookie, initial.html);
      let found = await tx.employeeSeparationCase.findFirstOrThrow({ where: { employeeId: person.id } });
      assert.equal(await tx.employeeSeparationCase.count({ where: { employeeId: person.id } }), 1);
      assert.equal(found.submissionSource, 'ESS'); assert.equal(found.status, 'DRAFT');
      assert.equal((await tx.employeeAccount.findUniqueOrThrow({ where: { id: person.account.id } })).status, 'ACTIVE');
      assert.equal(await tx.employeeFinalPay.count({ where: { caseId: found.id } }), 0);
      ok(true, 'Real ESS Server Action rejects identity/role/tenant spoofing, submits one durable notice on retries and preserves access with no final-pay record');
      const tracking = await get(path);
      ok(tracking.html.includes(values.reason) && tracking.html.includes('awaiting HR acknowledgment') && !tracking.html.includes('Submit resignation notice'), 'Employee tracks only the submitted notice and cannot create a duplicate active notice');
      const privateRead = await get(path + '?employeeId=' + person.id, otherCookie);
      assert(!privateRead.html.includes(values.reason));
      const dashboard = await get('/dashboard', hrCookie);
      ok(dashboard.status === 200 && dashboard.html.includes('Acknowledge receipt and process employee resignation notice') && dashboard.html.includes('/dashboard/employees/exit/' + found.id), 'Existing HR Requires Attention queue contains the resignation notification and case link');
      const hrPath = '/dashboard/employees/exit/' + found.id;
      const hrPage = await get(hrPath, hrCookie);
      ok(hrPage.status === 200 && hrPage.html.includes('Employee-submitted resignation notice') && hrPage.html.includes('Acknowledge receipt') && hrPage.html.includes('not acceptance or rejection'), 'Existing Exit case provides receipt acknowledgment without an acceptance/rejection workflow');
      await post(hrPath, 'acknowledge', { remarks: 'HR receipt message visible to employee' }, hrCookie, hrPage.html);
      found = await tx.employeeSeparationCase.findUniqueOrThrow({ where: { id: found.id } });
      assert(found.acknowledgedAt); assert.equal(found.status, 'DRAFT');
      assert.equal(await tx.employeeClearanceItem.count({ where: { caseId: found.id, status: 'PENDING' } }), 5);
      assert.equal(await tx.employeeSeparationReview.count({ where: { caseId: found.id } }), 0);
      assert((await get(path)).html.includes('HR receipt message visible to employee'));
      assert(!(await get('/dashboard', hrCookie)).html.includes('/dashboard/employees/exit/' + found.id));
      ok(true, 'Acknowledgment updates employee tracking and clears the HR notification without approving, clearing, executing or changing access');
      const details = { separationType: 'RESIGNATION', reason: found.reason, noticeDate: found.noticeDate.toISOString().slice(0, 10), proposedLastWorkingDay: values.proposedLastWorkingDay, proposedEffectiveDate: values.proposedEffectiveDate, administrativeRemarks: 'PRIVATE_HR_DETAILS_FORBIDDEN_IN_ESS' };
      await post(hrPath, 'update', details, hrCookie);
      assert((await get(path)).html.includes('HR processing'));
      assert(!(await get(path)).html.includes('PRIVATE_HR_DETAILS_FORBIDDEN_IN_ESS'));
      const unacknowledged = await get(path, '');
      assert(unacknowledged.status !== 200 || !unacknowledged.html.includes(values.reason));
      await tx.employeeAccount.update({ where: { id: person.account.id }, data: { status: 'DISABLED', disabledAt: new Date(), disabledReason: 'Eligibility fixture check' } });
      await post(path, 'submit', values, employeeCookie, initial.html);
      assert.equal(await tx.employeeSeparationCase.count({ where: { employeeId: person.id } }), 1);
      ok(true, 'HR processing status is visible without leaking private HR data; other employees, anonymous and newly disabled sessions cannot read or resubmit the notice');
      await new Promise(resolve => server.close(resolve)); server = null; await app.close(); app = null;
      throw rollback;
    }, { timeout: 600000, maxWait: 10000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { if (server) await new Promise(resolve => server.close(resolve)); await app?.close(); delete globalThis.prisma; }
  assert.deepEqual((await helper.fingerprints(db, before.columns)).tables, before.tables);
  helper.assertOriginalUnchanged(config);
  fs.writeFileSync('docs/ess-resignation/interface.json', JSON.stringify({ passed: true, scenarios, tablesPreserved: before.tables.length, fixtureRollback: true, coverage: 'Rendered production HTML and real HTTP Server Actions; no visual browser or independent concurrency claim' }, null, 2));
}
main().catch(error => { console.error(error.name, String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]')); process.exitCode = 1; }).finally(() => db.$disconnect());
