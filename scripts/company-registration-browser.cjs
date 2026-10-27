/* eslint-disable @typescript-eslint/no-require-imports -- Real browser/SMTP checks on verified disposable recovery only. */
const fs = require('node:fs'), path = require('node:path'), net = require('node:net'), Module = require('node:module');
const { createServer, request: rawRequest } = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
const { hash } = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration(), port = 3127, directory = 'docs/company-registration-otp';
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json', 'utf8'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY_TARGET');
Object.assign(process.env, config.environment, { NODE_ENV: 'production', DATABASE_URL: config.pooled.href, H10_TEST_DATABASE_URL: config.direct.href, PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port });
const publicDb = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
let db;
fs.mkdirSync(directory, { recursive: true });
const save = (name, value) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = value => createHash('sha256').update(value).digest('hex');
const checks = [], messages = [];
const prefix = 'selfserve-browser-' + randomBytes(6).toString('hex');
const smtp = net.createServer(socket => {
  socket.setEncoding('utf8'); socket.write('220 localhost fixture\r\n');
  let buffer = '', data = false, content = '';
  socket.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\r\n')) {
      const index = buffer.indexOf('\r\n'), line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
      if (data) { if (line === '.') { messages.push(content.replace(/=\r\n/g, '').replace(/=3D/gi, '=')); data = false; content = ''; socket.write('250 queued\r\n'); } else content += line + '\r\n'; continue; }
      if (/^(EHLO|HELO)/i.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
      else if (/^AUTH PLAIN/i.test(line)) socket.write('235 authenticated\r\n');
      else if (/^RCPT TO:/i.test(line)) socket.write(/@fixture\.invalid>/i.test(line) ? '250 accepted\r\n' : '550 synthetic recipients only\r\n');
      else if (/^DATA$/i.test(line)) { data = true; socket.write('354 end with dot\r\n'); }
      else if (/^QUIT$/i.test(line)) socket.end('221 bye\r\n');
      else socket.write('250 ok\r\n');
    }
  });
});
function check(value, label) { if (!value) throw Error(label); checks.push(label); save('browser-checks', checks); console.log('PASS:', label); }
function probe(host, route, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = rawRequest({ hostname: '127.0.0.1', port, path: route, headers: { host, ...headers } }, res => {
      res.resume(); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    }); req.on('error', reject); req.end();
  });
}
async function main() {
  let app, server, chrome, ws, stage, inspect;
  const before = await helper.fingerprints(publicDb);
  const schema = 'registration_browser_' + randomBytes(12).toString('hex');
  if (!/^registration_browser_[a-f0-9]{24}$/.test(schema)) throw Error('INVALID_TEST_SCHEMA');
  const testUrl = new URL(config.direct);
  testUrl.searchParams.set('schema',schema);
  testUrl.searchParams.set('options','-c search_path=' + schema + ',public');
  await publicDb.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  db = new PrismaClient({datasources:{db:{url:testUrl.href}},log:[]});
  const email = prefix + '@fixture.invalid', adminEmail = prefix + '-operator@fixture.invalid', raceEmail = prefix + '-race@fixture.invalid';
  const password = randomBytes(24).toString('hex');
  try {
    const setup = spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:{...process.env,DATABASE_URL:testUrl.href,H10_TEST_DATABASE_URL:testUrl.href},windowsHide:true,encoding:'utf8'});
    if(setup.status !== 0) throw Error('BROWSER_SCHEMA_SETUP_FAILED');
    Object.assign(process.env,{DATABASE_URL:testUrl.href,H10_TEST_DATABASE_URL:testUrl.href});
    await db.organization.create({data:{name:'St. Aloysius synthetic browser fixture',slug:'st-aloysius',timeZone:'Asia/Manila'}});
    await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
    Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.address().port), SMTP_SECURE: 'false', SMTP_USER: 'fixture@fixture.invalid', SMTP_PASSWORD: randomBytes(24).toString('hex'), EMAIL_FROM: 'fixture@fixture.invalid' });
    const operator = await db.platformAdministrator.create({ data: { email: adminEmail, name: 'Synthetic browser operator', passwordHash: await hash(password, 12) } });
    const operatorToken = randomBytes(32).toString('hex');
    await db.platformAdministratorSession.create({ data: { administratorId: operator.id, tokenHash: digest(operatorToken), expiresAt: new Date(Date.now() + 600000) } });
    app = require('next')({ dev: false, hostname: 'localhost', port }); await app.prepare();
    server = createServer(app.getRequestHandler()); await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=9237', '--user-data-dir=' + path.resolve('.next/company-registration-browser-profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let page;
    for (let i = 0; i < 100; i++) { try { page = (await (await fetch('http://127.0.0.1:9237/json')).json()).find(p => p.type === 'page'); if (page) break; } catch {} await pause(100); }
    if (!page) throw Error('BROWSER_UNAVAILABLE');
    ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let sequence = 0; const pending = new Map();
    ws.onmessage = ({ data }) => { const message = JSON.parse(data); if (message.id) { const item = pending.get(message.id); if (item) { pending.delete(message.id); if (message.error) item.reject(Error('CDP_ERROR')); else item.resolve(message.result); } } };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error('BROWSER_EVALUATION'); return result.result.value; }
    inspect = () => evaluate('({host:location.host,path:location.pathname,heading:document.querySelector("h1")?.textContent,alert:document.querySelector("[role=alert]")?.textContent})');
    async function until(expression) { for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await pause(100); } throw Error('BROWSER_WAIT'); }
    async function go(url, expression) { stage = { action: 'navigate', host: new URL(url).host, path: new URL(url).pathname }; await send('Page.navigate', { url }); await pause(150); await until("document.readyState==='complete' && (" + expression + ')'); await pause(250); }
    async function submit(values, outcome) {
      stage = { action: 'submit', path: await evaluate('location.pathname') };
      await evaluate(`(()=>{const f=document.querySelector('main form');for(const [key,value] of Object.entries(${JSON.stringify(values)})){const el=f.elements[key];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}f.requestSubmit();return true})()`);
      await until(outcome);
    }
    const root = `http://localhost:${port}`;
    await send('Page.enable'); await send('Network.enable'); await send('Network.clearBrowserCookies');
    await go(root, "!!document.querySelector('a[href=\"/register\"]')");
    check(true, 'Public website exposes company registration');
    await go(root + '/register', "!!document.querySelector('input[name=companyName]')");
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Registration fits a mobile viewport');
    await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Show password').click()");
    check(await evaluate("document.querySelector('input[name=password]').type==='text'"), 'Registration password visibility can be toggled');
    await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Hide password').click()");
    await send('Emulation.clearDeviceMetricsOverride');
    await submit({ companyName: prefix, administratorName: 'Browser Company HR', email, password }, "location.pathname==='/register/verify' && document.querySelectorAll('input[inputmode=numeric]').length===6");
    check(messages.length === 1 && !await db.user.findUnique({ where: { email } }), 'Real registration action sends loopback SMTP verification without creating a user');
    const registrationCookie = (await send('Network.getAllCookies')).cookies.find(c => c.name === '__Host-workpulse_registration');
    check(registrationCookie?.httpOnly && registrationCookie.secure && registrationCookie.domain === 'localhost', 'Browser proof cookie is host-only, HttpOnly and Secure');
    const initialCode = messages[0].match(/verification code is: (\d{6})/)?.[1];
    if (!initialCode) throw Error('VERIFICATION_EMAIL_MISSING');
    check(await evaluate("location.hash===''") && await evaluate("document.querySelector('main').innerText.includes('Resend Code in')"), 'Verification clears email fragment and shows resend cooldown');
    await send('Network.clearBrowserCookies');
    await go(root + '/register/verify', "document.querySelectorAll('input[inputmode=numeric]').length===6");
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Six OTP boxes fit mobile viewport');
    await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 720, deviceScaleFactor: 1, mobile: true });
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'OTP verification fits a narrow 320px mobile viewport');
    await db.companyRegistration.update({ where: { email }, data: { lastIssuedAt: new Date(0) } });
    await evaluate(`(()=>{const f=document.querySelector('main form');for(const [key,value] of Object.entries(${JSON.stringify({email,registrationPassword:password})})){const el=f.elements[key];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}Array.from(f.querySelectorAll('button')).find(b=>b.textContent==='Resend Code').click();return true})()`);
    await until("document.querySelector('[role=status]')?.textContent.includes('A new code')");
    check(messages.length === 2, 'Cross-browser Resend Code sends a replacement through existing SMTP');
    const code = messages[1].match(/verification code is: (\d{6})/)?.[1];
    if (!code) throw Error('VERIFICATION_EMAIL_MISSING');
    await evaluate(`(()=>{const input=document.querySelector('input[inputmode=numeric]');input.focus();const data=new DataTransfer();data.setData('text/plain',${JSON.stringify(code)});input.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true}));return true})()`);
    check(await evaluate(`Array.from(document.querySelectorAll('input[inputmode=numeric]')).map(i=>i.value).join('')===${JSON.stringify(code)} && document.activeElement.getAttribute('aria-label')==='Verification digit 6'`), 'Pasting full code fills all six boxes and advances focus');
    await evaluate("document.querySelector('input[inputmode=numeric]').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await send('Input.insertText', { text: code[0] });
    check(await evaluate("document.activeElement.getAttribute('aria-label')==='Verification digit 2'"), 'Typing a digit moves focus to the next box');
    await submit({email, registrationPassword:password}, "location.pathname==='/login' && !!document.querySelector('input[name=password]')");
    await send('Emulation.clearDeviceMetricsOverride');
    const registration = await db.companyRegistration.findUniqueOrThrow({ where: { email }, include: { organization: true } });
    const org = registration.organization;
    check(!!org && registration.verifiedAt && await evaluate(`location.host===${JSON.stringify(org.slug + '.localhost:' + port)}`), 'Real verification creates the tenant and redirects to its own login');
    await submit({ email, password }, "location.pathname==='/dashboard/organization/setup' && !!document.querySelector('input[name=displayName]')");
    check(true, 'First HR login continues to existing organization branding setup');
    await submit({displayName:prefix,primaryColor:'#172f4d',accentColor:'#167c76'}, "document.querySelector('[role=status]')?.textContent==='Workspace branding updated.'");
    check((await db.organizationBranding.findUniqueOrThrow({where:{organizationId:org.id}})).displayName===prefix, 'Branding setup saves only the newly verified organization');
    await go('http://' + org.slug + '.localhost:' + port + '/dashboard', "location.pathname==='/dashboard' && !!document.querySelector('aside')");
    check(await evaluate(`document.body.innerText.includes(${JSON.stringify(prefix)})`), 'Existing HR login opens the new organization dashboard');
    await send('Page.reload', { ignoreCache: true });
    await until("document.readyState==='complete' && !!document.querySelector('aside')");
    check(true, 'Dashboard refresh preserves tenant authentication');
    const tenantCookie = (await send('Network.getAllCookies')).cookies.find(c => c.name === '__Host-workpulse_session' && c.domain === org.slug + '.localhost');
    const copied = { cookie: tenantCookie.name + '=' + tenantCookie.value };
    check((await probe('saga.localhost:' + port, '/api/leave-documents/synthetic', copied)).status === 401, 'Actual HTTP rejects a new-company session copied onto SAGA');
    check((await probe(org.slug + '.localhost:' + port, '/register')).status === 404, 'Tenant host cannot serve public registration');
    const verificationResponse = await probe('localhost:' + port, '/register/verify');
    check(verificationResponse.headers['referrer-policy'] === 'no-referrer' && verificationResponse.headers['cache-control']?.includes('no-store'), 'Verification HTTP response disables caching and referrers');
    await send('Network.setCookie', { name: '__Host-workpulse_platform', value: operatorToken, url: root, path: '/', secure: true, httpOnly: true, sameSite: 'Strict' });
    await go(root + '/platform', "document.querySelector('h1')?.textContent==='Organizations'");
    check(await evaluate(`document.querySelector('main').innerText.includes(${JSON.stringify(prefix)})`), 'Self-registered organization automatically appears in platform dashboard');
    await go(root + '/platform/organizations/' + org.id, "document.querySelector('main').innerText.includes('Self-service company registration')");
    check(await evaluate(`document.querySelector('main').innerText.includes(${JSON.stringify(email)}) && document.querySelector('main').innerText.includes('Email verified')`), 'Platform details display verified self-service onboarding metadata');
    await go(root + '/platform/organizations/new', "!!document.querySelector('input[name=slug]')");
    check(true, 'Manual System Administrator organization creation remains available');
    await go(root + '/saga', "document.body.innerText.includes('St. Aloysius')");
    check(true, 'Existing SAGA public workspace remains accessible');

    // Independent database transactions exercise real races, rather than one mocked transaction.
    require('tsx/cjs'); const original = Module._load;
    let service;
    try {
      Module._load = function(name, parent, main) { if (name === 'server-only') return {}; if (name.startsWith('@/')) return original.call(this, path.resolve('src', name.slice(2)), parent, main); return original.call(this, name, parent, main); };
      service = require('../src/features/company-registration/service.ts');
    } finally { Module._load = original; }
    const raceProof = randomBytes(32).toString('base64url'), rivalProof = randomBytes(32).toString('base64url');
    const raceMessages = [], raceSender = async message => { raceMessages.push(message); return { success: true }; };
    const raceInput = { companyName: prefix + ' race', administratorName: 'Concurrency HR', email: raceEmail, password };
    await Promise.all([service.registerCompany(db, raceInput, raceProof, raceSender), service.registerCompany(db, raceInput, rivalProof, raceSender)]);
    check(raceMessages.length === 1 && await db.companyRegistration.count({ where: { email: raceEmail } }) === 1, 'Concurrent duplicate submissions create one pending registration and email');
    const raceRecord = await db.companyRegistration.findUniqueOrThrow({ where: { email: raceEmail } });
    const winnerProof = raceRecord.browserHash === digest(raceProof) ? raceProof : rivalProof;
    let raceToken = raceMessages[0].code;
    const wrongCode = raceToken === '000000' ? '111111' : '000000';
    await Promise.allSettled(Array.from({length:8}, () => service.verifyCompanyRegistration(db, wrongCode, winnerProof, '', raceEmail)));
    check((await db.companyRegistration.findUniqueOrThrow({where:{email:raceEmail}})).otpAttempts === 5, 'Concurrent incorrect attempts commit exactly five failures for one issued code');
    const blocked = await Promise.allSettled([service.verifyCompanyRegistration(db, raceToken, '', password, raceEmail)]);
    check(blocked[0].status === 'rejected' && blocked[0].reason.code === 'ATTEMPTS_EXHAUSTED', 'A fresh browser cannot bypass exhausted code attempts');
    await db.companyRegistration.update({where:{email:raceEmail},data:{lastIssuedAt:new Date(0)}});
    await service.resendCompanyVerification(db, raceEmail, winnerProof, raceSender);
    raceToken = raceMessages.at(-1).code;
    const raced = await Promise.allSettled([service.verifyCompanyRegistration(db, raceToken, winnerProof, '', raceEmail), service.verifyCompanyRegistration(db, raceToken, winnerProof, '', raceEmail)]);
    check(raced.filter(result => result.status === 'fulfilled').length === 1 && await db.user.count({ where: { email: raceEmail } }) === 1, 'Concurrent verification consumes one proof and creates one company/account');
  } catch (error) {
    save('browser-failure', { stage, page: await inspect?.().catch(() => undefined), failure: /^[A-Z_]+$/.test(error.message) ? error.message : 'BROWSER_CHECK_FAILED' }); throw error;
  } finally {
    ws?.close(); chrome?.kill();
    if (server) await new Promise(resolve => server.close(resolve));
    await app?.close();
    if (smtp.listening) await new Promise(resolve => smtp.close(resolve));
    await db.$disconnect();
    await publicDb.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    const after = await helper.fingerprints(publicDb, before.columns);
    const preserved = JSON.stringify(before.tables) === JSON.stringify(after.tables);
    save('browser-preservation', { existingDataUnchanged: preserved, tablesCompared: before.tables.length, isolatedSchemaDisposed: true });
    helper.assertOriginalUnchanged(config); await publicDb.$disconnect();
    if (!preserved) throw Error('BROWSER_DATA_CHANGED');
  }
  save('browser-tests', { passed: true, assertions: checks.length, checks });
}
main().catch(error => { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'REGISTRATION_BROWSER_CHECK_FAILED'); process.exitCode = 1; });
