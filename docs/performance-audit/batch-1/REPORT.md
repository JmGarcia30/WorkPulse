# WORKPULSE PERFORMANCE OPTIMIZATION — BATCH 1 REPORT

Implemented and validated on workpulse-batch0-recovery only. No deployment, production migration, original .env edit, Vercel edit, schema/index change or business-rule change.

## 1. Bottlenecks fixed

- ESS leave balances: four statements per tracked type/cycle replaced by three batched reads total (ledger SUM, pending SUM/count, default grants). Empty tracked sets skip the ledger/grant reads.
- ESS dashboard: reads only its most recent leave request and finalized payslip; pending count still covers ALL pending requests, including inactive types and closed/no cycles. Full history screens retain complete access.
- ESS dashboard attendance: selects only the four fields needed for monthly indicators, avoiding relation hydration needed by the separate attendance screen.
- ESS profile: employee/current employment and schedule reads run concurrently.
- Payslip lists: select snapshot/period summary fields; no longer load employee employment histories just to discard them. Detailed payslips still resolve effective-dated history.
- Analytics: three overlapping attendance totals combined into one conditional SQL aggregate; the top-five ranking remains a separate bounded grouped query. Attendance reads fall from four to two.
- Analytics persisted actor/timezone validation uses one parameterized joined query instead of relation hydration. Default unfiltered cohort loading overlaps independent aggregates.
- Layout/Analytics/Dashboard share one React-render-scoped back-office context. Mutation guard remains uncached.

## 2. Files modified

Application:

- src/features/leave/read-model.ts
- src/features/employee-self-service/read-model.ts
- src/features/payroll/payslip.ts
- src/features/analytics/read-model.ts
- src/features/analytics/queries.ts
- src/lib/auth/guards.ts
- src/app/(dashboard)/layout.tsx
- src/app/(dashboard)/dashboard/page.tsx
- src/app/(dashboard)/dashboard/analytics/page.tsx
- src/app/(employee)/employee/page.tsx

Validation/tooling:

