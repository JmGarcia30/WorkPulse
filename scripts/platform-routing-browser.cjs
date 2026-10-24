/* eslint-disable @typescript-eslint/no-require-imports -- Real browser/actions, disposable committed recovery fixtures for proxy visibility. */
const fs = require('node:fs'), path = require('node:path'), { randomBytes } = require('node:crypto');
const { createServer, request: rawRequest } = require('node:http'), { spawn } = require('node:child_process');
const net = require('node:net');
const { PrismaClient } = require('@prisma/client'), { hash } = require('bcryptjs');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration(), directory = 'docs/platform-phase-3', port = 3133;
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
Object.assign(process.env, config.environment, { NODE_ENV: 'production', DATABASE_URL: config.pooled.href, H10_TEST_DATABASE_URL: config.direct.href, PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port });
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
const save = (name, value) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], messages = [];
const prefix = 'routing-browser-' + randomBytes(6).toString('hex');
// Synthetic, loopback-only SMTP sink. No credentials/content or bearer links are persisted.
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
      else if (/^QUIT$/i.test(line)) { socket.end('221 bye\r\n'); }
      else socket.write('250 ok\r\n');
    }
  });
});
function check(value, scenario) { if (!value) throw Error(scenario); checks.push(scenario); save('browser-checks', checks); console.log('PASS:', scenario); }
function probe(host, route, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = rawRequest({ hostname: '127.0.0.1', port, path: route, headers: { host, ...headers } }, res => {
      res.resume(); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on('error', reject); req.end();
  });
}
async function main() {
  let app, server, chrome, ws, inspectPage, stage;
  const before = await helper.fingerprints(db);
  if (await db.platformAuthenticationAttempt.count() !== 0) throw Error('EMPTY_PLATFORM_ATTEMPTS_REQUIRED');
  try {
    await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
    Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.address().port), SMTP_SECURE: 'false', SMTP_USER: 'fixture@fixture.invalid', SMTP_PASSWORD: randomBytes(24).toString('hex'), EMAIL_FROM: 'fixture@fixture.invalid' });
    {
      const tx = db;
      const password = randomBytes(24).toString('hex');
      const email = prefix + '@example.invalid';
      await tx.platformAdministrator.create({ data: { email, name: 'Browser fixture administrator', passwordHash: await hash(password, 12) } });
      const saga = await tx.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' }, select: { id: true } });
      await tx.user.create({ data: { organizationId: saga.id, name: 'Synthetic SAGA routing HR', role: 'HR_ADMIN', email: prefix + '-saga@fixture.invalid', passwordHash: await hash(password, 12) } });
      // NextURL canonicalizes loopback IPs to localhost. Match that internal
      // origin while the HTTP listener remains bound only to 127.0.0.1.
      app = require('next')({ dev: false, hostname: 'localhost', port }); await app.prepare();
      server = createServer(app.getRequestHandler()); await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
      chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=9235', '--user-data-dir=' + path.resolve('.next/platform-routing-browser-profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
      let page;
      for (let i = 0; i < 100; i++) { try { page = (await (await fetch('http://127.0.0.1:9235/json')).json()).find(p => p.type === 'page'); if (page) break; } catch {} await pause(100); }
      if (!page) throw Error('BROWSER_UNAVAILABLE');
      ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
      let sequence = 0; const pending = new Map();
      ws.onmessage = ({ data }) => { const message = JSON.parse(data); if (message.id) { const p = pending.get(message.id); if (p) { pending.delete(message.id); if (message.error) p.reject(Error('CDP_ERROR')); else p.resolve(message.result); } } };
      const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
      async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error('BROWSER_EVALUATION'); return result.result.value; }
      inspectPage = () => evaluate('({path:location.pathname,title:document.title,hasAside:!!document.querySelector("aside"),hasPassword:!!document.querySelector("input[name=password]"),heading:document.querySelector("h1")?.textContent})');
      async function until(expression) { for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await pause(100); } throw Error('BROWSER_WAIT'); }
      async function go(route, expression) { const url = route.startsWith('http') ? route : `http://localhost:${port}${route}`; stage = { action: 'navigate', host: new URL(url).host, path: new URL(url).pathname }; await send('Page.navigate', { url }); await pause(100); await until("document.readyState==='complete' && (" + expression + ')'); await pause(300); }
      async function submit(values, outcome, buttonLabel) {
        stage = { action: 'submit', path: await evaluate('location.pathname'), button: buttonLabel ?? 'primary' };
        if (buttonLabel) await until(`[...document.querySelectorAll('main form button')].some(b=>b.textContent.trim()===${JSON.stringify(buttonLabel)})`);
        await evaluate(`(()=>{const label=${JSON.stringify(buttonLabel ?? null)};const f=label?[...document.querySelectorAll('main form button')].find(b=>b.textContent.trim()===label).form:document.querySelector('main form');for(const [key,value] of Object.entries(${JSON.stringify(values)})){const el=f.elements[key];if(el.type==='checkbox'){el.checked=!!value;continue}Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}window.__form=f;return true})()`);
        await evaluate('window.__form.requestSubmit();true'); await until(outcome);
      }
      await send('Page.enable'); await send('Network.enable'); await send('Network.clearBrowserCookies');
      await go('/platform', "location.pathname==='/platform/login' && !!document.querySelector('input[name=password]')");
      check(true, 'Protected platform dashboard redirects anonymous browsers to platform login');
      await submit({ email, password: 'incorrect-password' }, "!!document.querySelector('[role=alert]')");
      check(await tx.platformAdministratorSession.count() === 0, 'Real login action rejects incorrect credentials without issuing a session');
      await submit({ email, password }, "location.pathname==='/platform' && document.querySelector('h1')?.textContent==='Organizations'");
      check(await evaluate("document.querySelector('main').innerText.includes('Registered organizations')"), 'Real browser login opens the protected organization-count dashboard');
      const cookie = (await send('Network.getAllCookies')).cookies.find(c => c.name === '__Host-workpulse_platform');
      check(cookie && cookie.secure && cookie.httpOnly && cookie.sameSite === 'Strict' && cookie.path === '/', 'Production cookie is host-only, Secure, HttpOnly and SameSite Strict');
      check(await evaluate("!!document.querySelector('a[href=\"/platform/organizations/new\"]')"), 'Platform dashboard exposes the protected Create Organization action');
      await go('/platform/organizations/new', "document.querySelector('h1')?.textContent==='Create organization'");
      const hrEmail = prefix + '-hr@fixture.invalid';
      await submit({ name: 'Browser onboarding organization', slug: prefix, contactEmail: prefix + '-contact@fixture.invalid', timeZone: 'Asia/Manila', administratorEmail: hrEmail }, "document.querySelector('main')?.innerText.includes('Organization onboarding') && location.pathname!=='/platform/organizations/new'");
      const org = await tx.organization.findUniqueOrThrow({ where: { slug: prefix } });
      const invitation = await tx.organizationAdministratorInvitation.findUniqueOrThrow({ where: { organizationId: org.id } });
      check(invitation.status === 'PENDING' && invitation.deliveryStatus === 'SENT' && messages.length === 1, 'Real create action atomically initializes organization and HR invitation and delivers through loopback SMTP');
      check(await evaluate("document.querySelector('main').innerText.includes('Not verified — activation required') && document.querySelector('main').innerText.includes('SENT')"), 'Details distinguish pending email ownership from successful invitation delivery');
      check(!messages[0].includes('St. Aloysius') && !messages[0].includes('workpulse.saga.edu'), 'New HR invitation email uses neutral WorkPulse sender and content');
      const activationLink = message => { const match = message.match(/https?:\/\/[^\s<>\"]+\/activate\/organization-admin#token=[A-Za-z0-9_-]{43}/); if (!match) throw Error('SYNTHETIC_ACTIVATION_LINK_UNAVAILABLE'); return match[0]; };
      const oldLink = activationLink(messages[0]);
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      check(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'), 'Organization onboarding details and controls fit a mobile viewport');
      await tx.organizationAdministratorInvitation.update({ where: { id: invitation.id }, data: { lastIssuedAt: new Date(0) } });
      await submit({ confirmed: true }, "document.querySelector('[role=status]')?.textContent.includes('Invitation request recorded')", 'Resend invitation');
      check(messages.length === 2 && (await tx.organizationAdministratorInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).version === 2, 'Confirmed resend action rotates the token and emails one new invitation');
      const newLink = activationLink(messages[1]);
      await go(oldLink, "!!document.querySelector('input[name=passwordConfirmation]') && document.querySelector('input[name=token]').value.length===43");
      await submit({ name: 'Synthetic HR operator', password, passwordConfirmation: password }, "document.querySelector('[role=alert]')?.textContent.includes('invalid or expired')");
      check((await tx.organizationAdministratorInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status === 'PENDING', 'Resent old link fails through the actual activation Server Action');
      await go(newLink, `!!document.querySelector('input[name=passwordConfirmation]') && document.querySelector('input[name=token]').value===${JSON.stringify(new URLSearchParams(new URL(newLink).hash.slice(1)).get('token'))} && location.hash===''`);
      check(await evaluate("location.hash===''"), 'Activation page removes the bearer fragment from browser history');
      await submit({ name: 'Synthetic HR operator', password, passwordConfirmation: password }, "location.pathname==='/login' && !!document.querySelector('input[name=email]')");
      check((await tx.organizationAdministratorInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status === 'ACTIVATED', 'Real activation consumes the emailed token and directs HR to normal tenant login');
      await submit({ email: hrEmail, password }, "location.pathname==='/dashboard' && !!document.querySelector('aside')");
      check(await tx.user.count({ where: { organizationId: org.id, email: hrEmail, role: 'HR_ADMIN' } }) === 1, 'Activated initial HR administrator signs in through the existing tenant login UI');
      await send('Page.reload', { ignoreCache: true });
      await until("document.readyState==='complete' && location.pathname==='/dashboard' && !!document.querySelector('aside')");
      check(true, 'Company B HR dashboard refresh retains the correct workspace session');
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
      await go(`http://${prefix}.localhost:${port}/dashboard/employees/probation-settings`, "!!document.querySelector('textarea[name=\"TEACHING.evaluationCriteria\"]')");
      await submit({ 'TEACHING.durationMonths': '4', 'TEACHING.evaluationCriteria': 'Synthetic Company B teaching standards', 'NON_TEACHING.durationMonths': '4', 'NON_TEACHING.evaluationCriteria': 'Synthetic Company B other standards' }, "document.querySelector('[role=status]')?.textContent.includes('Policy saved for new offers')", 'Save probation policy');
      check((await tx.organization.findUniqueOrThrow({ where: { id: org.id } })).probationPolicy.TEACHING.durationMonths === 4, 'Company B HR saves only its own organization settings through the existing UI');
      await evaluate("document.querySelector('aside a[href=\"/dashboard\"]').click();true");
      await until("location.pathname==='/dashboard' && !!document.querySelector('aside') && document.querySelector('main').innerText.includes('Welcome Back')");
      check(true, 'Client navigation from settings back to dashboard preserves tenant resolution');
      const companyCookie = (await send('Network.getAllCookies')).cookies.find(c => c.name === '__Host-workpulse_session' && c.domain === prefix + '.localhost');
      const cookieHeader = companyCookie.name + '=' + companyCookie.value;
      const ownProbe = await probe(`${prefix}.localhost:${port}`, '/api/leave-documents/synthetic', { cookie: cookieHeader });
      check(ownProbe.status === 404, 'Company B API accepts its own tenant identity but cannot find another resource');
      const crossProbe = await probe(`saga.localhost:${port}`, '/api/leave-documents/synthetic', { cookie: cookieHeader });
      check(crossProbe.status === 401, 'Actual HTTP request rejects a Company B cookie copied onto SAGA');
      check((await probe(`unknown-${prefix}.localhost:${port}`, '/features', { cookie: cookieHeader })).status === 404, 'Actual HTTP rejects an unknown tenant even on a public page');
      check((await probe(`saga.localhost:${port}`, '/dashboard', { 'x-forwarded-host': `${prefix}.localhost:${port}`, cookie: cookieHeader })).status === 404, 'Actual HTTP rejects conflicting Host and forwarded tenant hosts');
      check((await probe('unverified.fixture.invalid', '/dashboard', { 'x-forwarded-host': `${prefix}.localhost:${port}`, cookie: cookieHeader })).status === 404, 'An unverified actual domain cannot borrow a configured forwarded host');
      const privateResponse = await probe(`${prefix}.localhost:${port}`, '/dashboard', { cookie: cookieHeader });
      check(!Object.keys(privateResponse.headers).some(key => key.includes('workpulse-routing-context')), 'Signed proxy routing context is not exposed in HTTP response headers');
      await go(`http://${prefix}.localhost:${port}/`, "!!document.querySelector('aside')");
      check(await evaluate("location.pathname==='/dashboard'"), 'New workspace resolves its own authenticated HR tenant');
      await go('/platform/organizations/' + org.id, "document.querySelector('main')?.innerText.includes('Confirmed by activation')");
      check(!await evaluate("[...document.querySelectorAll('main button')].some(b=>b.textContent.includes('Revoke invitation'))"), 'Activated invitation is shown verified and cannot be revoked as pending');
      await go('/platform/organizations/new', "document.querySelector('h1')?.textContent==='Create organization'");
      await submit({ name: 'Second browser synthetic organization', slug: prefix + '-revoked', contactEmail: prefix + '-contact@fixture.invalid', timeZone: 'UTC', administratorEmail: prefix + '-revoked@fixture.invalid' }, "document.querySelector('main')?.innerText.includes('Organization onboarding') && location.pathname!=='/platform/organizations/new'");
      await submit({ confirmed: true }, "document.querySelector('main')?.innerText.includes('Invitation: REVOKED')", 'Revoke invitation');
      check((await tx.organizationAdministratorInvitation.findUniqueOrThrow({ where: { organizationId: (await tx.organization.findUniqueOrThrow({ where: { slug: prefix + '-revoked' } })).id } })).status === 'REVOKED', 'Confirmed revoke action persists revocation and removes pending controls');
      const tenantCookie = (await send('Network.getAllCookies')).cookies.find(c => c.name === '__Host-workpulse_session');
      await send('Network.clearBrowserCookies');
      await send('Network.setCookie', { name: tenantCookie.name, value: tenantCookie.value, url: `http://localhost:${port}`, path: '/', secure: true, httpOnly: true });
      await go('/platform', "location.pathname==='/platform/login' && !!document.querySelector('input[name=password]')");
      check(true, 'An actual HR session alone cannot enter the platform dashboard');
      await go(`http://${prefix}.localhost:${port}/`, "document.querySelector('h1')?.textContent==='Browser onboarding organization'");
      check(await evaluate("!document.querySelector('main').innerText.includes('SAGA') && document.title.includes('Browser onboarding organization')"), 'Anonymous new-tenant landing page and metadata do not inherit SAGA institution content');
      await go('/saga', "document.readyState==='complete' && document.body.innerText.includes('St. Aloysius')");
      check(true, 'Existing SAGA public path workspace remains accessible');
      await go('/saga/login', "!!document.querySelector('input[name=password]')");
      await submit({ email: prefix + '-saga@fixture.invalid', password }, "location.pathname==='/saga/dashboard' && !!document.querySelector('aside')");
      check(true, 'Synthetic SAGA HR signs in through the preserved path workspace and dashboard redirect');
      await send('Page.reload', { ignoreCache: true });
      await until("document.readyState==='complete' && location.pathname==='/saga/dashboard' && !!document.querySelector('aside')");
      check(true, 'SAGA path dashboard refresh retains its signed tenant context');
      await evaluate("document.querySelector('aside a[href=\"/saga/dashboard/organization\"]').click();true");
      await until("location.pathname==='/saga/dashboard/organization' && document.querySelector('h1')?.textContent==='Organization settings'");
      check(true, 'SAGA sidebar navigation retains its legacy workspace prefix');
      await evaluate("document.querySelector('aside form').requestSubmit();true");
      await until("location.pathname==='/saga/login' && !!document.querySelector('input[name=password]')");
      check(true, 'SAGA logout clears authentication and returns to its prefixed login route');
    }
  } catch (error) {
    save('browser-failure', { stage, page: await inspectPage?.().catch(() => undefined), failure: /^[A-Z_]+$/.test(error.message) ? error.message : 'BROWSER_CHECK_FAILED' });
    throw error;
  }
  finally {
    ws?.close(); chrome?.kill();
    if (server) await new Promise(resolve => server.close(resolve));
    await app?.close();
    if (smtp.listening) await new Promise(resolve => smtp.close(resolve));
    const organizations = await db.organization.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } });
    const ids = organizations.map(org => org.id);
    await db.organizationBrandingAudit.deleteMany({ where: { organizationId: { in: ids } } });
    await db.organizationBranding.deleteMany({ where: { organizationId: { in: ids } } });
    await db.platformOrganizationAudit.deleteMany({ where: { organizationId: { in: ids } } });
    await db.organizationAdministratorInvitation.deleteMany({ where: { organizationId: { in: ids } } });
    await db.user.deleteMany({ where: { OR: [{ organizationId: { in: ids } }, { email: prefix + '-saga@fixture.invalid' }] } });
    await db.organization.deleteMany({ where: { id: { in: ids } } });
    await db.platformAdministrator.deleteMany({ where: { email: prefix + '@example.invalid' } });
    const crypto = require('node:crypto');
    await db.platformAuthenticationAttempt.deleteMany({ where: { key: { in: ['platform-login-global', 'login:' + prefix + '@example.invalid'].map(value => crypto.createHash('sha256').update(value).digest('hex')) } } });
    const after = await helper.fingerprints(db, before.columns);
    const preserved = JSON.stringify(before.tables) === JSON.stringify(after.tables);
    save('browser-preservation', { existingDataUnchanged: preserved, tablesCompared: before.tables.length, syntheticCommittedFixturesRemoved: true });
    helper.assertOriginalUnchanged(config); await db.$disconnect();
    if (!preserved) throw Error('BROWSER_DATA_CHANGED');
  }
  save('browser-tests', { passed: true, assertions: checks.length, checks });
}
main().catch(error => { console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]')); process.exitCode = 1; });
