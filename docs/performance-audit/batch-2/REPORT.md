# WORKPULSE PERFORMANCE OPTIMIZATION — BATCH 2

Implemented on the verified disposable workpulse-batch0-recovery branch. Production, the original .env, Vercel configuration, historical migrations and H10 business behavior were not changed. No deployment, new index or schema change.

## 1. Dashboard bottlenecks resolved

- Four attendance reads are now one grouped PostgreSQL aggregate over the union of the month/week date ranges. Returned groups are bounded by days/status/disposition, not employee-day history size.
- Active-employee and monthly new-hire counts now share one conditional aggregate.
- Existing bounded interviews, probation, payroll dates, approved leave, pipeline summaries, setup alerts and attention queues remain intact. All permissions and preview limits are unchanged.
- Cards keep their original, distinct predicates: Present Today includes every PRESENT row; donut/trend exclude APPROVED_LEAVE; monthly rate requires finalized NORMAL PRESENT/ABSENT/INCOMPLETE; weekly tardiness still uses its original broader status scope.
- Dashboard uses the already-resolved request branding/timezone instead of another organization read.

Dashboard warm SQL median: 29 → 23. Completion: 1213.8 → 1150.7 ms. Complete serialized view-model parity passed for HR Admin, Organization Admin and Hiring Manager against the frozen prior implementation using populated H8 fixtures.

## 2. Payroll N+1 optimization

Review now groups applicable compensation counts by employee in one query. It retains organization scope, ACTIVE compensation status, effectiveFrom <= periodStart, inclusive effectiveTo >= periodEnd, uniqueness, snapshot identity, policy-version checks, Decimal equations and issue ordering. Employees without valid entries/snapshots do not introduce unnecessary compensation reads.

Payroll foundation reuses its already-loaded employees and entries for its read-only review. It preserves the previous foundation payload shape. The ordinary assessment wrapper and finalization path still reload their own inputs inside the existing finalization transaction; no cached page assessment can authorize finalization. No write transaction boundary, calculation formula, finalized entry, compensation snapshot or finalization safeguard was changed.

The 100-employee review median fell from 8828.3 to 674.4 ms; SQL median fell from 108 to 8. Generation's per-employee compensation/attendance/leave reads were inspected but left unchanged: preloading these mutable inputs outside a consistent transaction could change freshness semantics while generation writes entries. That requires a separate concurrency design. Recent-period trend aggregation was already batched and was retained.

## 3. Tenant bootstrap improvements

Slug-to-ID, organization and branding relation hydration are replaced by one parameterized organization/branding LEFT JOIN. Both ID and slug APIs preserve the prior branding view, defaults, colors, foregrounds, asset flags, timestamp, timezone and missing-tenant behavior.

React cache() remains render/request scoped. Shared layouts, organization settings, payroll slips and Dashboard reuse the resolved request brand, with an explicit organization-ID match. Arbitrary public careers lookups retain their independent ID-based read. There is no process-global authenticated cache or new private-data cache.

Persisted membership/role checks and uncached mutation authorization remain in place. Tenant host/path parsing and SAGA alias mapping are unchanged. Alternating SAGA/other-tenant Dashboard HTTP requests in one warm production server verify separate branding and exclude SAGA employee identifiers from the other tenant; existing role/tenant-forgery tests also pass.

Direct bootstrap benchmark (slug + organization/brand view, excluding JWT/membership), milliseconds:

| Fixture | Before ms | After ms | SQL before | SQL after |
|---|---:|---:|---:|---:|
| Default/no brand row | 254 | 85.4 | 3 | 1 |
| Custom brand | 252.6 | 86.3 | 3 | 1 |

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
| Dashboard | 1213.8 | 1150.7 | 29 | 23 |
| Payroll Review, 100 synthetic employees | 8828.3 | 674.4 | 108 | 8 |
| Tenant Bootstrap, custom brand | 252.6 | 86.3 | 3 | 1 |
| Payroll foundation, 5 synthetic employees | 1493.2 | 813.2 | 21 | 13 |

Relevant navigation has its own browser timings below; SQL per click is Not measured because router prefetch/background requests prevent clean per-click attribution. Corresponding HTTP SQL budgets are measured separately.

## 6. Server response measurements

Local Windows/Node 24.18.0, Next 16.3.6, React 19.2.8, Prisma 6.19.3; production webpack server, normal password login, same recovery tenant/data and role. Six sequential HTTP samples per route, excluding iteration 0 from five-sample warm medians. All 96 before/after samples passed expected rendered-content and streamed-error checks. Login visits Dashboard first, so initial samples are not proven cold starts. No HTTP 200-only health claims.

All times in milliseconds. Reduction percentages are observed differences, not causal estimates or SLAs.

