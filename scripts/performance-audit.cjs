// Diagnosis only: read-only database sessions; never stores credentials or response bodies.
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const directory = 'docs/performance-audit';
fs.mkdirSync(directory, { recursive: true });
const mode = process.argv[2] || 'inspect';
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('options', `${url.searchParams.get('options') || ''} -c default_transaction_read_only=on`.trim());
process.env.DATABASE_URL = url.toString();
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ log: [] });
const safeError = e => ({ code: e.code || e.name || 'Error' });
const round = n => Math.round(n * 10) / 10;
async function main() {
  if (mode === 'build') {
    await db.$disconnect();
    const begin = performance.now();
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', b => { output += b.toString(); });
    const code = await new Promise(resolve => child.on('exit', resolve));
    // Build output contains compilation diagnostics, never HTTP/DB response bodies.
    output = output.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]');
    fs.writeFileSync(`${directory}/build.txt`, output);
    console.log(JSON.stringify({ mode, code, elapsedMs: round(performance.now() - begin), output: output.slice(-7500) }));
    return;
  }
  const inspect = { node: process.version, next: require('next/package.json').version, pooledEndpoint: url.hostname.includes('-pooler.'), databaseRegionHint: url.hostname.match(/([a-z]+-[a-z]+-\d)\.(?:aws|azure|gcp)/)?.[1] || 'Not established', connectionParameters: [...url.searchParams.keys()], readOnly: true, selectOneMs: [] };
  for (let i = 0; i < 6; i++) { const start = performance.now(); await db.$queryRaw`SELECT 1`; inspect.selectOneMs.push(round(performance.now() - start)); }
  inspect.readOnlySetting = await db.$queryRaw`SHOW default_transaction_read_only`;
  inspect.h10Tables = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('EmployeeSeparationCase','EmployeeClearanceItem','EmployeeSeparationReview','EmployeeSeparationAudit') ORDER BY tablename`;
  inspect.h10Migrations = await db.$queryRaw`SELECT migration_name, finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied FROM "_prisma_migrations" WHERE migration_name LIKE '%h10_%'`;
  const columns = await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'`;
  const actual = new Set(columns.map(c => `${c.table_name}.${c.column_name}`));
  inspect.missingGeneratedColumns = require('@prisma/client').Prisma.dmmf.datamodel.models.flatMap(model => model.fields.filter(field => field.kind !== 'object' && !actual.has(`${model.dbName || model.name}.${field.dbName || field.name}`)).map(field => `${model.dbName || model.name}.${field.dbName || field.name}`));
  inspect.indexes = await db.$queryRaw`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('User','Organization','Application','Employee','EmploymentRecord','DailyAttendanceRecord','AttendanceEvent','PayrollEntry','EmployeeCompensation','LeaveRequest') ORDER BY tablename,indexname`;
  inspect.tableEstimates = await db.$queryRaw`SELECT relname,n_live_tup::int AS estimated_rows FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname`;
  const publicOrigin = process.env.PLATFORM_PUBLIC_ORIGIN;
  inspect.vercelOrigin = publicOrigin && new URL(publicOrigin).hostname.endsWith('.vercel.app') ? publicOrigin : null;
  fs.writeFileSync(`${directory}/database.json`, JSON.stringify(inspect, null, 2));
  if (mode === 'transaction') {
    const plan = await db.$queryRaw`EXPLAIN (ANALYZE, FORMAT JSON) SELECT "attendanceStatus", count(*) FROM "DailyAttendanceRecord" WHERE "organizationId"=(SELECT id FROM "Organization" WHERE slug='st-aloysius') AND "attendanceDate">=DATE '2026-10-01' AND "attendanceDate"<DATE '2026-11-01' GROUP BY "attendanceStatus"`;
    const root=plan[0]['QUERY PLAN'][0];
    function summarize(node){return {type:node['Node Type'],relation:node['Relation Name'],index:node['Index Name'],actualRows:node['Actual Rows'],actualTotalMs:node['Actual Total Time'],children:(node.Plans||[]).map(summarize)};}
    fs.writeFileSync(`${directory}/query-plan.json`,JSON.stringify({planningMs:root['Planning Time'],executionMs:root['Execution Time'],plan:summarize(root.Plan)},null,2));
    const trials=[];
    for(let trial=0;trial<3;trial++) {
      let completed=0;const begin=performance.now();let error=null;
      try { await db.$transaction(async tx=>{for(let i=0;i<90;i++){await tx.$queryRaw`SELECT 1`;completed++;}}); }
      catch(e){error=safeError(e);}
      trials.push({trial,completedReadOnlySelects:completed,elapsedMs:round(performance.now()-begin),error});
    }
    fs.writeFileSync(`${directory}/transaction.json`,JSON.stringify(trials,null,2));console.log(JSON.stringify(trials));return;
  }
  if (mode === 'inspect') { console.log(JSON.stringify(inspect, null, 2)); return; }
  const admin = await db.user.findFirst({ where: { role: { in: ['ORGANIZATION_ADMIN', 'HR_ADMIN'] }, organization: { slug: 'st-aloysius' } }, select: { id: true, email: true, name: true, role: true, organizationId: true } });
  if (!admin) throw Object.assign(new Error(), { code: 'NO_EXISTING_SAGA_ADMIN' });
  const self = await db.user.findFirst({ where: { organizationId: admin.organizationId, role: 'EMPLOYEE', employeeAccount: { status: 'ACTIVE', employee: { employeeStatus: 'ACTIVE' } } }, select: { id: true, email: true, name: true, role: true, organizationId: true } });
  const employee = await db.employee.findFirst({ where: { organizationId: admin.organizationId }, select: { id: true } });
  const { SignJWT } = await import('jose');
  const production = mode === 'prod' || mode === 'browser';
  const secret = process.env.SESSION_SECRET?.length >= 32 ? process.env.SESSION_SECRET : production ? require('node:crypto').randomBytes(48).toString('hex') : 'workpulse_development_only_session_secret_32bytes';
  async function token(user) { if (!user) return null; const { id, ...rest } = user; return new SignJWT({ ...rest, userId: id }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(secret)); }
  const adminToken = await token(admin), selfToken = await token(self);
  const port = production ? 3101 : 3100;
  const args = ['--require', './scripts/performance-audit-preload.cjs', 'node_modules/next/dist/bin/next', production ? 'start' : 'dev', ...(production ? [] : ['--webpack']), '-p', String(port), '-H', '127.0.0.1'];
  const child = spawn(process.execPath, args, { env: { ...process.env, NODE_ENV: production ? 'production' : 'development', SESSION_SECRET: secret, PLATFORM_ROOT_DOMAIN: `localhost:${port}`, PLATFORM_PUBLIC_ORIGIN: `http://localhost:${port}`, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let log = '', started = false;
  for (const stream of [child.stdout, child.stderr]) stream.on('data', b => { log += b.toString(); if (/Ready in/.test(log)) started = true; });
  const results = [];
  try {
    const deadline = Date.now() + 90000;
    while (!started && Date.now() < deadline && child.exitCode === null) await new Promise(r => setTimeout(r, 200));
    if (!started) throw Object.assign(new Error(), { code: 'SERVER_NOT_READY' });
    const routes = [ ['Dashboard','/dashboard'], ['Hiring','/dashboard/hiring/pipeline'], ['Applicants','/dashboard/hiring/applicants'], ['Employee Records','/dashboard/employees'], ...(employee ? [['Employee Profile',`/dashboard/employees/${employee.id}`]] : []), ['Attendance','/dashboard/attendance'], ...(employee ? [['Attendance selected employee',`/dashboard/attendance?employeeId=${employee.id}`]] : []), ['Leave','/dashboard/leave'], ['Payroll','/dashboard/payroll'], ['Analytics','/dashboard/analytics'], ['ESS','/employee'], ['Exit Management','/dashboard/employees/exit'] ];
    for (const [name,path] of (mode === 'browser' ? [] : routes)) {
      if (name === 'ESS' && !selfToken) { results.push({ route: name, status: 'Not measured: no existing active ESS account' }); continue; }
      for (let iteration = 0; iteration < 4; iteration++) {
        const logStart = log.length, start = performance.now();
        try {
          const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { host: `saga.localhost:${port}`, 'x-forwarded-host': `saga.localhost:${port}`, cookie: `${production ? '__Host-workpulse_session' : 'workpulse_session'}=${name === 'ESS' ? selfToken : adminToken}` }, redirect: 'manual', signal: AbortSignal.timeout(90000) });
          const ttfb = performance.now() - start;
          const body = await response.text();
          const total = performance.now() - start;
          await new Promise(r => setTimeout(r, 150));
          const segment = require('node:util').stripVTControlCharacters(log.slice(logStart));
          const timings = [...segment.matchAll(/\[WorkPulse timing\] ([^:\r\n]+): ([\d.]+)ms/g)].map(m => ({ label: m[1], ms: Number(m[2]) }));
          const queryMetrics = [...segment.matchAll(/\[Audit query\] (\{[^\r\n]+\})/g)].map(m => JSON.parse(m[1]));
          const row = { route: name, iteration, status: response.status, ttfbMs: round(ttfb), completeMs: round(total), responseBytes: Buffer.byteLength(body), sqlLogCount: production ? null : (segment.match(/prisma:query/g) || []).length, timings, runtimeErrorCodes: [...new Set(segment.match(/P\d{4}/g) || [])], nextTiming: [...segment.matchAll(/(?:compile|render|proxy):\s*[^)\r\n]+/g)].map(m => m[0]), redirect: response.headers.get('location') ? 'redirected' : false, streamedError: /"digest":|NEXT_HTTP_ERROR_FALLBACK/.test(body) };
          results.push(row);
          row.queryMetrics = queryMetrics;
          row.sqlLogCount = queryMetrics.length || row.sqlLogCount;
          row.dbQueryDurationSumMs = queryMetrics.length ? queryMetrics.reduce((sum, q) => sum + q.ms, 0) : null;
          if (iteration === 3) console.log(JSON.stringify({ mode, route: name, status: row.status, completeMs: row.completeMs, queries: row.sqlLogCount, errors: row.runtimeErrorCodes }));
        } catch(e) { results.push({ route: name, iteration, error: safeError(e), elapsedMs: round(performance.now() - start) }); console.log(JSON.stringify(results.at(-1))); }
        fs.writeFileSync(`${directory}/${mode}.json`, JSON.stringify(results,null,2));
      }
    }
    if (production) {
      try { await require('./performance-audit-browser.cjs')({ port, token: adminToken, directory }); }
      catch(e) { fs.writeFileSync(`${directory}/browser.json`, JSON.stringify({ error: safeError(e) })); }
    }
  } finally { child.kill(); }
}
main().catch(e => { console.error(JSON.stringify(safeError(e))); process.exitCode = 1; }).finally(() => db.$disconnect());
