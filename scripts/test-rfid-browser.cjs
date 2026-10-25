/* eslint-disable @typescript-eslint/no-require-imports -- Browser smoke test in the runner-owned disposable schema only. */
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { createServer, request } = require('node:http');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const browser = require('./batch0-recovery-browser.cjs');
assert.match(new URL(process.env.DATABASE_URL).searchParams.get('schema') || '', /^batch3_test_[a-f0-9]{24}$/);
const db = new PrismaClient({ log: [] });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const port = 3136;
const checks = [];
function ok(value, message) { assert.ok(value, message); checks.push(message); console.log(`RFID PASS ${checks.length}: ${message}`); }

async function main() {
  let app, server, session;
  const email = randomUUID() + '@fixture.invalid', password = randomBytes(24).toString('hex');
  const organization = await db.organization.create({ data: { name: 'RFID browser workspace', slug: 'st-aloysius', timeZone: 'Asia/Manila' } });
  await db.organization.create({ data: { name: 'Foreign browser workspace', slug: 'rfid-other', timeZone: 'UTC' } });
  const actor = await db.user.create({ data: { organizationId: organization.id, name: 'Synthetic browser HR', email, passwordHash: await hash(password, 12), role: 'HR_ADMIN' } });
  const job = await db.job.create({ data: { organizationId: organization.id, title: 'Synthetic', slug: 'rfid-browser', department: 'Fixture', employmentType: 'Full-time', location: 'Fixture', description: 'Fixture', responsibilities: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture' } });
  const applicant = await db.applicant.create({ data: { firstName: 'Synthetic', lastName: 'Scanner', email: randomUUID() + '@fixture.invalid', phone: '0' } });
  const application = await db.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'Synthetic RFID browser fixture' } });
  const employee = await db.employee.create({ data: { organizationId: organization.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: 'SCANNER-001', firstName: applicant.firstName, lastName: applicant.lastName, email: applicant.email, phone: '0', createdById: actor.id } });
  await db.employmentRecord.create({ data: { employeeId: employee.id, jobId: job.id, jobTitle: job.title, department: 'Fixture', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: new Date('2020-01-01Z'), startDate: new Date('2020-01-01Z'), salary: 1, payFrequency: 'MONTHLY', employmentStatus: 'REGULAR', effectiveFrom: new Date('2020-01-01Z'), createdById: actor.id } });
  try {
    app = require('next')({ dev: true, hostname: 'localhost', port });
    await app.prepare();
    server = createServer(app.getRequestHandler());
    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    session = await browser({ port, production: false, email, password });
    const { evaluate, send } = session;
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__rfidErrors=[];window.addEventListener('error',e=>window.__rfidErrors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__rfidErrors.push(String(e.reason)));const oldError=console.error;console.error=(...args)=>{window.__rfidErrors.push(args.map(String).join(' '));oldError(...args)};` });
    async function until(expression) {
      for (let i = 0; i < 600; i++) { if (await evaluate(expression)) return; await pause(100); }
      throw Error('RFID_BROWSER_WAIT: ' + expression);
    }
    async function go(url, expression) { await send('Page.navigate', { url }); await until(`document.readyState==='complete' && (${expression})`); await pause(600); }
    async function set(selector, value) {
      await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
      await pause(100);
    }
    const origin = `http://saga.localhost:${port}`;
    await go(origin + '/dashboard/attendance/rfid', `document.querySelector('h1')?.textContent.includes('RFID Cards')`);
    async function selectEmployee() {
      await set('main form input:not([type=password])', 'Synthetic Scanner');
      await evaluate(`document.querySelector('main form').requestSubmit();true`);
      await until(`[...document.querySelectorAll('main li button')].some(button=>button.textContent.includes('Synthetic Scanner'))`);
      await evaluate(`[...document.querySelectorAll('main li button')].find(button=>button.textContent.includes('Synthetic Scanner')).click();true`);
      await until(`document.activeElement===document.querySelector('main input[type=password]')`);
    }
    async function assign(card) {
      await selectEmployee();
      await set('main input[type=password]', card);
      await evaluate(`document.querySelector('main input[type=password]').form.requestSubmit();true`);
      await until(`document.querySelector('main [role=status]')?.textContent.includes('Card assigned successfully')`);
    }
    await assign('0000000011');
    ok(await db.rfidCard.count({ where: { organizationId: organization.id, employeeId: employee.id, deactivatedAt: null } }) === 1, 'real HR search and scanned-card enrollment succeed');
    await assign('0000000012');
    ok(await db.rfidCard.count({ where: { organizationId: organization.id, deactivatedAt: { not: null } } }) === 1, 'real replacement UI deactivates the old card');
    await selectEmployee();
    await evaluate(`[...document.querySelectorAll('main button')].find(button=>button.textContent==='Deactivate Current Card').click();true`);
    await until(`document.querySelector('main [role=status]')?.textContent.includes('Card deactivated')`);
    await assign('0000000013');
    ok(await db.rfidCard.count({ where: { organizationId: organization.id, deactivatedAt: { not: null } } }) === 2, 'real HR deactivation and fresh enrollment succeed');
    await evaluate(`[...document.querySelectorAll('main button')].find(button=>button.textContent.includes('Authorize & Open Kiosk')).click();true`);
    await until(`location.pathname==='/attendance-kiosk' && document.querySelector('#scan-heading')?.textContent==='Scan your card'`);
    const cookieList = (await send('Network.getAllCookies')).cookies;
    const kioskCookie = cookieList.find(cookie => cookie.name === 'workpulse_rfid_kiosk');
    ok(kioskCookie?.httpOnly && kioskCookie.sameSite === 'Strict' && !cookieList.some(cookie => cookie.name === 'workpulse_session'), 'kiosk authorization issues an HttpOnly cookie and removes HR authentication');
    async function scan(card, enter, expected) {
      // Automatic focus is set by the mounted React effect, so wait for hydration
      // before sending scanner keystrokes to the controlled input.
      await until(`document.readyState==='complete' && !!document.querySelector('main input:not(:disabled)') && document.activeElement===document.querySelector('main input')`);
      await send('Input.insertText', { text: card });
      if (enter) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      }
      await until(`document.querySelector('main [role=status]')?.textContent.includes(${JSON.stringify(expected)})`);
      await until(`document.activeElement===document.querySelector('main input') && !document.activeElement.disabled`);
    }
    await until(`document.readyState==='complete' && document.activeElement===document.querySelector('main input')`);
    await evaluate(`(()=>{const original=window.fetch.bind(window);window.__rfidRequestIds=[];window.__rfidLostConfirmation=true;window.fetch=async(resource,options)=>{if(String(resource).endsWith('/rfid/scan')){window.__rfidRequestIds.push(JSON.parse(options.body).requestId);const response=await original(resource,options);if(window.__rfidLostConfirmation&&response.ok){window.__rfidLostConfirmation=false;await response.clone().json();await new Promise(resolve=>setTimeout(resolve,21_000));window.__rfidSignalAborted=options.signal.aborted;if(options.signal.aborted)throw options.signal.reason;throw new TypeError('Simulated lost RFID confirmation');}return response;}return original(resource,options);};return true})()`);
    await send('Input.insertText', { text: '0000000013' });
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await until(`document.querySelector('main [role=status]')?.textContent.includes('Could not confirm this scan')`);
    ok(await db.attendanceEvent.count({ where: { organizationId: organization.id, employeeId: employee.id, source: 'RFID' } }) === 1, 'attendance commits even when the successful HTTP confirmation is lost');
    ok(await evaluate(`window.__rfidSignalAborted===false`), 'request remains valid beyond the former 20-second client deadline');
    await evaluate(`[...document.querySelectorAll('main button')].find(button=>button.textContent==='Retry Same Scan').click();true`);
    await until(`document.querySelector('main [role=status]')?.textContent.includes('Attendance recorded.')`);
    await until(`document.activeElement===document.querySelector('main input')`);
    ok(await evaluate(`window.__rfidRequestIds.length===2 && window.__rfidRequestIds[0]===window.__rfidRequestIds[1]`), 'Retry Same Scan resubmits the original UUID after a committed scan');
    ok(await evaluate(`document.querySelector('[role=status]').textContent.includes('Synthetic Scanner') && !!document.querySelector('time[datetime]')`), 'keyboard scanner with Enter records attendance and displays employee and exact time');
    await scan('0000000013', false, 'Already recorded.');
    ok(true, 'reader without Enter suffix submits automatically and rapid duplicate does not toggle');
    await scan('9999999999', true, 'Card not registered');
    await scan('0000000011', true, 'This card is inactive');
    ok(true, 'unknown and inactive card feedback restores scanner focus');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    ok(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`), 'kiosk fits a mobile viewport without horizontal overflow');
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await send('Input.insertText', { text: '0000000013' });
    await until(`document.querySelector('[role=status]')?.textContent.includes('Could not confirm this scan')`);
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await evaluate(`[...document.querySelectorAll('main button')].find(button=>button.textContent==='Retry Same Scan').click();true`);
    await until(`/Already recorded\.|Attendance recorded\.|already recorded for today/.test(document.querySelector('[role=status]')?.textContent||'')`);
    ok(await evaluate(`window.__rfidRequestIds.at(-1)===window.__rfidRequestIds.at(-2)`) && await db.attendanceEvent.count({ where: { organizationId: organization.id, employeeId: employee.id } }) <= 2, 'network retry keeps the same UUID and at most the intended daily pair');
    async function probe(host, originHeader, withCookie) {
      return new Promise((resolve, reject) => {
        const req = request({ hostname: '127.0.0.1', port, path: '/api/attendance/rfid/scan', method: 'POST', headers: { host, Origin: originHeader, 'Content-Type': 'application/json', ...(withCookie ? { Cookie: kioskCookie.name + '=' + kioskCookie.value } : {}) } }, response => {
          let body = ''; response.on('data', chunk => body += chunk); response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
        });
        req.on('error', reject); req.end(JSON.stringify({ cardNumber: '0000000013', requestId: randomUUID() }));
      });
    }
    ok((await probe(`saga.localhost:${port}`, 'https://foreign.invalid', true)).body.code === 'INVALID_ORIGIN', 'cross-origin API writes are rejected');
    ok((await probe(`saga.localhost:${port}`, origin, false)).status === 401, 'API rejects scans without a kiosk session');
    ok((await probe(`rfid-other.localhost:${port}`, `http://rfid-other.localhost:${port}`, true)).status === 401, 'copied kiosk token is refused on another tenant host');
    const errors = await evaluate(`window.__rfidErrors.filter(message=>!/Failed to fetch|ERR_INTERNET_DISCONNECTED/.test(message))`);
    ok(errors.length === 0, 'kiosk has no hydration errors or unexpected browser exceptions');
    await evaluate(`[...document.querySelectorAll('main button')].find(button=>button.textContent==='Lock Kiosk').click();true`);
    await until(`document.querySelector('#scan-heading')?.textContent==='Kiosk locked'`);
    ok((await probe(`saga.localhost:${port}`, origin, true)).status === 401, 'locked kiosk token is revoked server-side');

    // Exercise the Vercel single-host /saga rewrite with normal HR login.
    await send('Network.clearBrowserCookies');
    await go(`http://localhost:${port}/saga/login`, `!!document.querySelector('input[name=password]')`);
    await set('input[name=email]', email); await set('input[name=password]', password);
    await evaluate(`document.querySelector('input[name=password]').form.requestSubmit();true`);
    await until(`location.pathname==='/saga/dashboard' && !!document.querySelector('aside')`);
    const recorded = await db.attendanceEvent.findFirstOrThrow({ where: { organizationId: organization.id, employeeId: employee.id, source: 'RFID' }, orderBy: { occurredAt: 'asc' } });
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(recorded.occurredAt).map(part => [part.type, part.value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`, month = day.slice(0, 7);
    const displayedTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(recorded.occurredAt);
    await go(`http://localhost:${port}/saga/dashboard/attendance?employeeId=${employee.id}&month=${month}&day=${day}`, `!!document.querySelector('#day-details')`);
    ok(await evaluate(`document.querySelector('#day-details').textContent.includes(${JSON.stringify(displayedTime)}) && /rfid/i.test(document.querySelector('#day-details').textContent)`), 'committed scan appears in HR Employee Attendance with its Asia/Manila time and RFID source');
    await go(`http://localhost:${port}/saga/dashboard/attendance/rfid`, `document.querySelector('h1')?.textContent.includes('RFID Cards')`);
    ok(await evaluate(`[...document.querySelectorAll('main section li')].some(item=>item.textContent.includes('RECORDED')&&item.textContent.includes('Synthetic Scanner'))`), 'successful scan is intentionally included in Recent RFID Activity');
    await evaluate(`[...document.querySelectorAll('main button')].find(button=>button.textContent.includes('Authorize & Open Kiosk')).click();true`);
    await until(`location.pathname==='/saga/attendance-kiosk' && document.querySelector('#scan-heading')?.textContent==='Scan your card'`);
    await scan('9999999999', true, 'Card not registered');
    ok(true, 'Vercel /saga HR authorization, kiosk page, and prefixed scan API work');
    await evaluate(`[...document.querySelectorAll('main button')].find(button=>button.textContent==='Lock Kiosk').click();true`);
    await until(`document.querySelector('#scan-heading')?.textContent==='Kiosk locked'`);
    const employeeEmail = randomUUID() + '@fixture.invalid';
    const employeeUser = await db.user.create({ data: { organizationId: organization.id, name: 'Synthetic Scanner', email: employeeEmail, passwordHash: await hash(password, 12), role: 'EMPLOYEE' } });
    await db.employeeAccount.create({ data: { organizationId: organization.id, userId: employeeUser.id, employeeId: employee.id, status: 'ACTIVE', activatedAt: new Date(), createdById: actor.id } });
    await send('Network.clearBrowserCookies');
    await go(`http://localhost:${port}/saga/login`, `!!document.querySelector('input[name=password]')`);
    await set('input[name=email]', employeeEmail); await set('input[name=password]', password);
    await evaluate(`document.querySelector('input[name=password]').form.requestSubmit();true`);
    await until(`location.pathname==='/saga/employee'`);
    await go(`http://localhost:${port}/saga/employee/attendance?month=${month}`, `document.querySelector('h1')?.textContent==='My Attendance'`);
    const employeeDisplayedTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(recorded.occurredAt);
    ok(await evaluate(`document.querySelector('main').textContent.includes('Synthetic Scanner') && document.querySelector('tbody').textContent.includes(${JSON.stringify(employeeDisplayedTime)})`), 'committed scan appears in employee self-service Attendance with the same Asia/Manila time');
    require('node:fs').mkdirSync('docs/rfid/verification', { recursive: true });
    require('node:fs').writeFileSync('docs/rfid/verification/scan-confirmation-event.json', JSON.stringify({ eventId: recorded.id, employeeId: employee.id, employeeName: 'Synthetic Scanner', source: recorded.source, sourceReference: recorded.sourceReference, direction: recorded.direction, occurredAt: recorded.occurredAt.toISOString(), timeZone: 'Asia/Manila', attendanceDate: day, displayedTime, committedBeforeLostResponse: true, sameRequestIdRetried: true, hrAttendanceVisible: true, recentRfidActivityVisible: true, employeeAttendanceVisible: true, databaseScope: 'New disposable development schema; no existing records changed' }, null, 2) + '\n');
    console.log(`RFID browser tests passed: ${checks.length} assertions.`);
  } finally {
    await session?.close();
    server?.closeAllConnections();
    if (server) await new Promise(resolve => server.close(resolve));
    await app?.close();
    await db.$disconnect();
  }
}
main().then(() => process.exit(0)).catch(error => { console.error('RFID BROWSER FAILURE', error.code || error.message); process.exit(1); });
