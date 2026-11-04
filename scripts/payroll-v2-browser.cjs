/* eslint-disable @typescript-eslint/no-require-imports -- Real browser, Server Actions and isolated synthetic database. */
const fs = require('node:fs');
const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const { hash } = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { organization, employee, period, setup } = require('./test-payroll-integration.ts');
const browser = require('./batch0-recovery-browser.cjs');
const port = 3139, directory = 'docs/payroll-v2';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
const db = new PrismaClient({ log: [] });
let session, app, server;
function check(value, label) { if (!value) throw Error(label); checks.push(label); console.log('BROWSER PASS', label); }
async function until(work, label) {
  for (let i = 0; i < 180; i++) { if (await work()) return; await pause(250); }
  if (session) fs.writeFileSync(`${directory}/browser-failure.json`, JSON.stringify({ label, page: await session.evaluate('({path:location.pathname,text:document.querySelector("main")?.innerText.slice(-5000)})') }, null, 2));
  throw Error(label);
}
async function main() {
  fs.mkdirSync(directory, { recursive: true });
  const [identity] = await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch`;
  if (identity.branch !== 'br-green-king-azcpyvmo') throw Error('WRONG_TEST_BRANCH');
  const scope = await organization(db), person = await employee(db, scope);
  const org = await db.organization.findUniqueOrThrow({ where: { id: scope.organizationId } });
  await db.organizationBranding.create({ data: { organizationId: org.id, displayName: org.name, primaryColor: '#282934', accentColor: '#167D77' } });
  const password = randomBytes(24).toString('hex'), passwordHash = await hash(password, 10);
  const hr = await db.user.update({ where: { id: scope.actorUserId }, data: { passwordHash } });
  const user = await db.user.create({ data: { organizationId: org.id, name: 'Synthetic payroll employee', role: 'EMPLOYEE', passwordHash, email: `browser-${person.id}@example.test` } });
  await db.employeeAccount.create({ data: { organizationId: org.id, employeeId: person.id, userId: user.id, status: 'ACTIVE', activatedAt: new Date(), createdById: hr.id } });
  const outsider = await organization(db), otherPerson = await employee(db, outsider);
  const otherPeriod = await period(db, outsider);
  await setup(db, outsider, otherPerson, otherPeriod.id);
  const { generatePayroll } = require('../src/features/payroll/service.ts');
  const { movePayrollPeriodToReview, finalizePayrollPeriod } = require('../src/features/payroll/review.ts');
  await generatePayroll({ ...outsider, payrollPeriodId: otherPeriod.id }, db);
  await movePayrollPeriodToReview({ ...outsider, payrollPeriodId: otherPeriod.id }, db);
  await finalizePayrollPeriod({ ...outsider, payrollPeriodId: otherPeriod.id, confirmation: 'FINALIZE' }, db);
  const foreignEntry = await db.payrollEntry.findFirstOrThrow({ where: { payrollPeriodId: otherPeriod.id } });
  const otherUser = await db.user.create({ data: { organizationId: org.id, name: 'Other employee', role: 'EMPLOYEE', passwordHash, email: `other-browser-${person.id}@example.test` } });
  // A separate same-tenant employee is used to verify ownership, in addition to wrong-tenant URL checks.
  const ownOtherPerson = await employee(db, scope);
  await db.employee.update({ where: { id: ownOtherPerson.id }, data: { employeeStatus: 'INACTIVE' } });
  await db.employeeAccount.create({ data: { organizationId: org.id, employeeId: ownOtherPerson.id, userId: otherUser.id, status: 'ACTIVE', activatedAt: new Date(), createdById: hr.id } });
  Object.assign(process.env, { PLATFORM_ROOT_DOMAIN: `localhost:${port}`, PLATFORM_PUBLIC_ORIGIN: `http://localhost:${port}` });
  app = require('next')({ dev: false, hostname: '127.0.0.1', port }); await app.prepare();
  const handle = app.getRequestHandler(); server = createServer((req, res) => handle(req, res));
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  const origin = `http://${org.slug}.localhost:${port}`;
  async function login(actor, isEmployee = false, host = org.slug + '.localhost') {
    await session?.close();
    session = await browser({ port, production: true, email: actor.email, password, employeeLogin: isEmployee, tenantHost: host });
    await session.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm=()=>true;window.__payrollErrors=[];addEventListener("error",e=>window.__payrollErrors.push(e.message));' });
    await session.evaluate('window.confirm=()=>true;window.__payrollErrors=[];true');
  }
  async function goto(route, marker) {
    await session.send('Page.navigate', { url: origin + route });
    await until(() => session.evaluate(`document.readyState==='complete' && document.querySelector('main')?.innerText.toLowerCase().includes(${JSON.stringify(marker.toLowerCase())}) && !document.querySelector('main [data-wp-loading]')`), 'PAGE_NOT_READY_' + marker);
    await pause(350);
  }
  async function submit(text, values) {
    const result = await session.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.form&&e.textContent.trim()===${JSON.stringify(text)});if(!b)return 'BUTTON_MISSING';for(let d=b.closest('details');d;d=d.parentElement?.closest('details'))d.open=true;const f=b.form;for(const [name,value] of Object.entries(${JSON.stringify(values)})){const e=f.elements[name];if(!e)return 'FIELD_MISSING_'+name;if(e.type==='checkbox'){e.checked=!!value;continue}Object.getOwnPropertyDescriptor(e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,String(value));e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}))}f.querySelectorAll('input[type=checkbox][required]').forEach(e=>e.checked=true);if(!f.checkValidity())return 'INVALID_FORM';window.__submittedButton=b;f.requestSubmit(b);return 'SUBMITTED'})()`);
    check(result === 'SUBMITTED', `${text}: actual form submitted (${result})`);
    await pause(350);
    await until(() => session.evaluate('(()=>{const b=window.__submittedButton;if(!b?.isConnected)return true;return b.form?.hasAttribute("aria-busy") ? b.form.getAttribute("aria-busy")!=="true" : !b.disabled})()'), 'ACTION_NOT_SETTLED_' + text);
    await pause(800);
  }
  await login(hr); await goto('/dashboard/payroll', '1. Select Payroll Period');
  check(await session.evaluate('document.body.innerText.includes("4. Notify Employees")'), 'HR sees the four-step workflow');
  await submit('Create Payroll Period', { name: 'V2 Browser September 2026', periodStart: '2026-09-01', periodEnd: '2026-09-30', payDate: '2026-09-30' });
  let p;
  await until(async () => { p = await db.payrollPeriod.findFirst({ where: { organizationId: org.id } }); return !!p; }, 'PERIOD_NOT_CREATED');
  await setup(db, scope, person, p.id);
  await goto('/dashboard/payroll?period=' + p.id, 'Manage Earnings');
  await submit('Add Earnings', { category: 'BONUS', description: 'Browser approved taxable bonus', amount: '2000', supportingReference: 'BROWSER-BONUS-001', kind: 'TAXABLE_BONUS', qualificationReference: 'Verified taxable bonus approval', monthlySssRemuneration: '37000', monthlyPagIbigFundSalary: '37000', agencyBasisReference: 'Reviewed synthetic monthly bases', reason: 'Approved project completion' });
  await until(async () => (await db.payrollStatutoryInput.findFirstOrThrow({ where: { payrollPeriodId: p.id } })).payload.additionalEarnings.length === 1, 'EARNING_NOT_SAVED');
  check(true, 'Custom earning saved through authenticated Server Action');
  await goto('/dashboard/payroll?period=' + p.id, 'Manage Earnings');
  await submit('Generate Payroll', { payrollPeriodId: p.id });
  await until(async () => await db.payrollEntry.count({ where: { payrollPeriodId: p.id } }) === 1, 'GENERATION_FAILED');
  await goto('/dashboard/payroll?period=' + p.id, '32,173.70');
  await submit('Move to Review', {});
  await until(async () => (await db.payrollPeriod.findUniqueOrThrow({ where: { id: p.id } })).status === 'REVIEW', 'REVIEW_FAILED');
  await goto('/dashboard/payroll?period=' + p.id, 'Finalize Payroll');
  await submit('Finalize Payroll', { confirmation: true });
  await until(async () => (await db.payrollPeriod.findUniqueOrThrow({ where: { id: p.id } })).status === 'FINALIZED', 'FINALIZATION_FAILED');
  await goto('/dashboard/payroll?period=' + p.id, 'Review notification recipients');
  check(await session.evaluate('!document.querySelector("button[value=SAVE]")'), 'Finalized earnings have no edit controls');
  await submit('Notify Employees', { confirmation: true });
  await until(async () => await db.payrollNotification.count({ where: { organizationId: org.id } }) === 1, 'NOTIFICATION_FAILED');
  const { previewPayrollNotifications, notifyPayrollEmployees } = require('../src/features/payroll/notifications.ts');
  const preview = await previewPayrollNotifications({ ...scope, payrollPeriodId: p.id }, db);
  const retry = { ...scope, payrollPeriodId: p.id, recipientToken: preview.token, confirmation: 'NOTIFY' };
  const concurrent = await Promise.all([notifyPayrollEmployees(retry, db), notifyPayrollEmployees(retry, db)]);
  check(concurrent.every(result => result.created === 0) && await db.payrollNotification.count({ where: { organizationId: org.id } }) === 1, 'Concurrent notification retries cannot duplicate delivery');
  const entry = await db.payrollEntry.findFirstOrThrow({ where: { payrollPeriodId: p.id } });
  const original = JSON.stringify(entry.calculationSnapshot);
  check(entry.netAmount.toFixed(2) === '32173.70', 'Browser-generated net equals independently expected 32173.70');
  await session.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const hrShot = await session.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${directory}/hr-mobile.png`, Buffer.from(hrShot.data, 'base64'));
  check(await session.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'HR mobile page fits viewport with scrollable payroll table');
  await login(user, true); await goto('/employee/payroll', 'Latest finalized net pay');
  check(await session.evaluate('document.body.innerText.includes("Your payslip for V2 Browser September 2026 is now available")'), 'ESS displays persisted notification with no email dependency');
  await goto('/employee/payroll/' + entry.id, 'Official Finalized Payslip');
  check(await session.evaluate('document.body.innerText.includes("Browser approved taxable bonus") && document.body.innerText.includes("32,173.70")'), 'ESS displays recorded custom earning description and the same finalized net');
  check(await session.evaluate('[...document.querySelectorAll("button")].some(b=>/Print/i.test(b.textContent))'), 'Finalized payslip has print action');
  const printable = await session.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(`${directory}/payslip-print.pdf`, Buffer.from(printable.data, 'base64'));
  check(Buffer.from(printable.data, 'base64').subarray(0, 4).toString() === '%PDF', 'Finalized payslip produces a printable PDF');
  await session.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const essShot = await session.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${directory}/ess-mobile.png`, Buffer.from(essShot.data, 'base64'));
  check(await session.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'ESS payslip fits mobile viewport');
  // Verify a wrong record URL does not render payroll details.
  await session.send('Page.navigate', { url: origin + '/employee/payroll/' + foreignEntry.id });
  await until(() => session.evaluate('document.readyState==="complete" && !document.querySelector("main [data-wp-loading]")'), 'DENIED_PAGE_NOT_READY');
  check(!await session.evaluate('document.body.innerText.includes("30,473.70")'), 'Real foreign-tenant payslip URL exposes no payroll data');
  await db.employee.update({ where: { id: ownOtherPerson.id }, data: { employeeStatus: 'ACTIVE' } });
  await login(otherUser, true);
  await session.send('Page.navigate', { url: origin + '/employee/payroll/' + entry.id });
  await until(() => session.evaluate('document.readyState==="complete" && !document.querySelector("main [data-wp-loading]")'), 'OWNERSHIP_DENIED_PAGE_NOT_READY');
  check(!await session.evaluate('document.body.innerText.includes("32,173.70")'), 'Same-tenant employee cannot view another employee’s finalized payslip');
  check(JSON.stringify((await db.payrollEntry.findUniqueOrThrow({ where: { id: entry.id } })).calculationSnapshot) === original, 'Browser view and notification retries preserve finalized snapshot');
  fs.writeFileSync(`${directory}/browser.json`, JSON.stringify({ passed: true, checks, branch: identity.branch, productionBuild: true, realServerActions: true, emailSent: false, syntheticFixtureRetainedForReview: { organizationId: org.id, payrollPeriodId: p.id, entryId: entry.id } }, null, 2));
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; }).finally(async () => { await session?.close(); if (server) await new Promise(resolve => server.close(resolve)); await app?.close(); await db.$disconnect(); });
