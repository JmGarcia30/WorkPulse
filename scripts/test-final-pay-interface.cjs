/* eslint-disable @typescript-eslint/no-require-imports -- Production HTTP over rollback-only recovery fixtures. */
const assert = require('node:assert/strict'), fs = require('node:fs'), { createServer, request: rawRequest } = require('node:http');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs'), config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
const rollback = Symbol('final-pay-ui-rollback'), scenarios = [], port = 3129;
const ok = (value, label) => { assert(value, label); scenarios.push(label); console.log('PASS ' + label); };
Object.assign(process.env, config.environment, { NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port });
require('tsx/cjs');
const { createSeparationService } = require('../src/features/separation/core.ts');
const { Temporal } = require('@js-temporal/polyfill');
const day = Temporal.Now.plainDateISO('Asia/Manila');
function client(tx) {
  let sequence = 0, queue = Promise.resolve();
  return new Proxy(tx, { get(target, key) {
    if (key === '$transaction') return operation => {
      const work = async () => {
        const name = 'final_pay_ui_' + (++sequence);
        await tx.$executeRawUnsafe('SAVEPOINT ' + name);
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
  const body = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(match => match[1]).find(body => body.includes(`name="finalPayOperation" value="${operation}"`));
  assert(body, 'Missing rendered final-pay form: ' + operation);
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
      // Proxy sees persisted identity; all fixture/user/financial writes remain uncommitted.
      const org = await tx.organization.findFirstOrThrow({ where: { slug: { not: 'st-aloysius' } } });
      const foreign = await tx.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
      const marker = 'finalpayui' + Date.now(), date = value => new Date(value + 'T00:00:00Z');
      const user = (organizationId, role, suffix) => tx.user.create({ data: { organizationId, role, name: role, email: `${marker}-${suffix}@fixture.invalid` } });
      const hr = await user(org.id, 'HR_ADMIN', 'hr'), foreignHr = await user(foreign.id, 'HR_ADMIN', 'foreign');
      const service = createSeparationService(activeDb, async () => ({ userId: hr.id, organizationId: org.id, role: 'HR_ADMIN' }));
      const job = await tx.job.create({ data: { organizationId: org.id, title: 'Final Pay UI', slug: marker, department: 'Fixture', employmentType: 'Full-time', location: 'Fixture', description: 'Fixture', responsibilities: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture' } });
      const applicant = await tx.applicant.create({ data: { firstName: 'FinalPayUI', lastName: 'Fixture', email: marker + '@fixture.invalid', phone: '0' } });
      const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'Preserve' } });
      const person = await tx.employee.create({ data: { organizationId: org.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: marker, firstName: 'FinalPayUI', lastName: 'Fixture', email: applicant.email, phone: '0', createdById: hr.id } });
      await tx.employmentRecord.create({ data: { employeeId: person.id, jobId: job.id, jobTitle: job.title, department: job.department, employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: date('2020-01-01'), startDate: date('2020-01-01'), salary: 5000, payFrequency: 'MONTHLY', effectiveFrom: date('2020-01-01'), createdById: hr.id } });
      const details = { separationType: 'OTHER', reason: 'Reviewed fixture separation', proposedLastWorkingDay: day.subtract({ days: 1 }).toString(), proposedEffectiveDate: day.toString() };
      let separation = await service.createSeparationCase({ ...details, employeeId: person.id, requestKey: marker });
      const version = found => ({ caseId: found.id, expectedVersion: found.version });
      separation = await service.updateSeparationCase({ ...version(separation), details, status: 'IN_PROGRESS' });
      for (const item of separation.clearanceItems) separation = await service.recordClearanceDecision({ ...version(separation), itemId: item.id, status: 'CLEARED', verified: true });
      separation = await service.markReadyForFinalReview(version(separation));
      separation = await service.approveSeparationCase({ ...version(separation), decision: 'APPROVE_SEPARATION', remarks: 'Authorized fixture separation' });
      separation = await service.executeSeparation({ ...version(separation), remarks: 'Separation completed without final-pay record' });
      app = require('next')({ dev: false, hostname: 'localhost', port }); await app.prepare();
      server = createServer(app.getRequestHandler()); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      const { SignJWT } = await import('jose');
      async function cookie(actor) { return '__Host-workpulse_session=' + await new SignJWT({ userId: actor.id, organizationId: actor.organizationId, role: actor.role, name: actor.name, email: actor.email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(config.environment.SESSION_SECRET)); }
      const hrCookie = await cookie(hr), path = '/dashboard/employees/exit/' + separation.id;
      function request(method, session, body, contentType) {
        return new Promise((resolve, reject) => {
          const req = rawRequest({ hostname: '127.0.0.1', port, path, method, headers: { host: `${org.slug}.localhost:${port}`, 'x-forwarded-host': `${org.slug}.localhost:${port}`, cookie: session, ...(body ? { origin: `http://${org.slug}.localhost:${port}`, 'content-type': contentType, 'content-length': String(body.length) } : {}) } }, response => {
            let html = ''; response.setEncoding('utf8'); response.on('data', chunk => html += chunk); response.on('end', () => resolve({ status: response.statusCode, html }));
          }); req.on('error', reject); req.end(body);
        });
      }
      const get = () => request('GET', hrCookie);
      async function post(operation, values = {}, session = hrCookie, rendered) {
        const fields = formFor(rendered ?? (await get()).html, operation);
        for (const [key, value] of Object.entries(values)) fields.set(key, value);
        const encoded = new Request('http://localhost', { method: 'POST', body: fields });
        const result = await request('POST', session, Buffer.from(await encoded.arrayBuffer()), encoded.headers.get('content-type'));
        assert(result.status < 500, 'Action produced server error: ' + operation); return result;
      }
      let page = await get();
      ok(page.status === 200 && page.html.includes('Final Pay Management') && page.html.includes('Not started'), 'Existing case details render Final Pay Management after independent separation');
      await post('create');
      let record = await tx.employeeFinalPay.findUniqueOrThrow({ where: { caseId: separation.id } });
      ok(record.status === 'DRAFT' && record.netAmount === null, 'Rendered create action initializes unreviewed amounts without assumed zeros');
      await post('review', { confirmed: 'on' });
      assert.equal((await tx.employeeFinalPay.findUniqueOrThrow({ where: { id: record.id } })).status, 'DRAFT');
      const values = { coverageConfirmed: 'on', taxReviewed: 'on', reconciliationConfirmed: 'on', reviewNotes: 'Verified external earnings, actual payments, eligibility, tax and other benefits. Detailed finance reference on file.', deadlineDays: String(Math.min(record.deadlineDays, 10)), deadlineBasis: 'Reviewed favorable individual agreement' };
      for (const kind of ['SALARY', 'THIRTEENTH', 'LEAVE', 'SEPARATION', 'ADJUSTMENT', 'DEDUCTION']) {
        values[kind + '.disposition'] = kind === 'SALARY' ? 'APPLICABLE' : 'NOT_APPLICABLE';
        values[kind + '.first'] = kind === 'SALARY' ? '5000.00' : '';
        values[kind + '.second'] = kind === 'SALARY' ? '0.00' : '';
        values[kind + '.basis'] = 'Eligibility and already-settled amounts verified against itemized external evidence';
      }
      await post('save', values);
      await post('review', { confirmed: 'on' });
      record = await tx.employeeFinalPay.findUniqueOrThrow({ where: { id: record.id } });
      ok(record.status === 'REVIEWED' && record.netAmount.eq('5000'), 'Actual HR forms save reviewed inputs and calculate itemized PHP net');
      const staleSavePage = (await get()).html;
      await post('approve', { confirmed: 'on', remarks: 'HR explicitly approves the reviewed PHP settlement' });
      record = await tx.employeeFinalPay.findUniqueOrThrow({ where: { id: record.id } });
      ok(record.status === 'FINALIZED' && record.finalizedById === hr.id, 'Explicit approval through rendered Server Action freezes the reviewed settlement');
      await post('save', values, hrCookie, staleSavePage);
      assert.equal((await tx.employeeFinalPay.findUniqueOrThrow({ where: { id: record.id } })).status, 'FINALIZED');
      const paymentPage = (await get()).html;
      const paidValues = { amount: '5000.00', paidOn: day.toString(), reference: marker + '-receipt', remarks: 'Authorized actual receipt; no bank transfer', confirmed: 'on' };
      await post('payment', paidValues, await cookie(foreignHr), paymentPage);
      assert.equal(await tx.employeeFinalPayPayment.count({ where: { finalPayId: record.id } }), 0);
      await post('payment', paidValues, hrCookie, paymentPage);
      await post('payment', paidValues, hrCookie, paymentPage);
      page = await get();
      ok(await tx.employeeFinalPayPayment.count({ where: { finalPayId: record.id } }) === 1 && page.html.includes('Recorded paid: PHP') && page.html.includes('5000.00') && !page.html.includes('name="SALARY.first"'), 'Payment form records one receipt on retries; foreign sessions and stale finalized edits are denied');
      assert.equal((await tx.employee.findUniqueOrThrow({ where: { id: person.id } })).employeeStatus, 'SEPARATED');
      await new Promise(resolve => server.close(resolve)); server = null; await app.close(); app = null;
      throw rollback;
    }, { timeout: 600000, maxWait: 10000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { if (server) await new Promise(resolve => server.close(resolve)); await app?.close(); delete globalThis.prisma; }
  assert.deepEqual((await helper.fingerprints(db, before.columns)).tables, before.tables);
  helper.assertOriginalUnchanged(config);
  fs.writeFileSync('docs/final-pay/interface.json', JSON.stringify({ passed: true, scenarios, tablesPreserved: before.tables.length, fixtureRollback: true, coverage: 'Rendered production HTML and actual Server Actions; no visual browser or concurrent commit claim' }, null, 2));
}
main().catch(error => { console.error(error.name, String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]')); process.exitCode = 1; }).finally(() => db.$disconnect());
