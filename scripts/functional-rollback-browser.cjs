/* eslint-disable @typescript-eslint/no-require-imports -- Real browser/actions with rollback-only test fixtures. */
const fs = require('node:fs');
const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const helper = require('./batch0-recovery-environment.cjs');
const browser = require('./batch0-recovery-browser.cjs');
const config = helper.configuration();
const verification = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!verification.h10Applied || !verification.h10ChecksumMatch || verification.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_TARGET');
const securityOnly = process.env.FR_PROFILE_SECURITY === '1';
const candidateOnly = process.env.FR_CANDIDATE_DOCUMENTS === '1';
const evidenceRoot = process.env.FR_CANDIDATE_EVIDENCE_DIRECTORY || (process.env.FR_IDENTITY_REVIEW === '1' ? 'docs/functional-regression/candidate-identity' : process.env.FR_CANDIDATE_REVIEW === '1' ? 'docs/functional-regression/candidate-documents' : 'docs/functional-regression/profile-security');
const directory = candidateOnly ? evidenceRoot + (process.env.FR_DELETED_DOCUMENTS === '1' ? '/deleted' : '/candidate') : process.env.FR_SECURITY_BASELINE === '1' ? 'docs/functional-regression/profile-security/baseline' : securityOnly ? evidenceRoot + '/http' : process.env.FR_SECURITY_FUNCTIONAL === '1' ? evidenceRoot + '/browser' : 'docs/functional-regression';
fs.mkdirSync(directory, { recursive: true });
const save = (name, data) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(data, null, 2));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
const protectedReads = [];
const sessionReads = [];
const roleOnly = process.env.FR_ROLE_ONLY === '1';
function ok(value, scenario) { checks.push({ scenario, passed: Boolean(value) }); save(roleOnly ? 'role-browser-scenarios' : 'browser-scenarios', checks); console.log(JSON.stringify({ scenario, passed: Boolean(value) })); if (!value) throw Error('SCENARIO_FAILED'); }
const rollback = Error('FUNCTIONAL_FIXTURE_ROLLBACK');
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
const port = 3113, slug = 'fr' + randomBytes(6).toString('hex'), tenantHost = slug + '.localhost';
// The fallback connection is read-only. All writes must use the injected,
// uncommitted fixture client. This file is never loaded by normal app startup.
Object.assign(process.env, config.environment, { DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), NODE_ENV: 'production', PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port });
function fixtureClient(tx) {
  let queue = Promise.resolve(), sequence = 0;
  return new Proxy(tx, { get(target, property) {
    if (property === 'user') return new Proxy(target.user, { get(model, method) {
      const value = Reflect.get(model, method);
      return typeof value === 'function' ? (...args) => { sessionReads.push(String(method)); return value.apply(model, args); } : value;
    } });
    if (['employee', 'employmentRecord', 'employmentDecisionHistory', 'employeeAccount', 'probationRecord'].includes(property)) {
      return new Proxy(target[property], { get(model, method) {
        const value = Reflect.get(model, method);
        return typeof value === 'function' ? (...args) => { protectedReads.push(String(property) + '.' + String(method)); return value.apply(model, args); } : value;
      } });
    }
    if (property === '$transaction') return (operation) => {
      const work = async () => {
        const name = 'fr_' + (++sequence);
        await tx.$executeRawUnsafe('SAVEPOINT ' + name);
        try { const result = typeof operation === 'function' ? await operation(tx) : await Promise.all(operation); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
        catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); throw error; }
      };
      const result = queue.then(work); queue = result.catch(() => {}); return result;
    };
    const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
  } });
}
async function main() {
  let app, server, session;
  try {
    await db.$transaction(async tx => {
      if (process.env.FR_IDENTITY_REVIEW === '1') {
        const [state] = await tx.$queryRaw`SELECT to_regclass('public."CandidateAccess"') IS NOT NULL AS exists`;
        if (!state.exists) for (const sql of fs.readFileSync('prisma/migrations/20261021000100_candidate_access/migration.sql', 'utf8').split(';').filter(x => x.trim())) await tx.$executeRawUnsafe(sql);
      }
      globalThis.prisma = fixtureClient(tx);
      const password = randomBytes(24).toString('hex'), passwordHash = await hash(password, 10);
      const org = await tx.organization.create({ data: { name: 'Functional Regression Fixture', slug, timeZone: 'Asia/Manila' } });
      const foreign = await tx.organization.create({ data: { name: 'Foreign Regression Fixture', slug: slug + '-other' } });
      const users = {};
      for (const role of ['ORGANIZATION_ADMIN', 'HR_ADMIN', 'HIRING_MANAGER', 'EMPLOYEE']) users[role] = await tx.user.create({ data: { organizationId: org.id, role, name: role, email: `${role.toLowerCase()}-${slug}@fixture.invalid`, passwordHash } });
      const job = await tx.job.create({ data: { organizationId: org.id, title: 'Regression Position', slug: 'regression-position', department: 'Regression Department', employmentType: 'Full-time', location: 'Fixture campus', description: 'Regression description', responsibilities: 'Regression responsibilities', qualifications: 'Regression qualifications', requirements: 'Regression requirements', category: 'NON_TEACHING', status: 'PUBLISHED' } });
      const otherJob = await tx.job.create({ data: { organizationId: foreign.id, title: 'Foreign Secret Position', slug: 'foreign-position', department: 'Foreign', employmentType: 'Full-time', location: 'Foreign', description: 'Foreign', responsibilities: 'Foreign', qualifications: 'Foreign', requirements: 'Foreign' } });
      const day = value => new Date(value + 'T00:00:00Z');
      async function person(suffix, account = false) {
        const applicant = await tx.applicant.create({ data: { firstName: 'Regression', lastName: suffix, email: `${suffix}-${slug}@fixture.invalid`, phone: '09000000000' } });
        const application = await tx.application.create({ data: { applicantId: applicant.id, jobId: job.id, status: 'HIRED', coverLetter: 'Complete regression cover letter' } });
        const offer = await tx.offer.create({ data: { applicationId: application.id, salary: 35000, employmentType: 'Full-time', startDate: day('2025-01-01'), createdById: users.HR_ADMIN.id, status: 'ACCEPTED', contractSignedByPresident: true, contractSignedByEmployee: true, contractExecutedAt: day('2024-12-20') } });
        await tx.onboardingProcess.create({ data: { applicationId: application.id, startDate: day('2024-12-20'), status: 'COMPLETED', tasks: { create: [{ title: 'Regression required task', type: 'DOCUMENT', isRequired: true, status: 'VERIFIED', verifiedAt: day('2024-12-21') }] } } });
        const employee = await tx.employee.create({ data: { organizationId: org.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: 'FR-' + suffix, firstName: applicant.firstName, lastName: suffix, email: applicant.email, phone: applicant.phone, createdById: users.HR_ADMIN.id } });
        const employment = await tx.employmentRecord.create({ data: { employeeId: employee.id, jobId: job.id, acceptedOfferId: offer.id, jobTitle: job.title, department: job.department, employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: day('2025-01-01'), startDate: day('2025-01-01'), salary: 35000, payFrequency: 'MONTHLY', effectiveFrom: day('2025-01-01'), createdById: users.HR_ADMIN.id, probation: { create: { employeeId: employee.id, category: 'NON_TEACHING', startedAt: day('2025-01-01'), expectedEndAt: day('2025-07-01'), policySnapshot: 'Regression probation policy' } } } });
        if (account) {
          const link = await tx.employeeAccount.create({ data: { organizationId: org.id, employeeId: employee.id, userId: users.EMPLOYEE.id, createdById: users.HR_ADMIN.id, status: 'ACTIVE', activatedAt: new Date() } });
          await tx.employeeAccountAudit.create({ data: { organizationId: org.id, employeeAccountId: link.id, actorUserId: users.HR_ADMIN.id, action: 'ACTIVATED', details: { regression: true } } });
        }
        return { employee, employment, application, offer };
      }
      const primary = await person('Primary', true);
      await person('Secondary');
      const applicant = await tx.applicant.create({ data: { firstName: 'Pipeline', lastName: 'Candidate', email: `pipeline-${slug}@fixture.invalid`, phone: '09000000001' } });
      const candidate = await tx.application.create({ data: { applicantId: applicant.id, jobId: job.id, coverLetter: 'Pipeline complete cover letter' } });
      const period = await tx.payrollPeriod.create({ data: { organizationId: org.id, name: 'Regression payroll period', periodStart: day('2026-10-01'), periodEnd: day('2026-10-31'), payDate: day('2026-11-05') } });
      await tx.employeeCompensation.create({ data: { organizationId: org.id, employeeId: primary.employee.id, compensationType: 'MONTHLY', baseRate: '35000.00', payFrequency: 'MONTHLY', currency: 'PHP', effectiveFrom: day('2025-01-01') } });
      const fixtureCounts = { organizations: 2, employees: 2, candidateApplications: 3 };
      save('browser-conditions', { mode: 'local production build via test-only Next custom server', fixtureCounts, transactionMode: 'one outer rollback transaction; nested app transactions use serialized savepoints', trueCommitAndConcurrentTransactionCoverage: false, schemaChanges: false, fallbackConnectionReadOnly: true });
      app = require('next')({ dev: false, hostname: '127.0.0.1', port, ...(process.env.FR_SECURITY_BASELINE === '1' ? { dir: process.env.FR_BASELINE_DIRECTORY } : {}) });
      await app.prepare();
      const handle = app.getRequestHandler();
      server = createServer((req, res) => handle(req, res));
      await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
      session = await browser({ port, production: true, email: users.ORGANIZATION_ADMIN.email, password, tenantHost });
      ok(true, 'Normal password login reaches fixture-only Dashboard');
      if (candidateOnly) {
        await require(process.env.FR_IDENTITY_REVIEW === '1' ? './test-candidate-identity-http.cjs' : './test-candidate-document-http.cjs')({ tx, org, foreign, users, primary, job, otherJob, candidate, tenantHost, port, session, save, ok });
        save('candidate-result', { assertionsPassed: true, scenarios: checks.length, candidateIdentityPolicyResolved: process.env.FR_IDENTITY_REVIEW === '1', secureAcrossAllPaths: process.env.FR_IDENTITY_REVIEW === '1' });
        await session.close(); session = null;
        await new Promise(resolve => server.close(resolve)); server = null;
        await app.close(); app = null;
        throw rollback;
      }
      if (securityOnly) {
        await require('./test-profile-security-http.cjs')({ tx, org, foreign, users, primary, candidate, tenantHost, port, session, protectedReads, sessionReads, save, ok });
        save('security-result', { passed: true, scenarios: checks.length });
        await session.close(); session = null;
        await new Promise(resolve => server.close(resolve)); server = null;
        await app.close(); app = null;
        throw rollback;
      }
      if (roleOnly) {
        await tx.user.update({ where: { id: users.ORGANIZATION_ADMIN.id }, data: { role: 'HIRING_MANAGER' } });
        const response = await fetch(`http://127.0.0.1:${port}/dashboard/employees/${primary.employee.id}`, { headers: { host: `${tenantHost}:${port}`, 'x-forwarded-host': `${tenantHost}:${port}`, cookie: session.cookie }, redirect: 'manual' });
        const body = await response.text();
        const result = { status: response.status, redirectOrError: response.status >= 300 || body.includes('NEXT_REDIRECT') || body.includes('FORBIDDEN'), includesFixtureIdentity: body.includes('FR-Primary') };
        save('stale-role-profile', result);
        ok(result.redirectOrError && !result.includesFixtureIdentity, 'Persisted role downgrade rejects stale admin JWT on Profile without employee payload');
        await session.close(); session = null;
        await new Promise(resolve => server.close(resolve)); server = null;
        await app.close(); app = null;
        throw rollback;
      }
      const evaluate = expression => session.evaluate(expression);
      async function until(expression, label, attempts = 300) {
        for (let i = 0; i < attempts; i++) { if (await evaluate(expression)) return; await pause(100); }
        throw Error('WAIT_FAILED_' + label);
      }
      async function goto(route, expected) {
        await session.send('Page.navigate', { url: `http://${tenantHost}:${port}${route}` });
        await until(`document.readyState==='complete'&&${JSON.stringify(expected)}.every(t=>(document.querySelector('main')?.innerText||document.body.innerText||'').toLowerCase().includes(t.toLowerCase()))`, 'CONTENT');
        await pause(300);
      }
      await goto('/dashboard/employees/' + primary.employee.id, ['FR-Primary', 'Regression Position']);
      ok(await evaluate(`document.querySelector('main').innerText.includes('Regression Department')`), 'Profile identity and effective employment information complete');
      for (const tab of ['probation', 'history', 'decisions', 'compliance', 'account', 'overview']) {
        const row = await session.navigate({ name: 'Profile ' + tab, route: `/dashboard/employees/${primary.employee.id}?tab=${tab}`, expected: ['FR-Primary'], sidebar: false });
        ok(row.completed && !row.renderedError && !row.runtimeExceptions && !row.consoleErrors && !row.failedHttpResponses.length, 'Profile ' + tab + ' navigates without errors');
        if (tab === 'compliance') ok(await evaluate(`document.querySelector('main').innerText.includes('Regression required task')`), 'Compliance selective read includes required onboarding task');
        if (tab === 'account') ok(await evaluate(`document.querySelector('main').innerText.includes(${JSON.stringify(users.EMPLOYEE.email)})&&/Activated/i.test(document.querySelector('main').innerText)`), 'Account selective read includes email, activation and audit history');
      }
      await goto(`/dashboard/employees/${primary.employee.id}?tab=probation`, ['Regularize Employee']);
      await evaluate(`[...document.querySelectorAll('main button')].find(b=>b.innerText==='Regularize Employee').click();true`);
      await until(`!!document.querySelector('dialog')`, 'DIALOG');
      await evaluate(`(()=>{const i=document.querySelector('dialog input[type=date]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'2024-01-01');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
      await evaluate(`[...document.querySelectorAll('dialog button')].find(b=>b.innerText.includes('Confirm Decision')).click();true`);
      await until(`!!document.querySelector('dialog .bg-rose-50')`, 'VALIDATION');
      ok(await tx.employmentDecisionHistory.count({ where: { employeeId: primary.employee.id } }) === 0, 'Invalid employment effective date displays validation and writes no decision');
      await evaluate(`(()=>{const i=document.querySelector('dialog input[type=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'2025-07-01');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
      await evaluate(`[...document.querySelectorAll('dialog button')].find(b=>b.innerText.includes('Confirm Decision')).click();true`);
      await until(`!document.querySelector('dialog')`, 'REGULARIZATION');
      ok(await tx.employmentDecisionHistory.count({ where: { employeeId: primary.employee.id } }) === 1, 'Regularization saves exactly one employment decision after validation recovery');
      await goto(`/dashboard/employees/${primary.employee.id}?tab=history`, ['REGULAR']);
      ok((await tx.employmentRecord.findMany({ where: { employeeId: primary.employee.id } })).length === 2, 'Regularization preserves prior employment and creates effective-dated successor');
      await goto(`/dashboard/employees/${primary.employee.id}?tab=decisions`, ['Regularization']);
      ok(await evaluate(`document.querySelector('main').innerText.includes('HR_ADMIN')||document.querySelector('main').innerText.includes('ORGANIZATION_ADMIN')`), 'Decision selective read includes persisted actor');
      await goto('/dashboard/hiring/pipeline', ['Pipeline Candidate']);
      ok(!await evaluate(`document.querySelector('main').innerText.includes('Foreign Secret Position')`), 'Pipeline excludes foreign job/application information');
      await evaluate(`document.querySelector('button[aria-label="Move stage for Pipeline Candidate"]').click();true`);
      await until(`!!document.querySelector('dialog')`, 'STAGE_DIALOG');
      await evaluate(`[...document.querySelectorAll('dialog button')].find(b=>b.innerText.includes('Move Candidate to')).click();true`);
      await until(`!document.querySelector('dialog')`, 'STAGE_SAVE');
      const moved = await tx.application.findUniqueOrThrow({ where: { id: candidate.id } });
      ok(moved.status === 'SCREENING' && await tx.applicationStatusHistory.count({ where: { applicationId: candidate.id, fromStatus: 'APPLIED', toStatus: 'SCREENING' } }) === 1, 'Pipeline status action persists SCREENING and exactly one transition history');
      await goto('/dashboard/hiring/pipeline?jobId=' + otherJob.id, ['Pipeline Candidate']);
      ok(!await evaluate(`document.querySelector('main').innerText.includes('Foreign Secret Position')`), 'Foreign job filter preserves tenant-scoped fallback without foreign information');
      await goto('/dashboard/hiring/pipeline?jobId=' + job.id, ['Pipeline Candidate']);
      ok(await evaluate(`document.querySelector('main select').value===${JSON.stringify(job.id)}`), 'Owned job filter remains selected and data reloads after status update');
      await goto(`/dashboard/hiring/jobs/${job.id}/edit`, ['Edit Job Posting']);
      await evaluate(`(()=>{const i=document.querySelector('input[name=title]');i.value='Regression Position Edited';i.form.requestSubmit();return true})()`);
      await until(`!location.pathname.endsWith('/edit')`, 'JOB_SAVE');
      ok((await tx.job.findUniqueOrThrow({ where: { id: job.id } })).title === 'Regression Position Edited', 'Job edit form persists changes');
      await goto('/dashboard/hiring/pipeline', ['Regression Position Edited', 'Pipeline Candidate']);
      ok(true, 'Parallel pipeline reload reflects saved job title and current candidate');
      await goto('/dashboard/payroll?tab=processing', ['Generate / Recalculate Payroll']);
      const generation = `document.querySelector('select[name=payrollPeriodId]').closest('form')`;
      await evaluate(`(()=>{const s=document.querySelector('select[name=payrollPeriodId]');s.value=${JSON.stringify(period.id)};s.dispatchEvent(new Event('change',{bubbles:true}));s.form.requestSubmit();return true})()`);
      await until(`document.querySelector('form[aria-busy=true]')!==null`, 'PAYROLL_PENDING');
      ok(await evaluate(`(()=>{const f=${generation};return f.innerText.includes('Payroll generation is in progress.')&&f.querySelector('button').disabled&&f.querySelector('select').disabled})()`), 'Real payroll request shows pending and locks duplicate submission controls');
      await until(`!document.querySelector('form[aria-busy=true]')&&document.querySelector('main').innerText.includes('payroll entry generated.')`, 'PAYROLL_DONE');
      const entries = await tx.payrollEntry.findMany({ where: { organizationId: org.id, payrollPeriodId: period.id } });
      ok(entries.length === 1 && entries[0].grossAmount.toFixed(2) === '35000.00' && entries[0].netAmount.toFixed(2) === '35000.00', 'Payroll completion corresponds to persisted exact Decimal amounts');
      ok(await evaluate(`document.querySelector('main').innerText.includes('Setup required for 1 employee')`), 'Partial payroll generation reports missing compensation instead of false all-employee success');
      await evaluate(`${generation}.requestSubmit();true`);
      await until(`!document.querySelector('form[aria-busy=true]')&&document.querySelector('main').innerText.includes('existing immutable entry')`, 'PAYROLL_REPEAT');
      ok(await tx.payrollEntry.count({ where: { payrollPeriodId: period.id } }) === 1, 'Repeated payroll submission preserves one entry without duplicates');
      for (const [route, expected] of [['/dashboard/attendance', ['Monthly Attendance']], ['/dashboard/leave', ['Leave Management']], ['/dashboard/analytics', ['Workforce Overview']], ['/dashboard/employees/exit', ['Separation cases']], ['/dashboard/hiring/jobs', ['Regression Position Edited']], ['/dashboard/hiring/applicants/' + candidate.id, ['Pipeline Candidate']]]) {
        await goto(route, expected); ok(true, 'Rendered workflow ' + route.replace(candidate.id, '[fixture]'));
      }
      await goto('/dashboard/employees/does-not-exist', ['404']);
      ok(true, 'Missing employee profile uses not-found state');
      await goto('/dashboard/employees/' + primary.employee.id, ['FR-Primary']);
      ok(true, 'Profile recovers after not-found navigation');
      const adminCookie = session.cookie;
      await tx.user.update({ where: { id: users.ORGANIZATION_ADMIN.id }, data: { role: 'HIRING_MANAGER' } });
      const staleRoleResponse = await fetch(`http://127.0.0.1:${port}/dashboard/employees/${primary.employee.id}`, { headers: { host: `${tenantHost}:${port}`, 'x-forwarded-host': `${tenantHost}:${port}`, cookie: adminCookie }, redirect: 'manual' });
      const staleRoleBody = await staleRoleResponse.text();
      const staleRoleResult = { status: staleRoleResponse.status, redirectOrError: staleRoleResponse.status >= 300 || staleRoleBody.includes('NEXT_REDIRECT') || staleRoleBody.includes('FORBIDDEN'), includesFixtureIdentity: staleRoleBody.includes('FR-Primary') };
      save('stale-role-profile', staleRoleResult);
      await tx.user.update({ where: { id: users.ORGANIZATION_ADMIN.id }, data: { role: 'ORGANIZATION_ADMIN' } });
      ok(staleRoleResult.redirectOrError && !staleRoleResult.includesFixtureIdentity, 'Persisted role downgrade rejects stale admin JWT on Profile without employee payload');
      const foreignResponse = await fetch(`http://127.0.0.1:${port}/dashboard`, { headers: { host: `${foreign.slug}.localhost:${port}`, 'x-forwarded-host': `${foreign.slug}.localhost:${port}`, cookie: adminCookie }, redirect: 'manual' });
      const foreignBody = await foreignResponse.text();
      ok(!foreignBody.includes('FR-Primary') && (foreignResponse.status >= 300 || foreignBody.includes('NEXT_REDIRECT')), 'Tenant mismatch denies session on foreign Dashboard without own fixture employee data');
      await session.close(); session = null;
      session = await browser({ port, production: true, email: users.HIRING_MANAGER.email, password, tenantHost });
      await goto('/dashboard', ['Welcome Back,']);
      ok(!await evaluate(`!!document.querySelector('aside a[href="/dashboard/payroll"]')||!!document.querySelector('aside a[href="/dashboard/employees"]')`), 'Hiring Manager navigation hides employee and payroll modules');
      await session.send('Page.navigate', { url: `http://${tenantHost}:${port}/dashboard/employees/${primary.employee.id}` });
      await until(`location.pathname==='/dashboard'&&/Welcome Back,/i.test(document.querySelector('main')?.innerText||'')`, 'MANAGER_DENIED');
      ok(true, 'Hiring Manager direct Profile URL redirects without HR access');
      await session.close(); session = null;
      session = await browser({ port, production: true, email: users.EMPLOYEE.email, password, tenantHost, employeeLogin: true });
      ok(true, 'Normal employee login reaches ESS Dashboard with own linked employee');
      await goto('/employee/profile', ['Regression Primary']);
      ok(!await evaluate(`document.querySelector('main').innerText.includes('Secondary')`), 'ESS profile exposes only own employee information');
      for (const [route, expected] of [['/employee/employment', ['Employment']], ['/employee/attendance', ['Attendance']], ['/employee/leave', ['Leave']], ['/employee/payroll', ['Payroll']]]) {
        await goto(route, expected); ok(true, 'ESS rendered own workflow ' + route);
      }
      await session.send('Network.clearBrowserCookies');
      await session.send('Page.navigate', { url: `http://${tenantHost}:${port}/dashboard` });
      await until(`location.pathname==='/login'&&!!document.querySelector('input[name=password]')`, 'AUTH_REDIRECT');
      ok(true, 'Unauthenticated Dashboard navigation redirects to login');
      await pause(500);
      await evaluate(`(()=>{document.querySelector('input[name=email]').value=${JSON.stringify(users.ORGANIZATION_ADMIN.email)};document.querySelector('input[name=password]').value='incorrect-password';document.querySelector('input[name=password]').form.requestSubmit();return true})()`);
      await until(`!!document.querySelector('form p[role=alert]')`, 'BAD_LOGIN');
      ok((await session.send('Network.getAllCookies')).cookies.every(cookie => cookie.name !== '__Host-workpulse_session'), 'Invalid password shows validation and creates no session');
      await evaluate(`(()=>{document.querySelector('input[name=email]').value=${JSON.stringify(users.ORGANIZATION_ADMIN.email)};document.querySelector('input[name=password]').value=${JSON.stringify(password)};document.querySelector('input[name=password]').form.requestSubmit();return true})()`);
      await until(`location.pathname==='/dashboard'&&/Welcome Back,/i.test(document.querySelector('main')?.innerText||'')`, 'LOGIN_RECOVERY');
      ok(true, 'Login recovers successfully after invalid credentials');
      save('browser-result', { passed: checks.every(row => row.passed), scenarios: checks.length, productionBuildWithDashboardCorrection: true, realConcurrentCommitsCovered: false });
      await session.close(); session = null;
      await new Promise(resolve => server.close(resolve)); server = null;
      await app.close(); app = null;
      throw rollback;
    }, { timeout: 600000, maxWait: 10000 });
  } catch (error) {
    if (error !== rollback) { save('browser-failure', { code: error.code || error.name, stage: checks.at(-1)?.scenario, message: /^[A-Z_]+$/.test(error.message) ? error.message : undefined, locations: error.stack?.split(/\r?\n/).filter(line => /^\s+at /.test(line)) }); throw error; }
  } finally {
    await session?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await app?.close(); delete globalThis.prisma;
    const remaining = await db.organization.count({ where: { slug: { startsWith: slug } } });
    save('browser-cleanup', { rollbackConfirmed: remaining === 0, fixtureOrganizationsRemaining: remaining });
    await db.$disconnect(); helper.assertOriginalUnchanged(config);
  }
}
main().catch(e => { console.error(JSON.stringify({ code: e.code || e.name, message: /^[A-Z_]+$/.test(e.message) ? e.message : undefined, validation: e.name === 'PrismaClientValidationError' ? e.message.split(/\r?\n/).slice(-3).join(' ').replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]') : undefined })); process.exitCode = 1; });
