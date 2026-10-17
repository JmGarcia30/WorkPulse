/* eslint-disable @typescript-eslint/no-require-imports -- Local Node evidence/report generator. */
const fs=require('node:fs');
const dir='docs/performance-audit/batch-2';
const read=n=>JSON.parse(fs.readFileSync(dir+'/'+n+'.json','utf8'));
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
const round=n=>Math.round(n*10)/10;
const pct=(b,a)=>round(100*(b-a)/b);
const before=read('before-http'),after=read('after-http'),beforeNav=read('before-navigation'),afterNav=read('after-navigation');
if([...before,...after].some(r=>r.status!==200||!r.expectedContent||r.streamedError||r.runtimeCodes.length))throw Error('PAGE_CHECK_FAILED');
if([...beforeNav,...afterNav].some(r=>!r.completed||r.documentRequests||r.renderedError||r.runtimeExceptions||r.failedHttpResponses.length))throw Error('NAVIGATION_CHECK_FAILED');
const names=[...new Set(before.map(r=>r.route))];
function stat(rows,time='ms',sql='sql'){
  if(!rows.length)throw Error('EMPTY_SAMPLES');
  return {samples:rows.length,ms:round(med(rows.map(r=>r[time]))),range:[round(Math.min(...rows.map(r=>r[time]))),round(Math.max(...rows.map(r=>r[time])))],sql:sql?med(rows.map(r=>r[sql])):null,sqlRange:sql?[Math.min(...rows.map(r=>r[sql])),Math.max(...rows.map(r=>r[sql]))]:null};
}
const routes=names.map(route=>{
  const b=before.filter(r=>r.route===route&&r.iteration>0),a=after.filter(r=>r.route===route&&r.iteration>0);
  if(b.length!==5||a.length!==5)throw Error('HTTP_SAMPLE_COUNT');
  return {route,before:stat(b,'completionMs','sqlStatements'),after:stat(a,'completionMs','sqlStatements'),beforeTtfb:round(med(b.map(r=>r.ttfbMs))),afterTtfb:round(med(a.map(r=>r.ttfbMs))),beforeInitialTtfb:round(before.find(r=>r.route===route&&r.iteration===0).ttfbMs),afterInitialTtfb:round(after.find(r=>r.route===route&&r.iteration===0).ttfbMs),beforeNav:stat(beforeNav.filter(r=>r.route===route),'navigationMs',null),afterNav:stat(afterNav.filter(r=>r.route===route),'navigationMs',null)};
});
const payroll=read('payroll-scale'),bootstrap=read('bootstrap'),foundation=read('payroll-foundation');
const scales=[5,50,100].map(size=>({size,before:stat(payroll.filter(r=>r.size===size&&r.iteration>0&&r.mode==='before')),after:stat(payroll.filter(r=>r.size===size&&r.iteration>0&&r.mode==='after'))}));
const brands=[false,true].map(branded=>({branded,before:stat(bootstrap.filter(r=>r.branded===branded&&r.iteration>0&&r.mode==='before')),after:stat(bootstrap.filter(r=>r.branded===branded&&r.iteration>0&&r.mode==='after'))}));
const foundationStats={before:stat(foundation.filter(r=>r.iteration>0&&r.mode==='before')),after:stat(foundation.filter(r=>r.iteration>0&&r.mode==='after'))};
const checks=read('final-checks'),preservation=read('data-preservation');
const suiteNames=['h10-1','h10-2','isolated-regressions','h10-interface','analytics','payroll-scalability','payroll-foundation-check','prisma-validation','typescript','production-build'];
const suites=suiteNames.map(read);
if(suites.some(s=>s.exitCode!==0)||!checks.eslintPassed||!checks.diffCheckPassed||preservation.changedProtectedTables.length||!preservation.originalEnvUnchanged)throw Error('VALIDATION_FAILED');
const nested=read('isolated-regressions');
for(const name of ['test:h10-1','test:h1','test:h2','test:h4','test:h5','test:h6','test:s1'])if(!nested.assertions.includes('REGRESSION '+name+': PASS'))throw Error('NESTED_SUITE_MISSING');
const summary={capturedAt:new Date().toISOString(),routes,scales,brands,foundation:foundationStats,suites:suites.map(s=>({name:s.name,exitCode:s.exitCode,elapsedMs:s.elapsedMs})),checks,preservation};
fs.writeFileSync(dir+'/summary.json',JSON.stringify(summary,null,2));
const http=routes.map(r=>`| ${r.route} | ${r.before.ms} | ${r.after.ms} | ${r.before.sql} [${r.before.sqlRange.join('-')}] | ${r.after.sql} [${r.after.sqlRange.join('-')}] | ${pct(r.before.ms,r.after.ms)}% | ${r.beforeTtfb} → ${r.afterTtfb} |`).join('\n');
const initialTtfb=routes.map(r=>`| ${r.route} | ${r.beforeInitialTtfb} | ${r.afterInitialTtfb} |`).join('\n');
const nav=routes.map(r=>`| ${r.route} | ${r.beforeNav.ms} [${r.beforeNav.range.join('-')}] | ${r.afterNav.ms} [${r.afterNav.range.join('-')}] | ${pct(r.beforeNav.ms,r.afterNav.ms)}% | 0 / 0 |`).join('\n');
const scaleTable=scales.map(r=>`| ${r.size} | ${r.before.ms} | ${r.after.ms} | ${r.before.sql} [${r.before.sqlRange.join('-')}] | ${r.after.sql} [${r.after.sqlRange.join('-')}] | ${pct(r.before.ms,r.after.ms)}% |`).join('\n');
const brandTable=brands.map(r=>`| ${r.branded?'Custom brand':'Default/no brand row'} | ${r.before.ms} | ${r.after.ms} | ${r.before.sql} | ${r.after.sql} |`).join('\n');
const regressions=routes.flatMap(r=>{
  const parts=[];
  if(r.after.ms>r.before.ms)parts.push(`${r.route} completion +${round(100*(r.after.ms/r.before.ms-1))}%`);
  if(r.afterTtfb>r.beforeTtfb)parts.push(`${r.route} TTFB +${round(100*(r.afterTtfb/r.beforeTtfb-1))}%`);
  if(r.afterNav.ms>r.beforeNav.ms)parts.push(`${r.route} browser navigation +${round(100*(r.afterNav.ms/r.beforeNav.ms-1))}%`);
  return parts;
});
const dashboard=routes.find(r=>r.route==='Dashboard'),large=scales.find(r=>r.size===100),brand=brands.find(r=>r.branded);
fs.writeFileSync(dir+'/REPORT.md',`# WORKPULSE PERFORMANCE OPTIMIZATION — BATCH 2

Implemented on the verified disposable workpulse-batch0-recovery branch. Production, the original .env, Vercel configuration, historical migrations and H10 business behavior were not changed. No deployment, new index or schema change.

## 1. Dashboard bottlenecks resolved

- Four attendance reads are now one grouped PostgreSQL aggregate over the union of the month/week date ranges. Returned groups are bounded by days/status/disposition, not employee-day history size.
- Active-employee and monthly new-hire counts now share one conditional aggregate.
- Existing bounded interviews, probation, payroll dates, approved leave, pipeline summaries, setup alerts and attention queues remain intact. All permissions and preview limits are unchanged.
- Cards keep their original, distinct predicates: Present Today includes every PRESENT row; donut/trend exclude APPROVED_LEAVE; monthly rate requires finalized NORMAL PRESENT/ABSENT/INCOMPLETE; weekly tardiness still uses its original broader status scope.
- Dashboard uses the already-resolved request branding/timezone instead of another organization read.

Dashboard warm SQL median: ${dashboard.before.sql} → ${dashboard.after.sql}. Completion: ${dashboard.before.ms} → ${dashboard.after.ms} ms. Complete serialized view-model parity passed for HR Admin, Organization Admin and Hiring Manager against the frozen prior implementation using populated H8 fixtures.

## 2. Payroll N+1 optimization

Review now groups applicable compensation counts by employee in one query. It retains organization scope, ACTIVE compensation status, effectiveFrom <= periodStart, inclusive effectiveTo >= periodEnd, uniqueness, snapshot identity, policy-version checks, Decimal equations and issue ordering. Employees without valid entries/snapshots do not introduce unnecessary compensation reads.

Payroll foundation reuses its already-loaded employees and entries for its read-only review. It preserves the previous foundation payload shape. The ordinary assessment wrapper and finalization path still reload their own inputs inside the existing finalization transaction; no cached page assessment can authorize finalization. No write transaction boundary, calculation formula, finalized entry, compensation snapshot or finalization safeguard was changed.

The 100-employee review median fell from ${large.before.ms} to ${large.after.ms} ms; SQL median fell from ${large.before.sql} to ${large.after.sql}. Generation's per-employee compensation/attendance/leave reads were inspected but left unchanged: preloading these mutable inputs outside a consistent transaction could change freshness semantics while generation writes entries. That requires a separate concurrency design. Recent-period trend aggregation was already batched and was retained.

## 3. Tenant bootstrap improvements

Slug-to-ID, organization and branding relation hydration are replaced by one parameterized organization/branding LEFT JOIN. Both ID and slug APIs preserve the prior branding view, defaults, colors, foregrounds, asset flags, timestamp, timezone and missing-tenant behavior.

React cache() remains render/request scoped. Shared layouts, organization settings, payroll slips and Dashboard reuse the resolved request brand, with an explicit organization-ID match. Arbitrary public careers lookups retain their independent ID-based read. There is no process-global authenticated cache or new private-data cache.

Persisted membership/role checks and uncached mutation authorization remain in place. Tenant host/path parsing and SAGA alias mapping are unchanged. Alternating SAGA/other-tenant Dashboard HTTP requests in one warm production server verify separate branding and exclude SAGA employee identifiers from the other tenant; existing role/tenant-forgery tests also pass.

Direct bootstrap benchmark (slug + organization/brand view, excluding JWT/membership), milliseconds:

| Fixture | Before ms | After ms | SQL before | SQL after |
|---|---:|---:|---:|---:|
${brandTable}

## 4. Files changed

Application:

- src/features/dashboard/read-model.ts
- src/features/payroll/review.ts; src/features/payroll/queries.ts
- src/features/organization-branding/data.ts (new); read-model.ts
- src/lib/tenant/server.ts
- src/app/(dashboard)/layout.tsx; src/app/(employee)/employee/layout.tsx
- src/app/(dashboard)/dashboard/organization/page.tsx
- src/app/(dashboard)/dashboard/payroll/payslips/[entryId]/page.tsx
- src/app/(employee)/employee/payroll/[entryId]/page.tsx

Validation:

- scripts/test-h8-analytics.ts: optional Batch 2 complete Dashboard parity checks; original H8 assertions retained.
- scripts/test-h10-interface.ts: four additional warm cross-tenant HTTP assertions; original H10 cases retained.
- scripts/test-batch2-payroll-scale.ts; batch2-performance.cjs; batch2-test-preload.cjs; summarize-batch2-performance.cjs (new).
- scripts/reference/batch2-*.ts: frozen prior implementations used only as regression oracles, never by application routes.
- docs/performance-audit/batch-2/*: sanitized measurements and results.

All Batch 0, Batch 1 and pre-existing uncommitted H10 work was preserved.

## 5. SQL query reduction

Counts include Prisma-emitted transaction/connection statements. Ranges retain occasional pool/control statements; instrumentation adds no SQL queries. Deterministic code savings are four Dashboard data statements, two bootstrap statements, and N individual compensation counts replaced by one group query. Payroll foundation also removes duplicated employee/entry hydration.

| Module | Before ms | After ms | SQL before | SQL after |
|---|---:|---:|---:|---:|
| Dashboard | ${dashboard.before.ms} | ${dashboard.after.ms} | ${dashboard.before.sql} | ${dashboard.after.sql} |
| Payroll Review, 100 synthetic employees | ${large.before.ms} | ${large.after.ms} | ${large.before.sql} | ${large.after.sql} |
| Tenant Bootstrap, custom brand | ${brand.before.ms} | ${brand.after.ms} | ${brand.before.sql} | ${brand.after.sql} |
| Payroll foundation, 5 synthetic employees | ${foundationStats.before.ms} | ${foundationStats.after.ms} | ${foundationStats.before.sql} | ${foundationStats.after.sql} |

Relevant navigation has its own browser timings below; SQL per click is Not measured because router prefetch/background requests prevent clean per-click attribution. Corresponding HTTP SQL budgets are measured separately.

## 6. Server response measurements

Local Windows/Node 24.18.0, Next 16.3.6, React 19.2.8, Prisma 6.19.3; production webpack server, normal password login, same recovery tenant/data and role. Six sequential HTTP samples per route, excluding iteration 0 from five-sample warm medians. All 96 before/after samples passed expected rendered-content and streamed-error checks. Login visits Dashboard first, so initial samples are not proven cold starts. No HTTP 200-only health claims.

All times in milliseconds. Reduction percentages are observed differences, not causal estimates or SLAs.

| Route | Before warm completion | After warm completion | SQL before [range] | SQL after [range] | Completion reduction | Warm TTFB before → after |
|---|---:|---:|---:|---:|---:|---:|
${http}

Initial TTFB/completion and every sample are retained in before-http.json/after-http.json. These new controlled baselines are used for percentages; earlier report values came from different runs/temporary account graphs and are context only.

First observed route TTFB (single post-login sample, not a proven cold start):

| Route | Before initial TTFB, ms | After initial TTFB, ms |
|---|---:|---:|
${initialTtfb}

## 7. Browser navigation measurements

Actual rendered sidebar links, headless Chrome 1440×1000, three cycles across all eight destinations per phase. No CPU/network throttling. Router/prefetch caches remain enabled. Click to last main-content mutation is accepted after 600 ms quiet, matching URL/content and no loading status; this is a content-settled proxy, not LCP/INP or browser paint time.

| Destination | Before median [range], ms | After median [range], ms | Observed reduction | Full-document requests before / after |
|---|---:|---:|---:|---:|
${nav}

All 48 transitions completed with expected content, zero runtime exceptions, no observed HTTP errors and zero full-document requests. Network request counts are recorded per transition in the raw navigation JSON. Changes come from server reads; no navigation UI hierarchy or sidebar redesign was introduced.

## 8. Payroll fixture scalability

Synthetic fixtures only, in a newly created schema on the testing branch; no additional SAGA employees. Same fixture read by old/new implementations in alternating order for six iterations; five warm samples per implementation are summarized. Full period, entries, issues, readiness and Decimal totals matched exactly on every pair. The fixture schema was removed afterward.

| Employees | Before warm median, ms | After warm median, ms | SQL before [range] | SQL after [range] | Observed time reduction |
|---|---:|---:|---:|---:|---:|
${scaleTable}

Additional parity checks cover partial/full compensation end boundaries, ineligible employees with entries, incomplete snapshots, mismatched amounts/status, missing entries and complete foundation payloads. The separate five-employee foundation benchmark repeats six pairs to quantify duplicate-input savings. Branding parity covers default/custom brands, two distinct tenants and unknown tenants.

The synthetic A/B run overlapped part of the separate regression/build activity, so absolute timings include shared-machine/database variance. Query scaling and result parity are the stronger evidence. HTTP/browser comparison passes run separately from builds/tests. This is not a concurrency or load-test result.

## 9. Regression test results

| Suite/check | Result |
|---|---|
| H1 Employee Core | PASS |
| H2 Employment/Probation | PASS |
| H4/H7 ESS | PASS |
| H5 Leave | PASS, including Batch 1 legacy-balance oracle |
| H6 Payroll | PASS, including finalization/immutability/tenant safeguards |
| H8 Analytics | PASS, 48 assertions including Dashboard parity |
| H10.1 | PASS, 85 checks |
| H10.2 | PASS, 59 checks |
| H10 interface | PASS, original cases plus four warm cross-tenant assertions |
| SaaS tenant isolation | PASS |
| Synthetic scale/foundation/branding parity | PASS |
| Prisma validation / TypeScript | PASS |
| Changed-file ESLint / git diff --check | PASS |

H1/H2/H4/H5/H6/S1 run through the existing H10 isolated-schema wrapper. H8 and new parity/scalability checks use their own disposable schemas. The test-only server-only marker adapter permits importing internal Dashboard functions with an injected fixture database/branding; it is not loaded by Next servers, changes no authorization function, and is never used for page/browser measurements. Expected P0001 negative-test rejections are not runtime errors.

The initial interface run passed all 19 existing workflows and the first SAGA cache assertion, then failed because the new test assumed /other path tenancy. The existing proxy supports the temporary /saga alias; other tenants use hostnames. The test was corrected to send the supported other.localhost host and rerun; application routing was not changed. The initial attempt remains in h10-interface-initial-routing-assumption.json.

Final protected-column fingerprints match across ${preservation.protectedTablesCompared} pre-existing public tables. Temporary benchmark users removed; original .env hash unchanged. H10 schema/checksums/triggers remain verified. Production was never selected for test writes. Standalone H3 was not run; H5 attendance integration and H8/Dashboard attendance parity were exercised.

## 10. Build results

Prisma validate PASS; standalone TypeScript PASS; production webpack build PASS (${round(read('production-build').elapsedMs/1000)} s). ESLint covers all Batch 2 changed/new code, including test/reference files. git diff --check PASS. No new dependency, index or deployment configuration.

## 11. Remaining performance issues

Observed increases: ${regressions.length?regressions.join('; '):'none in the measured medians'}. These remain visible rather than being discarded; sample ranges and router caches prevent attributing every change to code. Stable statement reductions and synthetic N-scaling improvements are confirmed; small latency differences within overlapping ranges remain uncertain.

Dashboard still loads its useful bounded operational previews and relation graphs. Generation remains per employee and needs a consistent-read/concurrency design before batching. Full history/configuration lists retain complete data. Fresh authorization and timezone reads required by individual services were not removed merely to lower counts.

Local development after-change, Vercel, cold starts, p95/p99, large populated Dashboard tenants and high concurrency: Not measured. Public clone has seven employees and sparse payroll; scalable payroll evidence comes from synthetic fixtures. No server-region/pool setting change is justified by this batch alone.

## 12. Recommended Batch 3

1. Profile and design payroll generation batching with explicit consistency and concurrent-compensation-change tests.
2. Test populated large-tenant Dashboard/attendance datasets and remaining relation hydration.
3. Evaluate history pagination without removing access to valid records.
4. Measure browser route feedback, inactive tabs and prefix-related redirects before narrow frontend changes.
5. Collect authorized Vercel and concurrency telemetry before changing deployment regions or pool settings.

Stopped after Batch 2. No Batch 3 implementation, production migration or deployment.

Evidence: summary.json; before/after-http.json; before/after-navigation.json; bootstrap.json; payroll-scale.json; payroll-foundation.json; per-suite JSON; final-checks.json; data-preservation.json. No credentials, cookies, HTTP bodies, raw SQL parameters or confidential employee/payroll records are saved.
`);
console.log(JSON.stringify({routes:routes.map(r=>({route:r.route,before:r.before.ms,after:r.after.ms,sqlBefore:r.before.sql,sqlAfter:r.after.sql,navBefore:r.beforeNav.ms,navAfter:r.afterNav.ms})),scales,brands,foundation:foundationStats},null,2));