- scripts/test-h4-employee-self-service.ts (bounded preview/history assertions)
- scripts/test-h5-leave-management.ts (legacy equivalence assertions)
- scripts/test-h8-analytics.ts (create historical fixtures before separation, preserving H10 guards)
- scripts/assert-batch1-leave-equivalence.ts (new independent pre-change query oracle)
- scripts/batch1-performance.cjs / summarize-batch1-performance.cjs (new)
- scripts/batch0-recovery-browser.cjs (optional normal ESS login support; default recovery behavior preserved)
- docs/performance-audit/batch-1/* (sanitized evidence)

Pre-existing H10/schema/package/sidebar/account/leave-service/RBAC work was preserved. Historical migrations were not edited.

## 3. ESS correctness and query details

Ledger and pending sums remain PostgreSQL Decimal aggregates and use the original conversion/arithmetic. Pending-null detection is COUNT(*) minus COUNT(requestedUnits). Default grants remain uniquely keyed per employee/type/cycle. The same projection condition, eligibility status, approved debits, reversals, pending deductions and remaining-balance formula are retained.

The H5 oracle executes the prior per-cycle queries against the same transaction snapshot and compares every balance field exactly. It also compares bounded/full pending totals and previews across projection, reversal, multiple-cycle and foreign-tenant fixtures. H4 verifies two pending requests with only one rendered preview, latest finalized payroll, complete historical access, and existing disabled/inactive-account denial checks. Equal submittedAt request timestamps now have a deterministic ID tie-breaker, so bounded/full histories agree.

Payroll access still performs its own persisted active-account, employee-status, role and tenant checks. Both entry and period must be finalized with a finalization timestamp. Snapshot completeness and employee/period identity validation are shared with the detailed payslip path. Payroll calculations, snapshots and historical employment records were not changed.

## 4. Analytics correctness

Conditional aggregates retain distinct predicates: recorded/status totals, finalized NORMAL PRESENT/ABSENT/INCOMPLETE denominator, and NORMAL positive-lateness counts excluding REST_DAY/NO_SCHEDULE. Approved leave remains excluded where required. The separate top-five query retains its original ordering and counts; its limit does not truncate total occurrences.

Current employment still determines category filters. Empty cohorts become AND FALSE. Tenant conditions apply to attendance and joined employees. Workforce, leave, currency-separated finalized payroll and conversion formulas remain unchanged. H8 covers expected populated values, timezone/date boundaries, category filters, empty tenants/ranges, top-five totals, forged roles/tenants and no attendance mutation. Hiring source queries were not rewritten; H1 conversion regressions also passed.

## 5. Authentication and tenant scope

getBackOfficeReadContext uses React cache() for one render pass, following the installed Next.js authentication guide. It delegates to the existing guard, including JWT, request-tenant, persisted role and membership checks. Layout, Analytics page/query and Dashboard page reuse it. requireBackOfficeContext remains uncached for mutations; no mutation call site was switched to the rendering helper.

No process-global authenticated cache, use-cache directive or persistent HR/payroll cache was added. Existing request-scoped tenant/branding caches remain intact. getSession still verifies cookies freshly on uncached guard calls; it has no SQL itself. The serial tenant slug/branding bootstrap and ESS payroll revalidation were left intact rather than weakening their contracts for this batch.

## 6. Before-and-after SQL query counts

Medians and ranges from five warm requests. SQL includes transaction-control/connection statements emitted by the instrumentation.

| Route | Before SQL median [range] | After SQL median [range] | SQL median reduction |
|---|---:|---:|---:|
| ESS | 27 [27-29] | 22 [22-30] | 18.5% |
| Analytics | 20 [20-30] | 16 [16-24] | 20% |
| Dashboard | 28 [28-29] | 28 [28-29] | 0% |

## 7. Before-and-after response times

Fresh controlled comparison, milliseconds; medians of FIVE warm requests after one excluded initial request per route. SQL includes transaction-control/connection statements emitted by the instrumentation.

| Route | Before completion | After completion | Observed time reduction |
|---|---:|---:|---:|
| ESS | 1430.2 | 1331.4 | 6.9% |
| Analytics | 1554.3 | 1145 | 26.3% |
| Dashboard (control) | 1463 | 1288.9 | 11.9% |

| Route | Before TTFB median | After TTFB median | Before warm completion range | After warm completion range |
|---|---:|---:|---:|---:|
| ESS | 1429.1 | 1330 | 1294.8-1703 | 1063.6-1940.5 |
| Analytics | 454.2 | 584.1 | 991.7-2471.2 | 889.8-1221.5 |
| Dashboard | 664.1 | 594.3 | 762.1-2057.9 | 1025.3-1526.1 |

These are observed differences, not a causal estimate or an SLA. Dashboard is a control: its guard calls already often batched in Prisma, so a large timing change without a query reduction should be treated as database/network variance.

ESS's modest timing change is not clearly separable from that variance; its reduced SQL workload is demonstrated more strongly than a reliable latency gain. Occasional larger SQL ranges contain extra statements with no named application table in the captured metadata; these are retained in totals rather than discarded as outliers. The application-table read patterns remain stable.

Observed regressions: Analytics warm TTFB increased from 454.2 to 584.1 ms (+28.6%) despite faster full completion. ESS's slowest warm sample increased from 1703 to 1940.5 ms despite its lower median. These remain visible in the evidence; this small, variable sample does not establish a persistent code-caused regression or prove a reliable ESS latency improvement.

Conditions: local Windows, Node 24.18.0, Next 16.3.6/React 19.2.8/Prisma 6.19.3, production webpack builds, port 3101, same recovery-branch tenant and deterministic employee selection. Two temporary normal-login users and one temporary account linked to an otherwise unlinked active employee were used in both passes and removed afterward. Existing users, passwords, employees and histories were not edited. Password authentication and real server-issued cookies were used; no forged sessions. Page connections were read-only. Browser closed before HTTP sampling; no builds/tests ran during either measurement pass.

The older audit values (ESS ~1990 ms/30-31 SQL, Analytics ~1953 ms/20-22 SQL; recovered Dashboard ~1007 ms/29 SQL) used different identities/runs and are context only. Percentages above use the new controlled baseline, not those historical values. Initial samples are post-login, not proven cold starts. Complete rendered-content and streamed-error checks passed for every recorded sample; HTTP 200 alone was not accepted. SQL statement sums are not PostgreSQL-only execution time.

Local development after-change timing: Not measured. Vercel: Not measured. Batch 1 browser navigation timing: Not measured; existing Batch 0 browser results are preserved. Small samples and a seven-employee clone do not establish large-tenant or p95 behavior. Public payroll remains sparse/empty; populated payroll and leave correctness was exercised in isolated integration fixtures.

## 8. Regression results

| Required check | Result |
|---|---|
| npm run test:h1 | PASS, nested isolated regression command |
| npm run test:h2 | PASS, nested isolated regression command |
| npm run test:h4 / ESS integration | PASS, including new bounded-history assertions |
| npm run test:h5 | PASS, including exact legacy balance equivalence |
| npm run test:h6 | PASS |
| npm run test:h10-1 | PASS, 85 checks |
| npm run test:h10-2 | PASS, 59 checks |
| npm run test:s1 | PASS |
| npm run test:h8 | PASS, 44 populated Analytics integration assertions |
| H10 HTTP/interface | PASS, 19 checks |
| TypeScript | PASS |
| ESLint on all Batch 1 modified/new code files | PASS |
| git diff --check | PASS |

H1/H2/H4/H5/H6/S1 execute through the existing H10 isolated-schema regression wrapper. H8 has its own temporary schema with the existing migrations replayed. Fixture schemas are created and removed only on the authorized disposable branch; no existing schema is reset. Expected P0001 trigger rejections in negative tests are not runtime failures.

An initial new ESS fixture attempted overlapping pending leave dates and was correctly rejected by LeaveRequest_no_active_overlap. The fixture was corrected to use separate dates and ESS passed a targeted isolated rerun. The original failed wrapper artifact and successful retry are both retained; the other passing suites were not needlessly repeated.

The older H8 fixture also inserted employment after marking a fixture employee SEPARATED, which H10 correctly rejects. Its history is now created while active and retained unchanged after separation; expected attendance totals explicitly include that historical day (four finalized PRESENT / six finalized workdays = 66.7%). An intermediate attempt to move the historical day was also rejected; no guard was disabled. H8 then passed. The first interface run overlapped a build and lacked BUILD_ID; it was rerun after the completed build. Initial failure artifacts remain available.

Final data fingerprints: 46 pre-existing public tables unchanged, using the original protected-column projection. H10 migrations/checksums/columns/triggers remain verified. Temporary benchmark identities removed. Production and Vercel configuration untouched.

## 9. Build result

Production webpack build PASS (52.2 seconds); TypeScript PASS. See production-build.json and typescript.json. No new dependency or index was introduced.

## 10. Remaining bottlenecks and regression risks

Remote database/pool/network variance remains visible in sample ranges. Tenant slug/branding resolution still precedes the authenticated content. ESS account validation and payroll authorization intentionally remain separate persisted reads. Full history pages still return complete histories; converting them to pagination needs a dedicated UI/access review. Dashboard still has a broad query fan-out. Payroll review/generation per-employee queries are outside this batch.

Standalone H3 tests were not run in this batch; the requested suite list, H5 attendance integration and H8 attendance metrics were exercised.

The most sensitive changes are leave aggregate equivalence, Analytics conditional denominators/cohort filters, and request-scoped authorization boundaries. Integration tests pass, but larger populated tenants and concurrent traffic still need testing. No unproven index or cross-user caching change was made.

## 11. Recommended Batch 2

1. Reduce Dashboard aggregate fan-out, with populated attendance/leave fixture parity tests.
2. Batch payroll review/generation lookups while preserving effective dates and short write transactions.
3. Measure populated large-tenant histories; add pagination where the UI can retain complete access.
4. Evaluate shared tenant/branding bootstrap reads and browser route-transition behavior after these server changes.
5. Collect authorized deployment/Vercel and concurrency measurements before tuning regions or connection pools.

Stopped after Batch 1. No Batch 2 implementation or deployment performed.

Evidence: before-http.json, after-http.json, before-conditions.json, after-conditions.json, summary.json, per-suite JSON, data-preservation.json, final-checks.json. Credentials, cookies, raw SQL parameters and confidential record bodies are not saved.