| Route | Before warm completion | After warm completion | SQL before [range] | SQL after [range] | Completion reduction | Warm TTFB before → after |
|---|---:|---:|---:|---:|---:|---:|
| Dashboard | 1213.8 | 1150.7 | 29 [29-30] | 23 [23-23] | 5.2% | 679.4 → 352.6 |
| Hiring | 422.8 | 431.7 | 8 [8-10] | 6 [6-8] | -2.1% | 418.3 → 183.5 |
| Employees | 611.9 | 577.9 | 11 [11-11] | 9 [9-9] | 5.6% | 358.4 → 181.2 |
| Attendance | 378 | 342.2 | 8 [8-8] | 6 [6-6] | 9.5% | 376.5 → 189.2 |
| Leave | 631.3 | 513.6 | 9 [9-10] | 7 [7-8] | 18.6% | 367.9 → 265.1 |
| Payroll | 599.7 | 363.8 | 9 [9-11] | 7 [7-7] | 39.3% | 428.2 → 201.8 |
| Analytics | 1058.3 | 866.2 | 16 [16-17] | 14 [14-16] | 18.2% | 357.7 → 188 |
| Exit Management | 959 | 787.5 | 11 [11-12] | 9 [9-9] | 17.9% | 368.1 → 194.4 |

Initial TTFB/completion and every sample are retained in before-http.json/after-http.json. These new controlled baselines are used for percentages; earlier report values came from different runs/temporary account graphs and are context only.

First observed route TTFB (single post-login sample, not a proven cold start):

| Route | Before initial TTFB, ms | After initial TTFB, ms |
|---|---:|---:|
| Dashboard | 692.2 | 376.5 |
| Hiring | 511.1 | 188.7 |
| Employees | 361.9 | 180.3 |
| Attendance | 361 | 206 |
| Leave | 522 | 347.3 |
| Payroll | 444.9 | 187 |
| Analytics | 364.2 | 289.6 |
| Exit Management | 486 | 280.2 |

## 7. Browser navigation measurements

Actual rendered sidebar links, headless Chrome 1440×1000, three cycles across all eight destinations per phase. No CPU/network throttling. Router/prefetch caches remain enabled. Click to last main-content mutation is accepted after 600 ms quiet, matching URL/content and no loading status; this is a content-settled proxy, not LCP/INP or browser paint time.

| Destination | Before median [range], ms | After median [range], ms | Observed reduction | Full-document requests before / after |
|---|---:|---:|---:|---:|
| Dashboard | 1183 [975-1773] | 1084 [691-1485] | 8.4% | 0 / 0 |
| Hiring | 838 [720-1018] | 768 [717-1339] | 8.4% | 0 / 0 |
| Employees | 986 [924-1004] | 952 [952-1019] | 3.4% | 0 / 0 |
| Attendance | 389 [189-425] | 386 [194-406] | 0.8% | 0 / 0 |
| Leave | 1299 [877-1311] | 855 [456-993] | 34.2% | 0 / 0 |
| Payroll | 617 [617-894] | 388 [366-623] | 37.1% | 0 / 0 |
| Analytics | 1111 [987-2098] | 717 [670-853] | 35.5% | 0 / 0 |
| Exit Management | 1770 [1323-2537] | 1244 [1142-1472] | 29.7% | 0 / 0 |

All 48 transitions completed with expected content, zero runtime exceptions, no observed HTTP errors and zero full-document requests. Network request counts are recorded per transition in the raw navigation JSON. Changes come from server reads; no navigation UI hierarchy or sidebar redesign was introduced.

## 8. Payroll fixture scalability

Synthetic fixtures only, in a newly created schema on the testing branch; no additional SAGA employees. Same fixture read by old/new implementations in alternating order for six iterations; five warm samples per implementation are summarized. Full period, entries, issues, readiness and Decimal totals matched exactly on every pair. The fixture schema was removed afterward.

| Employees | Before warm median, ms | After warm median, ms | SQL before [range] | SQL after [range] | Observed time reduction |
|---|---:|---:|---:|---:|---:|
| 5 | 894.3 | 487.8 | 12 [12-12] | 8 [8-8] | 45.5% |
| 50 | 4881 | 736.1 | 58 [57-58] | 8 [8-8] | 84.9% |
| 100 | 8828.3 | 674.4 | 108 [107-108] | 8 [8-9] | 92.4% |

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

Final protected-column fingerprints match across 46 pre-existing public tables. Temporary benchmark users removed; original .env hash unchanged. H10 schema/checksums/triggers remain verified. Production was never selected for test writes. Standalone H3 was not run; H5 attendance integration and H8/Dashboard attendance parity were exercised.

## 10. Build results

Prisma validate PASS; standalone TypeScript PASS; production webpack build PASS (85.6 s). ESLint covers all Batch 2 changed/new code, including test/reference files. git diff --check PASS. No new dependency, index or deployment configuration.

## 11. Remaining performance issues

Observed increases: Hiring completion +2.1%. These remain visible rather than being discarded; sample ranges and router caches prevent attributing every change to code. Stable statement reductions and synthetic N-scaling improvements are confirmed; small latency differences within overlapping ranges remain uncertain.

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
