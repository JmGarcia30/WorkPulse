/* eslint-disable @typescript-eslint/no-require-imports -- Browser verification against the running local app. */
const fs = require('node:fs');
const { randomBytes, createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const helper = require('./batch0-recovery-environment.cjs');
const browser = require('./batch0-recovery-browser.cjs');
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!verified.h10Applied || verified.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_TARGET');
const directory = 'docs/runtime-recovery';
const save = (name, value) => fs.writeFileSync(directory + '/' + name + '.json', JSON.stringify(value, null, 2));
const pause = ms => new Promise(r => setTimeout(r, ms));
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });

async function monitor() {
  const page = (await (await fetch('http://127.0.0.1:9230/json')).json()).find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl), pending = new Map(), errors = [], warnings = [];
  let id = 0;
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) { const p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); if (m.error) p.reject(Error('CDP_ERROR')); else p.resolve(m.result); } return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push({ kind: 'runtime-exception' });
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      const message = m.params.args.map(a => typeof a.value === 'string' ? a.value : '').join(' ');
      const record = { kind: /same key|unique.*key/.test(message) ? 'duplicate-react-key' : /hydration|hydrated/.test(message) ? 'hydration' : 'console-' + m.params.type, messageSha256: createHash('sha256').update(message).digest('hex') };
      (m.params.type === 'error' ? errors : warnings).push(record);
    }
  };
  function send(method, params = {}) { return new Promise((resolve, reject) => { const number = ++id; const timer = setTimeout(() => { pending.delete(number); reject(Error('CDP_TIMEOUT')); }, 30000); pending.set(number, { resolve, reject, timer }); ws.send(JSON.stringify({ id: number, method, params })); }); }
  async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true }); if (result.exceptionDetails) throw Error('BROWSER_EVALUATION_FAILED'); return result.result.value; }
  await send('Runtime.enable');
  return { errors, warnings, evaluate, close: () => ws.close() };
}
async function main() {
  let user, session, inspector;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:3000/login', { headers: { host: 'saga.localhost:3000', 'x-forwarded-host': 'saga.localhost:3000' }, signal: AbortSignal.timeout(5000) });
        ready = response.status === 200 && (await response.text()).includes('name="password"');
        if (ready) break;
      } catch { /* The dev server may still be compiling the login route. */ }
      await pause(1000);
    }
    if (!ready) helper.fail('DEV_SERVER_NOT_READY');
    const organization = await db.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' }, select: { id: true } });
    const employee = await db.employee.findFirst({ where: { organizationId: organization.id, employeeStatus: 'ACTIVE', employmentRecords: { some: {} } }, select: { id: true, employeeNumber: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }] });
    if (!employee) helper.fail('PROFILE_FIXTURE_UNAVAILABLE');
    const password = randomBytes(32).toString('hex');
    user = await db.user.create({ data: { organizationId: organization.id, email: 'runtime-' + randomBytes(12).toString('hex') + '@audit.invalid', name: 'Runtime Verification', role: 'ORGANIZATION_ADMIN', passwordHash: await hash(password, 10) }, select: { id: true, email: true } });
    // A normal login using an account present only in the recovery branch proves the live server target.
    session = await browser({ port: 3000, production: false, email: user.email, password });
    inspector = await monitor();
    const dashboard = await inspector.evaluate('({expected: /Welcome Back,/.test(document.querySelector("main")?.innerText||"") && /New Hires/i.test(document.querySelector("main")?.innerText||""),error:/Something went wrong while loading/.test(document.querySelector("main")?.innerText||"")})');
    if (!dashboard.expected || dashboard.error) helper.fail('DASHBOARD_RENDER_FAILED');
    const results = [{ route: 'Dashboard', completed: true, expectedContent: true, renderedError: false, initialNormalLogin: true }];
    const routes = [
      ['Hiring', '/dashboard/hiring/pipeline', ['Hiring Pipeline'], true],
      ['Employees', '/dashboard/employees', ['Employee Records'], true],
      ['Employee Profile', '/dashboard/employees/' + employee.id, [employee.employeeNumber, 'Back to Employee Records', 'Employment History'], false],
      ['Attendance', '/dashboard/attendance', ['Monthly Attendance'], true],
      ['Leave', '/dashboard/leave', ['Leave Management'], true],
      ['Payroll', '/dashboard/payroll', ['Payroll'], true],
      ['Analytics', '/dashboard/analytics', ['Workforce Overview'], true],
      ['Exit Management', '/dashboard/employees/exit', ['Separation cases', 'Create exit case'], true],
      ['Dashboard return', '/dashboard', ['Welcome Back,', 'New Hires'], true],
    ];
    for (const [name, route, expected, sidebar] of routes) {
      const errorStart = inspector.errors.length;
      const result = await session.navigate({ name, route, expected, sidebar });
      await pause(500);
      result.consoleErrors = inspector.errors.slice(errorStart);
      results.push(result); save('browser-pages', results);
      console.log(JSON.stringify({ route: name, completed: result.completed, expectedContent: result.expectedContent, consoleErrors: result.consoleErrors.length, runtimeExceptions: result.runtimeExceptions, documentRequests: result.documentRequests }));
      if (!result.completed || !result.expectedContent || result.renderedError || result.runtimeExceptions || result.failedHttpResponses.length || result.consoleErrors.length) helper.fail('BROWSER_PAGE_FAILED');
    }
    const response = await fetch('http://127.0.0.1:3000/_next/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_errors', arguments: {} } }) });
    const frame = (await response.text()).split('\n').find(l => l.startsWith('data: '));
    const issues = JSON.parse(JSON.parse(frame.slice(6)).result.content[0].text);
    save('live-issues-after', issues);
    const log = fs.readFileSync('.next/dev/logs/next-development.log', 'utf8');
    const serverFailures = log.split(/\r?\n/).flatMap(l => { try { const r = JSON.parse(l); if (r.source !== 'Server') return []; const text = String(r.message); return /PrismaClientKnownRequestError|SeparationError|does not exist|P2022|P2021/.test(text) ? [{ kind: /does not exist|P2022|P2021/.test(text) ? 'database-schema' : 'runtime' }] : []; } catch { return []; } });
    const result = { normalPasswordLogin: true, recoveryOnlyTemporaryAccount: true, liveRecoveryTargetConfirmedByAuthentication: true, verifiedBranch: config.identity.branchName, consoleErrors: inspector.errors, consoleWarnings: inspector.warnings, serverFailures, devtoolsConfigErrors: issues.configErrors?.length || 0, devtoolsSessionErrors: issues.sessionErrors?.reduce((sum, s) => sum + (s.runtimeErrors?.length || 0) + (s.buildError ? 1 : 0), 0) || 0, originalEnvUnchanged: true };
    save('browser-validation', result);
    if (result.consoleErrors.length || serverFailures.length || result.devtoolsConfigErrors || result.devtoolsSessionErrors) helper.fail('RUNTIME_ISSUES_REMAIN');
  } finally {
    inspector?.close(); await session?.close();
    if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect(); helper.assertOriginalUnchanged(config);
  }
}
main().catch(e => { console.error(JSON.stringify({ code: e.code || e.name, message: /^[A-Z_]+$/.test(e.message) ? e.message : undefined })); process.exitCode = 1; });
