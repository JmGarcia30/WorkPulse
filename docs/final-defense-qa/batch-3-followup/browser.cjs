/* eslint-disable @typescript-eslint/no-require-imports -- Authenticated production-build E2E using rollback-only synthetic fixtures. */
const fs = require('node:fs'), { createServer } = require('node:http'), { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client'), { hash } = require('bcryptjs');
const helper = require('../../../scripts/batch0-recovery-environment.cjs'), browser = require('./browser-client.cjs');
const config = helper.configuration();
const verification = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verification.identity.branchId || config.identity.endpointSha256 !== verification.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
const directory = 'docs/final-defense-qa/batch-3-followup/evidence/browser', port = 3143, slug = 'b3-followup-' + randomBytes(6).toString('hex');
fs.mkdirSync(directory, { recursive: true });
const save = (name, value) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], rollback = Error('PHASE3_BROWSER_ROLLBACK');
function ok(value, scenario) { checks.push({ scenario, passed: Boolean(value) }); save('browser-checks', checks); console.log(JSON.stringify(checks.at(-1))); if (!value) throw Error('PHASE3_BROWSER_ASSERTION'); }
// Fallback access is read-only; all application writes use the injected outer transaction.
Object.assign(process.env, config.environment, { DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), NODE_ENV: 'production', PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port });
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
function fixtureClient(tx) {
  let queue = Promise.resolve(), sequence = 0;
  return new Proxy(tx, { has(target, property) { return property === '$transaction' || Reflect.has(target, property); }, get(target, property) {
    if (property === '$transaction') return operation => {
      const work = async () => {
        const name = 'payroll3_' + (++sequence); await tx.$executeRawUnsafe('SAVEPOINT ' + name);
        try { const result = await operation(tx); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
        catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); throw error; }
      };
      const result = queue.then(work); queue = result.catch(() => {}); return result;
    };
    const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
  } });
}
async function main() {
  save('live-target', await require('./target.cjs').verify());
  let app, server, session;
  const before = await helper.fingerprints(db);
  try {
    await db.$transaction(async tx => {
      globalThis.prisma = fixtureClient(tx);
      const password = randomBytes(24).toString('hex'), passwordHash = await hash(password, 10);
      const day = value => new Date(value + 'T00:00:00.000Z');
      async function fixture(suffix) {
        const org = await tx.organization.create({ data: { slug: slug + '-' + suffix, name: 'Payroll E2E ' + suffix, timeZone: 'Asia/Manila' } });
        await tx.organizationBranding.create({ data: { organizationId: org.id, displayName: 'Fictional Payroll QA ' + suffix, primaryColor: '#0f766e', accentColor: '#ca8a04' } });
        const users = {};
        for (const role of ['ORGANIZATION_ADMIN', 'HR_ADMIN', 'HIRING_MANAGER', 'EMPLOYEE']) users[role] = await tx.user.create({ data: { organizationId: org.id, role, name: role, email: `${role.toLowerCase()}-${org.slug}@fixture.invalid`, passwordHash } });
        const job = await tx.job.create({ data: { organizationId: org.id, title: 'Payroll E2E fixture', slug: 'fixture-job', department: 'Test', employmentType: 'Full-time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', category: 'NON_TEACHING', status: 'DRAFT' } });
        const applicant = await tx.applicant.create({ data: { firstName: 'Synthetic', lastName: suffix, email: `applicant-${org.slug}@fixture.invalid`, phone: '0' } });
        const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'Disposable payroll verification' } });
        const employee = await tx.employee.create({ data: { organizationId: org.id, applicantId: applicant.id, sourceApplicationId: application.id, employeeNumber: 'P3-' + suffix, firstName: applicant.firstName, lastName: suffix, email: applicant.email, phone: '0', createdById: users.HR_ADMIN.id } });
        await tx.employmentRecord.create({ data: { employeeId: employee.id, jobTitle: job.title, department: 'Test', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: day('2026-01-01'), startDate: day('2026-01-01'), effectiveFrom: day('2026-01-01'), salary: '35000', payFrequency: 'MONTHLY', employmentStatus: 'REGULAR', createdById: users.HR_ADMIN.id } });
        await tx.employeeAccount.create({ data: { organizationId: org.id, userId: users.EMPLOYEE.id, employeeId: employee.id, status: 'ACTIVE', activatedAt: new Date(), createdById: users.HR_ADMIN.id } });
        return { org, users, employee };
      }
      const monthly = await fixture('monthly'), semi = await fixture('semi');
      app = require('next')({ dev: false, hostname: '127.0.0.1', port }); await app.prepare();
      const handle = app.getRequestHandler(); server = createServer((req, res) => handle(req, res));
      await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
      let current;
      async function login(f, role) {
        await session?.close(); current = f;
        session = await browser({ port, production: true, email: f.users[role].email, password, employeeLogin: role === 'EMPLOYEE', tenantHost: f.org.slug + '.localhost' });
        const diagnostics = 'window.__payrollErrors=[];const originalError=console.error;console.error=(...args)=>{window.__payrollErrors.push(args.map(String).join(" "));originalError.apply(console,args)};addEventListener("error",e=>window.__payrollErrors.push(e.message));';
        await session.send('Page.addScriptToEvaluateOnNewDocument', { source: diagnostics });
        await session.evaluate(diagnostics + 'true');
      }
      async function until(expression, label) {
        for (let i = 0; i < 240; i++) { if (await session.evaluate(expression)) return; await pause(75); }
        save('browser-failure-detail', { label, page: await session.evaluate('({path:location.pathname,text:document.querySelector("main")?.innerText.slice(-4000),errors:window.__payrollErrors})') });
        throw Error(label);
      }
      async function goto(route, marker) {
        await session.send('Page.navigate', { url: `http://${current.org.slug}.localhost:${port}${route}` });
        await until(`document.readyState==='complete' && document.querySelector('main')?.innerText.includes(${JSON.stringify(marker)}) && !document.querySelector('main [data-wp-loading]')`, 'PAGE_NOT_READY');
        await pause(200);
        await session.evaluate('document.querySelectorAll("details").forEach(e=>e.open=true);true');
      }
      async function screenshot(name) {
        const shot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        fs.writeFileSync(`${directory}/${name}.png`, Buffer.from(shot.data, 'base64'));
      }
      const network = [];
      async function submit(buttonText, values, success) {
        // Current main keeps statutory forms under Employee Pay Setup, linked from Run Payroll.
        if (['Save reviewed period inputs', 'Save verified opening history'].includes(buttonText)
          && !await session.evaluate(`[...document.querySelectorAll('button')].some(e=>e.textContent.trim()===${JSON.stringify(buttonText)})`)) {
          await session.evaluate('document.querySelector("main a[href*=configuration][href*=advanced-payroll]").click();true');
          await until(`[...document.querySelectorAll('button')].some(e=>e.textContent.trim()===${JSON.stringify(buttonText)})`, 'ADVANCED_SETUP_NOT_READY');
        }
        if (buttonText === 'Generate Payroll' && await session.evaluate('new URL(location.href).searchParams.get("tab")==="configuration"')) {
          await goto(`/dashboard/payroll?tab=processing&period=${values.payrollPeriodId}`, 'Check Employee Readiness');
        }
        save('browser-step', { action: buttonText });
        const prepared = await session.evaluate(`(()=>{try{const b=[...document.querySelectorAll('button')].find(e=>e.form&&e.textContent.trim()===${JSON.stringify(buttonText)});if(!b)throw Error('BUTTON_MISSING');const f=b.form;for(const [name,value] of Object.entries(${JSON.stringify(values)})){const e=f.elements[name];if(!e)throw Error('FIELD_MISSING:'+name);if(e.type==='checkbox'){e.checked=!!value;continue}const select=e instanceof HTMLSelectElement;Object.getOwnPropertyDescriptor(select?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,String(value));e.dispatchEvent(new Event(select?'change':'input',{bubbles:true}))}f.querySelectorAll('input[type=checkbox][required]').forEach(e=>e.checked=true);window.__payrollForm=f;return {ready:true}}catch(e){return {error:e.message,buttons:[...document.querySelectorAll('button')].map(e=>e.textContent.trim())}}})()`);
        if (!prepared.ready) { save('browser-control-failure', { action: buttonText, ...prepared }); throw Error('BROWSER_CONTROL_UNAVAILABLE'); }
        await session.evaluate('window.__payrollForm.requestSubmit();true');
        await until(`document.querySelector('main')?.innerText.includes(${JSON.stringify(success)})`, 'ACTION_RESULT_NOT_READY');
        network.push(...session.network().filter(item => item.method === 'POST'));
        save('server-action-requests', network);
      }
      async function compensation(f, frequency) {
        await goto('/dashboard/payroll?tab=configuration', 'Compensation');
        await submit('Save compensation profile', { employeeId: f.employee.id, compensationType: 'MONTHLY', baseRate: '35000', payFrequency: frequency, currency: 'PHP', effectiveFrom: '2026-01-01' }, 'Compensation record created.');
        ok(await tx.employeeCompensation.count({ where: { organizationId: f.org.id, employeeId: f.employee.id } }) === 1, `${frequency}: compensation saved through real Server Action`);
      }
      async function flow(f, name, start, end, withOpening, expected) {
        await goto('/dashboard/payroll?tab=processing', 'Create a Payroll Period');
        await submit('Create Payroll Period', { name, periodStart: start, periodEnd: end, payDate: end }, 'Payroll period created.');
        const period = await tx.payrollPeriod.findUniqueOrThrow({ where: { organizationId_name: { organizationId: f.org.id, name } } });
        await goto(`/dashboard/payroll?tab=processing&period=${period.id}`, 'Check Employee Readiness');
        await session.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__confirmCount=0;window.confirm=()=>{window.__confirmCount++;return true}' });
        await session.evaluate('window.__confirmCount=0;window.confirm=()=>{window.__confirmCount++;return true};true');
        const beforeGenerate = await tx.payrollEntry.count({ where: { payrollPeriodId: period.id } });
        await submit('Generate Payroll', { payrollPeriodId: period.id }, 'Setup required for 1 employee');
        ok(beforeGenerate === 0 && await tx.payrollEntry.count({ where: { payrollPeriodId: period.id } }) === 0, `${name}: missing setup produces visible SETUP_REQUIRED without an entry`);
        await submit('Save reviewed period inputs', { monthlySssRemuneration: '35000', monthlyPhilHealthBasic: '35000', monthlyPagIbigFundSalary: '35000', agencyBasisReference: 'Verified synthetic agency bases', 'coverage.SSS': 'MANDATORY', 'coverage.PHILHEALTH': 'MANDATORY', 'coverage.PAGIBIG': 'MANDATORY', 'treatment.late': 'NET_DEDUCTION', 'treatment.absence': 'NET_DEDUCTION', 'treatment.undertime': 'NET_DEDUCTION', unionDues: '0', unionReference: 'Verified none', evidenceReference: 'Synthetic full-month review' }, 'Reviewed period inputs saved.');
        if (withOpening) await submit('Save verified opening history', { openingPayDate: start, riceExemptUsedThisMonth: '0', laundryExemptUsedThisMonth: '0', clothingExemptUsedThisYear: '0', otherBenefitsGrossPaidYtd: '0', taxableCompensationYtd: '0', withholdingTaxYtd: '0', evidenceReference: 'Verified synthetic opening history' }, 'Verified opening history saved.');
        await submit('Generate Payroll', { payrollPeriodId: period.id }, '1 payroll entry generated.');
        await submit('Generate Payroll', { payrollPeriodId: period.id }, '0 payroll entries generated.');
        ok(await tx.payrollEntry.count({ where: { payrollPeriodId: period.id } }) === 1 && await tx.payrollContributionAllocation.count({ where: { posting: { entry: { payrollPeriodId: period.id } } } }) === 3, `${name}: duplicate generation keeps one entry and three allocations`);
        await submit('Move to Review', {}, 'Finalize Payroll');
        await until('[...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="Finalize Payroll"&&!e.disabled)', 'FINALIZE_NOT_READY');
        await submit('Finalize Payroll', { confirmation: true }, 'Payroll Period Finalized');
        const entry = await tx.payrollEntry.findFirstOrThrow({ where: { payrollPeriodId: period.id } });
        const s = entry.calculationSnapshot.statutory;
        ok(entry.grossAmount.toFixed(2) === expected.gross && entry.netAmount.toFixed(2) === expected.net && s.birWithholding === expected.tax && s.employeeStatutoryDeductions.SSS === expected.sss && s.employeeStatutoryDeductions.PHILHEALTH === expected.ph && s.employeeStatutoryDeductions.PAGIBIG === expected.pi, `${name}: exact stored gross, employee contributions, withholding and net`);
        const before = JSON.stringify(entry.calculationSnapshot);
        await screenshot(name.replaceAll(' ', '-').toLowerCase() + '-finalized');
        ok(!await session.evaluate('[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Finalize Payroll")'), `${name}: finalized payroll has no finalize control`);
        await tx.$executeRawUnsafe('SAVEPOINT immutable_payroll_probe');
        let rejected = false;
        try { await tx.payrollEntry.update({ where: { id: entry.id }, data: { netAmount: '1' } }); } catch { rejected = true; }
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT immutable_payroll_probe'); await tx.$executeRawUnsafe('RELEASE SAVEPOINT immutable_payroll_probe');
        ok(rejected && (await tx.payrollEntry.findUniqueOrThrow({ where: { id: entry.id } })).netAmount.eq(expected.net), `${name}: database rejects changing finalized pay`);
        await goto(`/dashboard/payroll/payslips/${entry.id}`, 'Official Finalized Payslip');
        ok(await session.evaluate(`document.body.innerText.includes('SSS employee share')&&document.body.innerText.includes('Employer-only EC')&&document.body.innerText.includes(${JSON.stringify(Number(expected.net).toLocaleString('en-PH', { minimumFractionDigits: 2 }))})`), `${name}: HR finalized payslip shows deductions, employer EC and correct net`);
        ok(JSON.stringify((await tx.payrollEntry.findUniqueOrThrow({ where: { id: entry.id } })).calculationSnapshot) === before, `${name}: finalized snapshot unchanged after payslip read`);
        return { entry, snapshot: before };
      }
      await login(monthly, 'HR_ADMIN'); await compensation(monthly, 'MONTHLY');
      const m = await flow(monthly, 'Monthly synthetic September', '2026-09-01', '2026-09-30', true, { gross: '35000.00', net: '30473.70', tax: '1701.30', sss: '1750.00', ph: '875.00', pi: '200.00' });
      await login(monthly, 'EMPLOYEE'); await goto('/employee/payroll/' + m.entry.id, 'Official Finalized Payslip');
      ok(await session.evaluate('document.body.innerText.includes("30,473.70")&&document.body.innerText.includes("1,701.30")'), 'Monthly ESS payslip matches HR finalized amounts');
      await screenshot('monthly-ess-payslip');
      await goto('/dashboard/payroll', ''); ok(!await session.evaluate('document.body.innerText.includes("Employee Payroll Entries")'), 'Employee cannot open HR Payroll workspace');
      await login(semi, 'HR_ADMIN'); await compensation(semi, 'SEMI_MONTHLY');
      // Create and fully configure SECOND before FIRST to reproduce B3-002 in the real UI.
      await goto('/dashboard/payroll?tab=processing', 'Create a Payroll Period');
      await submit('Create Payroll Period', { name: 'Second missing-first probe', periodStart: '2026-09-16', periodEnd: '2026-09-30', payDate: '2026-09-30' }, 'Payroll period created.');
      const secondProbe = await tx.payrollPeriod.findUniqueOrThrow({ where: { organizationId_name: { organizationId: semi.org.id, name: 'Second missing-first probe' } } });
      await goto(`/dashboard/payroll?tab=processing&period=${secondProbe.id}`, 'Check Employee Readiness');
      await session.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm=()=>true' }); await session.evaluate('window.confirm=()=>true;true');
      await submit('Save reviewed period inputs', { monthlySssRemuneration: '35000', monthlyPhilHealthBasic: '35000', monthlyPagIbigFundSalary: '35000', agencyBasisReference: 'Verified fictional basis', 'coverage.SSS': 'MANDATORY', 'coverage.PHILHEALTH': 'MANDATORY', 'coverage.PAGIBIG': 'MANDATORY', 'treatment.late': 'NET_DEDUCTION', 'treatment.absence': 'NET_DEDUCTION', 'treatment.undertime': 'NET_DEDUCTION', unionDues: '0', unionReference: 'Fictional none', evidenceReference: 'Fictional complete input' }, 'Reviewed period inputs saved.');
      await submit('Save verified opening history', { openingPayDate: '2026-09-01', riceExemptUsedThisMonth: '0', laundryExemptUsedThisMonth: '0', clothingExemptUsedThisYear: '0', otherBenefitsGrossPaidYtd: '0', taxableCompensationYtd: '0', withholdingTaxYtd: '0', evidenceReference: 'Complete fictional fixture history before first synthetic payment' }, 'Verified opening history saved.');
      await goto(`/dashboard/payroll?tab=processing&period=${secondProbe.id}`, 'First-cutoff contribution history is missing.');
      ok(await session.evaluate('document.querySelector("section[aria-labelledby=readiness-heading]").innerText.includes("Action required")'), 'Missing first cutoff shows Action required before generation');
      await screenshot('second-missing-first-readiness');
      await submit('Generate Payroll', { payrollPeriodId: secondProbe.id }, 'Setup required for 1 employee');
      ok(await tx.payrollEntry.count({ where: { payrollPeriodId: secondProbe.id } }) === 0, 'Missing first cutoff creates no payroll entry');
      const a = await flow(semi, 'First synthetic September', '2026-09-01', '2026-09-15', true, { gross: '17500.00', net: '15236.92', tax: '850.58', sss: '875.00', ph: '437.50', pi: '100.00' });
      await goto(`/dashboard/payroll?tab=processing&period=${secondProbe.id}`, 'Ready to calculate');
      await tx.$executeRawUnsafe('SAVEPOINT invalid_first_cutoff');
      const bad = await tx.payrollContributionAllocation.findFirstOrThrow({ where: { posting: { payrollEntryId: a.entry.id }, agency: 'SSS' } });
      await tx.payrollContributionAllocation.update({ where: { id: bad.id }, data: { allocation: { ...bad.allocation, employee: '1' } } });
      await goto(`/dashboard/payroll?tab=processing&period=${secondProbe.id}`, 'First-cutoff contribution history is invalid.');
      ok(await session.evaluate('document.querySelector("section[aria-labelledby=readiness-heading]").innerText.includes("Action required")'), 'Incorrect first-cutoff amount shows Action required before generation');
      await screenshot('second-invalid-first-readiness');
      await submit('Generate Payroll', { payrollPeriodId: secondProbe.id }, 'Setup required for 1 employee');
      ok(await tx.payrollEntry.count({ where: { payrollPeriodId: secondProbe.id } }) === 0, 'Incorrect first-cutoff record creates no second payroll entry');
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_first_cutoff'); await tx.$executeRawUnsafe('RELEASE SAVEPOINT invalid_first_cutoff');
      await goto(`/dashboard/payroll?tab=processing&period=${secondProbe.id}`, 'Ready to calculate');
      await submit('Generate Payroll', { payrollPeriodId: secondProbe.id }, '1 payroll entry generated.');
      await submit('Generate Payroll', { payrollPeriodId: secondProbe.id }, '0 payroll entries generated.');
      ok(await tx.payrollEntry.count({ where: { payrollPeriodId: secondProbe.id } }) === 1 && await tx.payrollContributionAllocation.count({ where: { posting: { entry: { payrollPeriodId: secondProbe.id } } } }) === 3, 'Second cutoff duplicate generation keeps one entry and three agency allocations');
      await submit('Move to Review', {}, 'Finalize Payroll'); await submit('Finalize Payroll', { confirmation: true }, 'Payroll Period Finalized');
      const secondEntry = await tx.payrollEntry.findFirstOrThrow({ where: { payrollPeriodId: secondProbe.id } });
      const b = { entry: secondEntry };
      ok(secondEntry.netAmount.eq('15236.92') && secondEntry.calculationSnapshot.statutory.birWithholding === '850.58', 'Second cutoff finalizes with independent expected net and withholding');
      ok(a.entry.calculationSnapshot.statutory.slot === 'FIRST' && b.entry.calculationSnapshot.statutory.slot === 'SECOND', 'Cutoff ledger reconciles FIRST then SECOND without duplicate monthly contributions');
      await login(semi, 'EMPLOYEE'); await goto('/employee/payroll/' + b.entry.id, 'Official Finalized Payslip');
      ok(await session.evaluate('document.body.innerText.includes("remaining monthly contribution")&&document.body.innerText.includes("15,236.92")'), 'Semi-monthly ESS shows second allocation and correct net');
      await screenshot('semi-second-ess-payslip');
      await goto('/employee/payroll/' + a.entry.id, 'Official Finalized Payslip');
      ok(await session.evaluate('document.body.innerText.includes("15,236.92")&&document.body.innerText.includes("850.58")'), 'Semi-monthly ESS first-cutoff payslip matches expected stored amounts');
      await screenshot('semi-first-ess-payslip');
      await session.send('Page.navigate', { url: `http://${semi.org.slug}.localhost:${port}/employee/payroll/${m.entry.id}` }); await pause(600);
      ok(!await session.evaluate('document.body.innerText.includes("30,473.70")'), 'Wrong-tenant payslip URL exposes no foreign pay');
      await login(monthly, 'HIRING_MANAGER'); await session.send('Page.navigate', { url: `http://${monthly.org.slug}.localhost:${port}/dashboard/payroll` }); await pause(600);
      ok(!await session.evaluate('document.body.innerText.includes("Employee Payroll Entries")'), 'Hiring Manager cannot access Payroll workspace');
      save('authenticated-e2e', { passed: true, checks: checks.length, realProductionBuild: true, realServerActions: true, normalPasswordLogin: true, fixtureTransactions: 'outer rollback; application transactions serialized savepoints', independentConnectionConcurrency: 'covered by separate integration suite', monthly: m.entry.calculationSnapshot.statutory, first: a.entry.calculationSnapshot.statutory, second: b.entry.calculationSnapshot.statutory });
      await session.close(); session = null; await new Promise(resolve => server.close(resolve)); server = null; await app.close(); app = null;
      throw rollback;
    }, { timeout: 900_000, maxWait: 10_000 });
  } catch (error) { if (error !== rollback) { save('e2e-failure', { code: error.code || error.name, message: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'E2E_FAILED', last: checks.at(-1) }); throw error; } }
  finally {
    await session?.close(); if (server) await new Promise(resolve => server.close(resolve)); await app?.close(); delete globalThis.prisma;
    const after = await helper.fingerprints(db, before.columns);
    const unchanged = JSON.stringify(before.tables) === JSON.stringify(after.tables);
    save('e2e-preservation', { existingDataUnchanged: unchanged, tablesCompared: before.tables.length, fixtureOrganizationsRemaining: await db.organization.count({ where: { slug: { startsWith: slug } } }) });
    await db.$disconnect(); helper.assertOriginalUnchanged(config); if (!unchanged) throw Error('EXISTING_DATA_CHANGED');
  }
}
main().catch(error => { console.error(error.code || error.name, /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'E2E_FAILED'); process.exitCode = 1; });
