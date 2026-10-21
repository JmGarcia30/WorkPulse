/* eslint-disable @typescript-eslint/no-require-imports -- Recovery-only local measurement runner. */
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const helper = require('./batch0-recovery-environment.cjs');
const browser = require('./batch0-recovery-browser.cjs');
const config = helper.configuration();
const verification = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!verification.h10Applied || !verification.h10ChecksumMatch || verification.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_TARGET');
const directory = 'docs/performance-audit/final-ux';
fs.mkdirSync(directory, { recursive: true });
const save = (name, value) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(value, null, 2));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function measure(label, mode) {
  const production = mode === 'production', port = production ? 3101 : 3102;
  const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  let user, essUser, essAccount, server, session, log = '';
  try {
    const org = await db.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' }, select: { id: true } });
    const employee = await db.employee.findFirstOrThrow({ where: { organizationId: org.id, employmentRecords: { some: {} } }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }], select: { id: true } });
    const password = randomBytes(32).toString('hex');
    user = await db.user.create({ data: { organizationId: org.id, email: `ux-${randomBytes(12).toString('hex')}@audit.invalid`, name: 'UX Measurement', role: 'ORGANIZATION_ADMIN', passwordHash: await hash(password, 10) }, select: { id: true, email: true } });
    const env = { ...config.environment, NODE_ENV: production ? 'production' : 'development', DATABASE_URL: helper.readOnly(config.pooled), PLATFORM_ROOT_DOMAIN: `localhost:${port}`, PLATFORM_PUBLIC_ORIGIN: `http://localhost:${port}` };
    server = spawn(process.execPath, ['--require', './scripts/performance-audit-preload.cjs', 'node_modules/next/dist/bin/next', production ? 'start' : 'dev', ...production ? [] : ['--webpack'], '-H', '127.0.0.1', '-p', String(port)], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [server.stdout, server.stderr]) stream.on('data', b => log += b);
    for (let i = 0; i < 600 && !log.includes('Ready in') && server.exitCode === null; i++) await pause(100);
    if (!log.includes('Ready in')) helper.fail('SERVER_NOT_READY');
    session = await browser({ port, production, email: user.email, password });
    await session.evaluate('window.__uxLongTasks=[];new PerformanceObserver(list=>window.__uxLongTasks.push(...list.getEntries().map(e=>({startTime:e.startTime,duration:e.duration})))).observe({type:"longtask",buffered:true});true');
    const routes = [
      ['Employees', '/dashboard/employees', ['Employee Records'], true],
      ['Employee Profile', '/dashboard/employees/' + employee.id, ['Back to Employee Records', 'Employment History'], false],
      ['Hiring', '/dashboard/hiring/pipeline', ['Hiring Pipeline'], true],
      ['Dashboard', '/dashboard', ['Welcome Back,', 'New Hires'], true],
    ];
    const navigation = [], http = [];
    for (let cycle = 0; cycle < 4; cycle++) {
      for (const [name, route, expected, sidebar] of routes) {
        const row = { cycle, ...await session.navigate({ name, route, expected, sidebar }) };
        row.rendering = await session.evaluate('(()=>{const r=performance.getEntriesByType("resource").filter(e=>e.startTime>=window.__recoveryStart);const flights=r.filter(e=>e.name.includes("_rsc="));const scripts=r.filter(e=>e.initiatorType==="script");const tasks=(window.__uxLongTasks||[]).filter(e=>e.startTime>=window.__recoveryStart);return {rscRequests:flights.length,rscLastResponseMs:Math.max(0,...flights.map(e=>e.responseEnd-window.__recoveryStart)),newScriptBytes:scripts.reduce((n,e)=>n+e.encodedBodySize,0),newScripts:scripts.length,longTasks:tasks.length,longTaskMs:tasks.reduce((n,e)=>n+e.duration,0)}})()');
        navigation.push(row); save(`${label}-${mode}-navigation`, navigation);
        console.log(JSON.stringify({ label, mode, ...row }));
        if (!row.completed || row.renderedError || row.runtimeExceptions || row.consoleErrors || row.failedHttpResponses.length) helper.fail('NAVIGATION_FAILED');
      }
    }
    const cookie = session.cookie;
    await session.close(); session = null;
    await pause(1000);
    for (const [name, route, expected] of routes) for (let iteration = 0; iteration < 4; iteration++) {
      const offset = log.length, start = performance.now();
      const response = await fetch(`http://127.0.0.1:${port}${route}`, { headers: { host: `saga.localhost:${port}`, 'x-forwarded-host': `saga.localhost:${port}`, cookie }, signal: AbortSignal.timeout(90000) });
      const ttfbMs = performance.now() - start, body = await response.text(), completionMs = performance.now() - start;
      await pause(200);
      const segment = log.slice(offset), queries = [...segment.matchAll(/\[Audit query\] (\{[^\r\n]+\})/g)].map(m => JSON.parse(m[1]));
      const row = { route: name, iteration, ttfbMs, completionMs, sqlStatements: queries.length, queries, status: response.status, expectedContent: expected.every(t => body.toLowerCase().includes(t.toLowerCase())), streamedError: /data-dgst=|:E\{|Something went wrong while loading this page/.test(body), runtimeCodes: [...new Set(segment.match(/\bP\d{4}\b/g) || [])] };
      http.push(row); save(`${label}-${mode}-http`, http);
      console.log(JSON.stringify({ label, mode, route: name, iteration, completionMs: Math.round(completionMs), sql: queries.length }));
      if (response.status !== 200 || !row.expectedContent || row.streamedError || row.runtimeCodes.length) helper.fail('HTTP_FAILED');
    }
    if (label === 'after') session = await browser({ port, production, email: user.email, password });
    if (label === 'after') {
      await session.navigate({ name: 'Employees', route: '/dashboard/employees', expected: ['Employee Records'], sidebar: true });
      await session.navigate({ name: 'Employee Profile', route: '/dashboard/employees/' + employee.id, expected: ['Back to Employee Records'], sidebar: false });
      const tabs = [];
      for (const tab of ['probation', 'history', 'decisions', 'compliance', 'account', 'overview']) {
        const row = await session.navigate({ name: 'Profile ' + tab, route: '/dashboard/employees/' + employee.id + '?tab=' + tab, expected: ['Back to Employee Records'], sidebar: false });
        row.activeTab = await session.evaluate('document.querySelector("main a[aria-current=page]")?.getAttribute("href")?.endsWith('+JSON.stringify('?tab=' + tab)+')');
        tabs.push(row); save(`${label}-${mode}-profile-tabs`, tabs);
        if (!row.completed || !row.activeTab || row.renderedError || row.runtimeExceptions || row.consoleErrors || row.failedHttpResponses.length) helper.fail('PROFILE_TAB_FAILED');
      }
    }
    if (label === 'after') for (const [name, route, expected] of [
      ['Attendance', '/dashboard/attendance', ['Monthly Attendance']], ['Leave', '/dashboard/leave', ['Leave Management']], ['Payroll', '/dashboard/payroll', ['Payroll']], ['Analytics', '/dashboard/analytics', ['Workforce Overview']], ['Exit Management', '/dashboard/employees/exit', ['Separation cases']],
    ]) {
      const row = await session.navigate({ name, route, expected, sidebar: true });
      save(`${label}-${mode}-smoke-${name.replaceAll(' ', '-')}`, row);
      if (!row.completed || row.renderedError || row.runtimeExceptions || row.failedHttpResponses.length) helper.fail('SMOKE_FAILED');
    }
    if (label === 'after' && production) {
      await session.close(); session = null;
      const unlinked = await db.employee.findFirstOrThrow({ where: { organizationId: org.id, employeeStatus: 'ACTIVE', employeeAccount: null, employmentRecords: { some: {} } }, select: { id: true }, orderBy: { id: 'asc' } });
      essUser = await db.user.create({ data: { organizationId: org.id, email: `ux-ess-${randomBytes(12).toString('hex')}@audit.invalid`, name: 'ESS UX Measurement', role: 'EMPLOYEE', passwordHash: await hash(password, 10) }, select: { id: true, email: true } });
      essAccount = await db.employeeAccount.create({ data: { organizationId: org.id, userId: essUser.id, employeeId: unlinked.id, createdById: user.id, status: 'ACTIVE', activatedAt: new Date() }, select: { id: true } });
      session = await browser({ port, production, email: essUser.email, password, employeeLogin: true });
      const ess = await session.evaluate('({expected:/My Dashboard/i.test(document.querySelector("main")?.innerText||""),error:/Something went wrong while loading|Access Denied/.test(document.querySelector("main")?.innerText||"")})');
      save('after-production-ess', ess);
      if (!ess.expected || ess.error) helper.fail('ESS_FAILED');
    }
    save(`${label}-${mode}-conditions`, { mode, branch: config.identity.branchName, warmCycles: [1, 2, 3], firstCycleExcluded: true, readOnlyServer: true, normalLogin: true, serverCompileLines: log.split(/\r?\n/).filter(l => /Compiled|GET .*compile:/.test(l)).map(l => l.replace(/\/dashboard\/employees\/[^ ?]+/g, '/dashboard/employees/[id]')), runtimeCodes: [...new Set(log.match(/\bP\d{4}\b/g) || [])] });
  } finally {
    await session?.close();
    if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
    if (essAccount) await db.employeeAccount.delete({ where: { id: essAccount.id } });
    if (essUser) await db.user.delete({ where: { id: essUser.id } });
    if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect(); helper.assertOriginalUnchanged(config);
  }
}
measure(process.argv[2], process.argv[3]).catch(e => { console.error(JSON.stringify({ code: e.code || e.name, message: /^[A-Z_]+$/.test(e.message) ? e.message : undefined })); process.exitCode = 1; });
