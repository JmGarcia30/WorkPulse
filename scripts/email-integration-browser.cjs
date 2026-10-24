/* eslint-disable @typescript-eslint/no-require-imports -- Browser smoke test on verified recovery, with all Google traffic intercepted. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const { createServer, request: rawRequest } = require('node:http');
const { spawn } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
const { hash } = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration(), port = 3137, directory = 'docs/email-integration';
const verification = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json', 'utf8'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== 'br-broad-forest-az55xwfe' || config.identity.branchId !== verification.identity.branchId || config.identity.endpointSha256 !== verification.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY_TARGET');
Object.assign(process.env, config.environment, { NODE_ENV: 'production', DATABASE_URL: config.pooled.href, H10_TEST_DATABASE_URL: config.direct.href, PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port, GOOGLE_EMAIL_CLIENT_ID: 'synthetic-browser-client', GOOGLE_EMAIL_CLIENT_SECRET: 'synthetic-browser-secret', EMAIL_OAUTH_ENCRYPTION_KEY: randomBytes(32).toString('base64') });
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
fs.mkdirSync(directory, { recursive: true });
const save = (name, value) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const prefix = 'email-browser-' + randomBytes(6).toString('hex'), checks = [], messages = [];
const mailbox = prefix + '-mailbox@fixture.invalid', password = randomBytes(24).toString('hex');
let googleMailbox = mailbox, googleSubject = prefix + '-subject';
const providerCalls = [], originalFetch = global.fetch;
const hrFixtures = [];
const hrApplicantIds = [];
function check(value, label) { if (!value) throw Object.assign(Error('BROWSER_ASSERTION'), { scenario: label }); checks.push(label); save('browser-checks', checks); console.log('PASS:', label); }
function probe(host, route, headers = {}) {
  return new Promise((resolve, reject) => { const req = rawRequest({ hostname: '127.0.0.1', port, path: route, headers: { host, ...headers } }, res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers })); }); req.on('error', reject); req.end(); });
}
async function main() {
  let app, server, chrome, ws, stage, inspect, org, second, sagaUser, sagaOrg, hrJob;
  const before = await helper.fingerprints(db);
  try {
    org = await db.organization.create({ data: { name: 'Synthetic email browser organization', slug: prefix, careersEnabled: false, logoUrl: 'https://assets.fixture.invalid/email-test-logo.png' } });
    second = await db.organization.create({ data: { name: 'Other synthetic email browser organization', slug: prefix + '-other', careersEnabled: false } });
    const user = await db.user.create({ data: { organizationId: org.id, name: 'Synthetic Email HR', role: 'HR_ADMIN', email: prefix + '@fixture.invalid', passwordHash: await hash(password, 12) } });
    if (process.argv.includes('--hr-workflows')) {
      const job = await db.job.create({ data: { organizationId: org.id, title: 'Mock HR Email Position', slug: prefix + '-job', department: 'Test', employmentType: 'Full-time', location: 'Mock Office', description: 'Mock', responsibilities: 'Mock', qualifications: 'Mock', requirements: 'Mock', status: 'DRAFT' } });
      hrJob = job;
      for (const type of ['acknowledgment', 'interview', 'acceptance', 'rejection', 'onboarding']) {
        const applicant = await db.applicant.create({ data: { firstName: 'Jamie', lastName: 'Mock ' + type, email: prefix + '-' + type + '@fixture.invalid', phone: '0' } });
        hrApplicantIds.push(applicant.id);
        const application = await db.application.create({ data: { jobId: job.id, applicantId: applicant.id, coverLetter: 'Disposable HR email browser fixture', status: type === 'rejection' ? 'REJECTED' : type === 'acceptance' || type === 'onboarding' ? 'OFFER' : type === 'interview' ? 'INTERVIEW' : 'APPLIED' } });
        const fixture = { type, job, applicant, application }; hrFixtures.push(fixture);
        if (type === 'interview') await db.interview.create({ data: { applicationId: application.id, interviewerId: user.id, scheduledAt: new Date(Date.now() + 86400000 * 7), location: 'Mock Office', meetingUrl: 'https://example.invalid/interview' } });
        if (['acceptance', 'onboarding'].includes(type)) await db.offer.create({ data: { applicationId: application.id, salary: 1, employmentType: 'Full-time', startDate: new Date(Date.now() + 86400000 * 30), createdById: user.id, approvedById: user.id, status: type === 'acceptance' ? 'APPROVED' : 'ACCEPTED' } });
        if (type === 'onboarding') await db.onboardingProcess.create({ data: { applicationId: application.id, startDate: new Date(Date.now() + 86400000 * 30), status: 'IN_PROGRESS', tasks: { create: [{ title: 'Bring mock identification' }] } } });
      }
    }
    app = require('next')({ dev: false, hostname: 'localhost', port }); await app.prepare();
    // Real application adapter, synthetic Google responses; no external Google calls.
    const appFetch = global.fetch;
    global.fetch = async (url, init = {}) => {
      const target = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (target === 'https://oauth2.googleapis.com/token') {
        providerCalls.push('token');
        return Response.json({ access_token: 'synthetic-browser-access', refresh_token: 'synthetic-browser-refresh', expires_in: 3600, token_type: 'Bearer', scope: 'openid email https://www.googleapis.com/auth/gmail.send' });
      }
      if (target === 'https://openidconnect.googleapis.com/v1/userinfo') { providerCalls.push('identity'); return Response.json({ sub: googleSubject, email: googleMailbox, email_verified: true }); }
      if (target === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send') { providerCalls.push('send'); messages.push(Buffer.from(JSON.parse(init.body).raw, 'base64url').toString('utf8')); return Response.json({ id: 'synthetic-message' }); }
      if (target === 'https://oauth2.googleapis.com/revoke') { providerCalls.push('revoke'); return new Response('', { status: 200 }); }
      if (/^https:\/\/.*(googleapis\.com|google\.com)/.test(target)) throw Error('UNEXPECTED_GOOGLE_REQUEST');
      return appFetch(url, init);
    };
    server = createServer(app.getRequestHandler()); await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=9247', '--user-data-dir=' + path.resolve('.next/email-integration-browser-profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let page;
    for (let i = 0; i < 100; i++) { try { page = (await (await originalFetch('http://127.0.0.1:9247/json')).json()).find(p => p.type === 'page'); if (page) break; } catch {} await pause(100); }
    if (!page) throw Error('BROWSER_UNAVAILABLE');
    ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let sequence = 0; const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    let consentScopes;
    ws.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) { const item = pending.get(message.id); if (item) { pending.delete(message.id); if (message.error) item.reject(Error('CDP_ERROR')); else item.resolve(message.result); } }
      if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params, url = new URL(request.url);
        consentScopes = url.searchParams.get('scope');
        const target = new URL(url.searchParams.get('redirect_uri'));
        target.search = new URLSearchParams({ state: url.searchParams.get('state'), code: 'synthetic-browser-code' }).toString();
        send('Fetch.fulfillRequest', { requestId, responseCode: 302, responseHeaders: [{ name: 'Location', value: target.href }, { name: 'Cache-Control', value: 'no-store' }] }).catch(() => {});
      }
    };
    async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error('BROWSER_EVALUATION'); return result.result.value; }
    inspect = () => evaluate('({host:location.host,path:location.pathname,title:document.querySelector("h1")?.textContent,alert:document.querySelector("[role=alert]")?.textContent,body:document.body.innerText.slice(-1000)})');
    async function until(expression) { for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await pause(100); } throw Error('BROWSER_WAIT'); }
    async function go(url, expression) { stage = { action: 'navigate', host: new URL(url).host, path: new URL(url).pathname }; await send('Page.navigate', { url }); await pause(150); await until("document.readyState==='complete' && (" + expression + ')'); await pause(250); }
    async function click(label, outcome) {
      stage = { action: 'button', label };
      await evaluate(`(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});b.click();return true})()`); await until(outcome);
    }
    await send('Page.enable'); await send('Network.enable'); await send('Network.clearBrowserCookies');
    await send('Fetch.enable', { patterns: [{ urlPattern: 'https://accounts.google.com/o/oauth2/v2/auth*', requestStage: 'Request' }] });
    const tenant = `http://${org.slug}.localhost:${port}`;
    await go(tenant + '/login', "!!document.querySelector('input[name=password]')");
    await evaluate(`(()=>{const f=document.querySelector('main form');for(const [key,value] of Object.entries(${JSON.stringify({ email: user.email, password })})){const el=f.elements[key];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}f.requestSubmit();return true})()`);
    await until("location.pathname==='/dashboard' && !!document.querySelector('aside')");
    await go(tenant + '/dashboard/settings/email-integration', "document.querySelector('h1')?.textContent==='Email Integration'");
    await until("!!document.querySelector('aside a[href=\"/dashboard/settings/email-integration\"]')");
    check(await evaluate("!!document.querySelector('aside a[href=\"/dashboard/settings/email-integration\"]')"), 'HR sidebar exposes Settings → Email Integration');
    check(await evaluate("document.querySelector('main').innerText.includes('DISCONNECTED')"), 'Settings show disconnected status before authorization');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Email settings fit a mobile viewport');
    await send('Emulation.clearDeviceMetricsOverride');
    await click('Connect Google account', "location.pathname==='/dashboard/settings/email-integration' && document.querySelector('main').innerText.includes('CONNECTED') && document.querySelector('main').innerText.includes('Connected account')");
    check(consentScopes?.split(' ').sort().join(' ') === ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'].sort().join(' '), 'Actual OAuth redirect requests only send-only Gmail plus email identity');
    check(await evaluate(`location.host===${JSON.stringify(org.slug + '.localhost:' + port)} && document.querySelector('main').innerText.includes(${JSON.stringify(mailbox)})`), 'Central OAuth bridge and callback return to the original tenant with verified account status');
    check(!await evaluate("document.documentElement.outerHTML.includes('synthetic-browser-access') || document.documentElement.outerHTML.includes('synthetic-browser-refresh')"), 'Browser-rendered settings contain no OAuth tokens');
    const connection = await db.organizationEmailIntegration.findUniqueOrThrow({ where: { organizationId: org.id } });
    check(!connection.credentials.includes('synthetic-browser-access') && connection.status === 'CONNECTED', 'Browser OAuth stores only encrypted credentials for the initiating organization');
    const selectedRecipient = prefix + '-selected@fixture.invalid';
    check(await evaluate("!document.querySelector('input[name=recipient]').checkValidity()"), 'Test Email requires recipient entry before the browser can submit');
    await evaluate("[...document.querySelectorAll('main button')].find(b=>b.textContent==='Send test email').click();true");
    check(messages.length === 0, 'Clicking Test Email with a blank recipient makes no Gmail send');
    await evaluate(`(()=>{const el=document.querySelector('input[name=recipient]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(selectedRecipient)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
    await click('Send test email', "document.querySelector('main').innerText.includes('Test email submitted to Gmail for')");
    check(messages.length === 1 && messages[0].includes(mailbox) && messages[0].includes(selectedRecipient) && !messages[0].includes(user.email), 'Test Email uses the organization Gmail sender and HR-selected recipient rather than the login email');
    const brandedMessage = messages[0].replace(/=\r\n/g, '').replace(/=3D/gi, '=');
    check(brandedMessage.includes('https://assets.fixture.invalid/email-test-logo.png') && brandedMessage.includes(org.name) && brandedMessage.includes('Sent securely through WorkPulse') && brandedMessage.includes('Content-Type: text/plain'), 'Browser Test Email contains its own logo/name, minimal footer and plain-text fallback');
    check(await evaluate(`document.querySelector('main').innerText.includes(${JSON.stringify(selectedRecipient)})`), 'Test result identifies the selected recipient for delivery confirmation');
    await send('Page.reload', { ignoreCache: true });
    await until("document.readyState==='complete' && document.querySelector('main').innerText.includes('Connected account')");
    check(true, 'Connection status persists across browser refresh');
    const cookie = (await send('Network.getAllCookies')).cookies.find(c => c.name === '__Host-workpulse_session' && c.domain === org.slug + '.localhost');
    check((await probe(second.slug + '.localhost:' + port, '/dashboard/settings/email-integration', { cookie: cookie.name + '=' + cookie.value })).status === 307, 'Copied tenant session cannot inspect another organization email settings');
    check((await probe(second.slug + '.localhost:' + port, '/dashboard/settings/email-integration/templates', { cookie: cookie.name + '=' + cookie.value })).status === 307, 'Copied tenant session cannot inspect another organization HR email previews');
    check(await evaluate("[...document.querySelectorAll('main a')].some(a=>a.textContent==='Preview HR email templates')"), 'Email Integration links to HR template previews');
    const beforePreviews = messages.length;
    for (const type of ['acknowledgment', 'interview', 'acceptance', 'rejection', 'onboarding']) {
      await go(tenant + '/dashboard/settings/email-integration/templates?type=' + type, "document.querySelector('h1')?.textContent==='HR email previews' && !!document.querySelector('iframe')");
      check(await evaluate(`(()=>{const frame=document.querySelector('iframe');const text=document.querySelector('details').textContent;return frame.getAttribute('sandbox')==='' && frame.srcdoc.includes(${JSON.stringify(org.name)}) && frame.srcdoc.includes('email-test-logo.png') && frame.srcdoc.includes('Jamie Rivera') && text.includes('Jamie Rivera') && !document.querySelector('main form')})()`), `${type}: HR preview has own branding, safe mock details, plain text, and no send form`);
      if (type === 'acknowledgment') {
        const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        fs.mkdirSync('docs/hr-email-templates', { recursive: true });
        fs.writeFileSync('docs/hr-email-templates/hr-preview-browser.png', Buffer.from(screenshot.data, 'base64'));
      }
    }
    check(messages.length === beforePreviews, 'Opening all five HR previews sends no emails');
    for (const fixture of hrFixtures) {
      const before = messages.length;
      await go(tenant + '/dashboard/hiring/applicants/' + fixture.application.id + '/email', "document.querySelector('h1')?.textContent==='HR email'");
      await evaluate(`(()=>{const select=document.querySelector('main select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(fixture.type)});select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
      await click('Preview recipient and email', "!!document.querySelector('main iframe') && !document.querySelector('main fieldset').disabled");
      check(messages.length === before && await evaluate(`document.querySelector('main').innerText.includes(${JSON.stringify(fixture.applicant.email)}) && document.querySelector('main').innerText.includes(${JSON.stringify(mailbox)}) && [...document.querySelectorAll('main button')].find(b=>b.textContent==='Confirm and send email').disabled`), `${fixture.type}: actual HR action previews saved recipient/sender without sending and requires confirmation`);
      await evaluate("document.querySelector('main input[type=checkbox]').click();true");
      await click('Confirm and send email', "document.querySelector('main').innerText.includes('Email submitted to the sending provider') && !document.querySelector('main fieldset').disabled");
      check(messages.length === before + 1 && messages.at(-1).includes(fixture.applicant.email) && messages.at(-1).includes(mailbox), `${fixture.type}: confirmed browser action sends once through connected organization Gmail`);
      await until("document.querySelector('main').innerText.includes('SUBMITTED')");
      await click('Preview recipient and email', "document.querySelector('[role=alert]')?.textContent.includes('already been submitted')");
      const current = await db.application.findUniqueOrThrow({ where: { id: fixture.application.id } });
      const history = await db.hrEmailDelivery.findFirstOrThrow({ where: { applicationId: current.id } });
      check(messages.length === before + 1 && history.attemptCount === 1 && history.status === 'SUBMITTED' && current.status === fixture.application.status, `${fixture.type}: duplicate blocked, status logged, and applicant status unchanged`);
      check((await probe(second.slug + '.localhost:' + port, '/dashboard/hiring/applicants/' + fixture.application.id + '/email', { cookie: cookie.name + '=' + cookie.value })).status === 307, `${fixture.type}: HR email page rejects another tenant session`);
    }
    await go(tenant + '/dashboard/settings/email-integration', "document.querySelector('h1')?.textContent==='Email Integration'");
    const denied = await probe(org.slug + '.localhost:' + port, '/api/email-integration/google/callback?state=synthetic');
    check(denied.status === 404 && denied.headers['referrer-policy'] === 'no-referrer', 'OAuth callback rejects tenant hosts and suppresses referrers');
    await evaluate("document.querySelector('input[name=confirmed]').checked=true;true");
    await click('Disconnect', "document.querySelector('main').innerText.includes('Gmail disconnected')");
    check(!await evaluate("document.querySelector('main').innerText.includes('Gmail account is connected.')"), 'Disconnect removes the earlier connected banner instead of showing contradictory status');
    check(providerCalls.includes('revoke') && !(await db.organizationEmailIntegration.findUniqueOrThrow({ where: { organizationId: org.id } })).credentials, 'Disconnect revokes Google authorization and removes stored credentials');
    check(providerCalls.every(value => ['token', 'identity', 'send', 'revoke'].includes(value)), 'All Google authorization and sending requests were intercepted with synthetic responses');
    if (!process.argv.includes('--recipient-only')) {
    // Never replace an existing real SAGA connection or its test throttle row.
    const saga = await db.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
    const sagaBudget = createHash('sha256').update('email-integration-test:' + saga.id).digest('hex');
    if (await db.organizationEmailIntegration.findUnique({ where: { organizationId: saga.id } }) || await db.platformAuthenticationAttempt.findUnique({ where: { key: sagaBudget } })) throw Error('UNUSED_SAGA_EMAIL_FIXTURE_REQUIRED');
    sagaOrg = saga;
    sagaUser = await db.user.create({ data: { organizationId: saga.id, name: 'Synthetic SAGA Email HR', role: 'HR_ADMIN', email: prefix + '-saga@fixture.invalid', passwordHash: await hash(password, 12) } });
    const sagaTenant = `http://saga.localhost:${port}`;
    await go(sagaTenant + '/login', "!!document.querySelector('input[name=password]')");
    await evaluate(`(()=>{const f=document.querySelector('main form');for(const [key,value] of Object.entries(${JSON.stringify({ email: sagaUser.email, password })})){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f.elements[key],value);f.elements[key].dispatchEvent(new Event('input',{bubbles:true}))}f.requestSubmit();return true})()`);
    await until("location.pathname==='/dashboard' && !!document.querySelector('aside')");
    await go(sagaTenant + '/dashboard/settings/email-integration', "document.querySelector('h1')?.textContent==='Email Integration'");
    check(await evaluate("[...document.querySelectorAll('main button')].some(b=>b.textContent==='Connect Google account') && document.querySelector('main').innerText.includes('Existing SAGA sender')"), 'SAGA HR sees Connect and the unchanged legacy recruitment sender');
    googleMailbox = prefix + '-saga-mailbox@fixture.invalid'; googleSubject = prefix + '-saga-subject';
    await click('Connect Google account', "location.pathname==='/dashboard/settings/email-integration' && document.querySelector('main').innerText.includes('Connected account')");
    check(await evaluate(`location.host===${JSON.stringify('saga.localhost:' + port)} && document.querySelector('main').innerText.includes('Existing SAGA sender')`), 'SAGA OAuth preserves the saga hostname and does not activate recruitment Gmail');
    check(await evaluate("[...document.querySelectorAll('main button')].find(b=>b.textContent==='Activate Gmail for recruitment').disabled"), 'SAGA activation is disabled until the connection tests successfully');
    const sagaRecipient = prefix + '-saga-selected@fixture.invalid';
    await evaluate(`(()=>{const el=document.querySelector('input[name=recipient]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(sagaRecipient)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
    await click('Send test email', "document.querySelector('main').innerText.includes('Test email submitted to Gmail for')");
    check(messages.at(-1).includes(sagaRecipient) && messages.at(-1).includes(googleMailbox), 'SAGA test sends to the selected inbox from SAGA verified Gmail');
    check(!(await db.organizationEmailIntegration.findUniqueOrThrow({ where: { organizationId: saga.id } })).recruitmentGmailActive, 'Real SAGA test action leaves legacy recruitment selected');
    await evaluate("document.querySelector('input[name=sender]').form.querySelector('input[name=confirmed]').checked=true;true");
    await click('Activate Gmail for recruitment', "document.querySelector('main').innerText.includes('SAGA verified Gmail connection')");
    check((await db.organizationEmailIntegration.findUniqueOrThrow({ where: { organizationId: saga.id } })).recruitmentGmailActive, 'Confirmed SAGA activation persists the tested Gmail sender');
    await evaluate("document.querySelector('input[name=sender]').form.querySelector('input[name=confirmed]').checked=true;true");
    await click('Use existing SAGA sender', "document.querySelector('main').innerText.includes('SAGA recruitment now uses its existing legacy sender')");
    check(!(await db.organizationEmailIntegration.findUniqueOrThrow({ where: { organizationId: saga.id } })).recruitmentGmailActive, 'Confirmed SAGA revert restores legacy without disconnecting Gmail');
    await evaluate("[...document.querySelectorAll('main button')].find(b=>b.textContent==='Disconnect').form.querySelector('input[name=confirmed]').checked=true;true");
    await click('Disconnect', "document.querySelector('main').innerText.includes('Gmail disconnected')");
    check(!(await db.organizationEmailIntegration.findUniqueOrThrow({ where: { organizationId: saga.id } })).credentials, 'SAGA Disconnect removes credentials and retains its legacy recruitment sender');
    }
    // Exercise refresh/disconnect races on independent, committed DB transactions.
    require('tsx/cjs'); const originalLoad = Module._load;
    let service, crypto;
    try {
      Module._load = function(name, parent, main) { if (name === 'server-only') return {}; if (name.startsWith('@/')) return originalLoad.call(this, path.resolve('src', name.slice(2)), parent, main); return originalLoad.call(this, name, parent, main); };
      service = require('../src/features/email-integration/service.ts'); crypto = require('../src/features/email-integration/crypto.ts');
    } finally { Module._load = originalLoad; }
    const credentials = { accessToken: 'synthetic-expired', refreshToken: 'synthetic-concurrency-refresh', expiresAt: 0 };
    await db.organizationEmailIntegration.update({ where: { organizationId: org.id }, data: { credentials: crypto.encryptSecret(credentials, org.id + ':connection'), email: mailbox, status: 'CONNECTED' } });
    let refreshCount = 0;
    const concurrentProvider = { exchange: async () => { throw Error('UNEXPECTED_EXCHANGE'); }, refresh: async () => { refreshCount++; await pause(50); return { accessToken: 'synthetic-concurrency-access', expiresAt: Date.now() + 3600000 }; }, send: async () => {}, revoke: async () => true };
    const notice = { to: user.email, subject: 'Synthetic race', html: '<p>Synthetic</p>' };
    const results = await Promise.all([service.sendOrganizationEmail(db, org.id, notice, concurrentProvider), service.sendOrganizationEmail(db, org.id, notice, concurrentProvider)]);
    check(results.every(result => result.success) && refreshCount === 1, 'Concurrent sends refresh one expired token once and share the updated credential');
    await db.organizationEmailIntegration.update({ where: { organizationId: org.id }, data: { credentials: crypto.encryptSecret(credentials, org.id + ':connection') } });
    let started, release;
    const refreshStarted = new Promise(resolve => { started = resolve; });
    const holdRefresh = new Promise(resolve => { release = resolve; });
    concurrentProvider.refresh = async () => { started(); await holdRefresh; return { accessToken: 'synthetic-race-access', expiresAt: Date.now() + 3600000 }; };
    const sending = service.sendOrganizationEmail(db, org.id, notice, concurrentProvider);
    await refreshStarted;
    const disconnecting = service.disconnectConnection(db, { organizationId: org.id, userId: user.id }, concurrentProvider);
    release(); await Promise.all([sending, disconnecting]);
    check(!(await db.organizationEmailIntegration.findUniqueOrThrow({ where: { organizationId: org.id } })).credentials, 'Disconnect racing refresh cannot resurrect stored authorization');
  } catch (error) {
    save('browser-failure', { stage, page: await inspect?.().catch(() => undefined), failure: /^[A-Z_]+$/.test(error.message) ? error.message : 'EMAIL_BROWSER_CHECK_FAILED', scenario: error.scenario }); throw error;
  } finally {
    ws?.close(); chrome?.kill();
    if (server) await new Promise(resolve => server.close(resolve));
    await app?.close(); global.fetch = originalFetch;
    const ids = [org?.id, second?.id].filter(Boolean);
    await db.hrEmailDelivery.deleteMany({ where: { organizationId: { in: ids } } });
    for (const fixture of hrFixtures) {
      await db.onboardingTask.deleteMany({ where: { onboardingProcess: { applicationId: fixture.application.id } } });
      await db.onboardingProcess.deleteMany({ where: { applicationId: fixture.application.id } });
      await db.offer.deleteMany({ where: { applicationId: fixture.application.id } });
      await db.interview.deleteMany({ where: { applicationId: fixture.application.id } });
      await db.application.delete({ where: { id: fixture.application.id } });
    }
    if (hrApplicantIds.length) await db.applicant.deleteMany({ where: { id: { in: hrApplicantIds } } });
    if (hrJob) await db.job.delete({ where: { id: hrJob.id } });
    await db.organizationEmailOAuthAttempt.deleteMany({ where: { organizationId: { in: ids } } });
    await db.organizationEmailIntegration.deleteMany({ where: { organizationId: { in: ids } } });
    await db.user.deleteMany({ where: { organizationId: { in: ids } } });
    await db.organization.deleteMany({ where: { id: { in: ids } } });
    await db.platformAuthenticationAttempt.deleteMany({ where: { key: createHash('sha256').update('email-integration-test:' + org?.id).digest('hex') } });
    if (sagaUser && sagaOrg) {
      const state = await db.organizationEmailIntegration.findUnique({ where: { organizationId: sagaOrg.id } });
      const foreignAttempts = await db.organizationEmailOAuthAttempt.count({ where: { organizationId: sagaOrg.id, actorId: { not: sagaUser.id } } });
      if (foreignAttempts || (state?.googleSubject && state.googleSubject !== prefix + '-saga-subject')) throw Error('SAGA_EMAIL_CHANGED_CONCURRENTLY');
      await db.organizationEmailOAuthAttempt.deleteMany({ where: { actorId: sagaUser.id } });
      await db.organizationEmailIntegration.deleteMany({ where: { organizationId: sagaOrg.id } });
      await db.platformAuthenticationAttempt.deleteMany({ where: { key: createHash('sha256').update('email-integration-test:' + sagaOrg.id).digest('hex') } });
      await db.user.delete({ where: { id: sagaUser.id } });
    }
    const after = await helper.fingerprints(db, before.columns);
    const preserved = JSON.stringify(before.tables) === JSON.stringify(after.tables);
    save('browser-preservation', { existingDataUnchanged: preserved, tablesCompared: before.tables.length, syntheticCommittedFixturesRemoved: true, googleNetworkUsed: false });
    helper.assertOriginalUnchanged(config); await db.$disconnect();
    if (!preserved) throw Error('BROWSER_DATA_CHANGED');
  }
  save('browser-tests', { passed: true, assertions: checks.length, checks, googleNetworkUsed: false, sagaBrowserSkipped: process.argv.includes('--recipient-only') });
}
main().catch(error => { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'EMAIL_INTEGRATION_BROWSER_CHECK_FAILED'); process.exitCode = 1; });
