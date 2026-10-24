/* eslint-disable @typescript-eslint/no-require-imports -- Real browser/actions, rollback-only recovery fixtures. */
const fs = require('node:fs'), path = require('node:path'), { randomBytes } = require('node:crypto');
const { createServer } = require('node:http'), { spawn } = require('node:child_process');
const { PrismaClient } = require('@prisma/client'), { hash } = require('bcryptjs');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration(), directory = 'docs/platform-admin-phase-1', port = 3131;
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
Object.assign(process.env, config.environment, { NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port });
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
const save = (name, value) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], rollback = Error('ROLLBACK_PLATFORM_BROWSER');
function check(value, scenario) { if (!value) throw Error(scenario); checks.push(scenario); console.log('PASS:', scenario); }
function fixtureClient(tx) {
  let queue = Promise.resolve(), sequence = 0;
  return new Proxy(tx, { get(target, property) {
    if (property === '$transaction') return operation => {
      const work = async () => {
        const name = 'platform_browser_' + (++sequence); await tx.$executeRawUnsafe('SAVEPOINT ' + name);
        try { const result = await operation(tx); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
        catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); throw error; }
      };
      const result = queue.then(work); queue = result.catch(() => {}); return result;
    }
    const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
  } });
}
async function main() {
  let app, server, chrome, ws;
  const before = await helper.fingerprints(db);
  try {
    await db.$transaction(async tx => {
      globalThis.prisma = fixtureClient(tx);
      const prefix = 'platform-browser-' + randomBytes(6).toString('hex'), password = randomBytes(24).toString('hex');
      const email = prefix + '@example.invalid';
      await tx.platformAdministrator.create({ data: { email, name: 'Browser fixture administrator', passwordHash: await hash(password, 12) } });
      const org = await tx.organization.create({ data: { name: 'Platform browser synthetic organization', slug: prefix, careersEnabled: false, timeZone: 'Asia/Manila' } });
      app = require('next')({ dev: false, hostname: '127.0.0.1', port }); await app.prepare();
      server = createServer(app.getRequestHandler()); await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
      chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=9233', '--user-data-dir=' + path.resolve('.next/platform-browser-profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
      let page;
      for (let i = 0; i < 100; i++) { try { page = (await (await fetch('http://127.0.0.1:9233/json')).json()).find(p => p.type === 'page'); if (page) break; } catch {} await pause(100); }
      if (!page) throw Error('BROWSER_UNAVAILABLE');
      ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
      let sequence = 0; const pending = new Map();
      ws.onmessage = ({ data }) => { const message = JSON.parse(data); if (message.id) { const p = pending.get(message.id); if (p) { pending.delete(message.id); if (message.error) p.reject(Error('CDP_ERROR')); else p.resolve(message.result); } } };
      const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
      async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error('BROWSER_EVALUATION'); return result.result.value; }
      async function until(expression) { for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await pause(100); } throw Error('BROWSER_WAIT:' + expression); }
      async function go(route, expression) { await send('Page.navigate', { url: `http://localhost:${port}${route}` }); await until(expression); await pause(300); }
      async function submit(values, outcome) {
        await evaluate(`(()=>{const f=document.querySelector('main form');for(const [key,value] of Object.entries(${JSON.stringify(values)})){const el=f.elements[key];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}window.__form=f;return true})()`);
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
      await go('/platform/organizations/' + org.id, "document.querySelector('h1')?.textContent==='Platform browser synthetic organization'");
      check(await evaluate("document.querySelector('main').innerText.includes('Disabled') && document.querySelector('main').innerText.includes('Asia/Manila')"), 'Organization details render persisted status and metadata');
      check(!await evaluate("!!document.querySelector('a[href*=\"/dashboard/payroll\"], a[href*=\"/dashboard/employees\"], a[href*=\"/dashboard/hiring\"]')"), 'Platform pages provide no confidential tenant record navigation');
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      check(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'), 'Platform organization details fit a mobile viewport');
      await go('/platform/settings', "!!document.querySelector('input[name=currentPassword]')");
      await submit({ name: 'Browser updated administrator', currentPassword: password, newPassword: '' }, "document.querySelector('[role=status]')?.textContent==='Account settings saved.'");
      check((await tx.platformAdministrator.findUniqueOrThrow({ where: { email } })).name === 'Browser updated administrator', 'Real settings action updates only the signed-in administrator');
      await evaluate("document.querySelector('header form').requestSubmit();true"); await until("location.pathname==='/platform/login' && !!document.querySelector('input[name=password]')");
      check(await tx.platformAdministratorSession.count() === 0, 'Real logout action removes the persistent platform session');
      throw rollback;
    }, { timeout: 300000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally {
    ws?.close(); chrome?.kill();
    if (server) await new Promise(resolve => server.close(resolve));
    await app?.close(); delete globalThis.prisma;
    const after = await helper.fingerprints(db, before.columns);
    const preserved = JSON.stringify(before.tables) === JSON.stringify(after.tables);
    save('browser-preservation', { existingDataUnchanged: preserved, tablesCompared: before.tables.length, syntheticTransactionRolledBack: true });
    helper.assertOriginalUnchanged(config); await db.$disconnect();
    if (!preserved) throw Error('BROWSER_DATA_CHANGED');
  }
  save('browser-tests', { passed: true, assertions: checks.length, checks });
}
main().catch(error => { console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]')); process.exitCode = 1; });
