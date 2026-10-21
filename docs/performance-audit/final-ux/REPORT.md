# WORKPULSE — FINAL USER-EXPERIENCE PERFORMANCE REPORT

October 20, 2026. Implemented locally against the verified `workpulse-batch0-recovery` branch. No push, deployment, production modification, database reset, original `.env` edit, migration change or dependency change.

## 1. Why the system still felt slow

The strongest remaining bottleneck was Employee Profile's default Overview loading data for every inactive tab. It fetched probation decision actors, decision/status audit histories, ESS account details and accepted offers before showing Overview. Remote round trips accumulated even though these records were not displayed.

Development compilation adds a separate, substantial delay. First-observed Profile navigation was 6,218 ms before and 5,293 ms after, versus warm local-production medians of 1,970 and 996 ms. These first development visits are excluded from improvement calculations.

Dashboard still hydrates several useful relation chains. Two employee alert categories independently loaded employees and their latest departments. Hiring unnecessarily waited for the job selector before starting its unfiltered application read.

## 2. Development versus production findings

Four destinations were measured: Profile, Hiring, Dashboard and the unchanged Employee Directory as a control. Each phase/mode used one excluded navigation cycle followed by three warm cycles, and one excluded HTTP request followed by three warm HTTP requests per destination. Separate headless Chrome sessions used normal password login, the same recovery tenant/role, a 1440×1000 viewport, no throttling and normal router caches. Browser sessions were closed before HTTP/SQL sampling. No build or regression suite overlapped the final browser measurement runs.

Browser time is click to the last main-content DOM mutation, accepted only after matching content/URL, no visible loading status and 600 ms of quiet. The quiet interval is not added to the reported time. This is a content-settled proxy, not LCP or INP. HTTP completion measures receipt of the complete streamed response, including local transport; it is not isolated server CPU time. TTFB alone cannot establish page completion. Three warm samples do not establish p95 or an SLA.

Development still incurs framework/rendering overhead and typically recorded two RSC resources per warm transition versus one in production. Development instrumentation/build mode is not production telemetry. No Vercel timing was collected.

## 3. Confirmed bottlenecks and exclusions

| Area | Finding |
|---|---|
| Development compilation | Multi-second first visits; excluded from warm comparisons. Development remains slower after these fixes. |
| Server/data loading | Profile's unused histories and Hiring's default read dependency confirmed in code; Profile's completion improvement exceeds observed ranges. Dashboard alert hydration reduced. |
| PostgreSQL execution versus connection latency | Three warm `SELECT 1` calls took 77–80 ms through the pooled connection. A bounded employee query executed in PostgreSQL in 0.037–0.052 ms, with 0.093–0.099 ms planning. This small probe demonstrates round-trip overhead, not the execution cost of every HR query. |
| Authorization/tenant resolution | Existing request-scoped caches retained. Production route samples showed one persisted User validation and one organization/branding bootstrap read, not an authorization loop. Mutation guards remain uncached. |
| Client rendering/hydration | After-change warm production transitions downloaded no new JavaScript and recorded zero browser tasks exceeding 50 ms. Content settlement closely followed the RSC response. Initial-login hydration was not separately benchmarked. |
| Route transitions/remounts | Zero full-document requests in the measured module transitions and tab checks. No evidence justified a router/layout rewrite. This does not prove that every child component retains its local state. |
| JavaScript bundles | No demonstrated warm-navigation bundle bottleneck; no speculative component splitting added. |
| Loading feedback | Profile lacked its own loading boundary. Added one without delaying ready content or bypassing authorization/errors. Its first-feedback latency was not separately measured. |

Evidence: `*-navigation.json`, `*-http.json`, `summary.json`, and `latency-and-preservation.json`. SQL duration events include driver/connection effects and must not be presented as PostgreSQL execution-only timings.

## 4. Optimizations implemented

1. **Profile:** load detailed probation, decision/status and account histories only for the active tab. Keep the complete employment history needed to select the effective record and calculate existing badges. Database counts retain exact decision/status badges. Accepted offers load for Compliance. Requested detail reads run alongside the common profile read, with their own tenant predicates. The default service call still returns the complete history. Existing full-history access and lifecycle permissions remain available.
2. **Profile feedback:** add a route-specific loading boundary using the existing spinner component. No interface redesign.
3. **Dashboard:** replace two employee lists plus their department relations with one parameterized statement. Each category retains its ACTIVE/eligibility predicates, ten-row bound and role visibility. A scalar lateral lookup keeps the prior latest-effectiveFrom department rule. One invocation-local promise supplies both lists. No persistent cache or additional serial query stage.
4. **Hiring:** overlap job selector/application reads for the default unfiltered pipeline. Filtered requests still validate the requested job against the organization's jobs before loading applications. Unknown/foreign job IDs retain the existing unfiltered fallback within the authenticated organization.
5. **Payroll feedback:** while `useActionState` is pending, show an explicit processing status, mark the form busy and lock its period selector. Replace stale results from the previous invocation until the new result returns. Success, setup issues and errors remain visible afterward. No fabricated percentage, early completion, background job infrastructure or calculation change.

All Batch 1–3 query, Decimal, attendance, tenant-bootstrap and authorization optimizations remain in place. No global authenticated HR cache was introduced.

## 5. Files changed

Application:

- `src/features/employees/queries.ts`
- `src/app/(dashboard)/dashboard/employees/[employeeId]/page.tsx`
- `src/app/(dashboard)/dashboard/employees/[employeeId]/loading.tsx` (new)
- `src/features/dashboard/read-model.ts`
- `src/features/dashboard/employee-alerts.ts` (new)
- `src/app/(dashboard)/dashboard/hiring/pipeline/page.tsx`
- `src/components/payroll/PayrollSetupForms.tsx`

Tests and measurement tooling:

- `scripts/test-h1-employee-core.ts`, `scripts/test-h2-employment-probation.ts`, `scripts/test-h8-analytics.ts`
- `scripts/assert-final-ux-profile.ts`, `scripts/test-final-ux-hiring.cjs`, `scripts/test-final-ux-payroll-state.cjs` (new)
- `scripts/final-ux-performance.cjs`, `scripts/final-ux-validation.cjs`, `scripts/final-ux-latency.cjs`, `scripts/summarize-final-ux.cjs` (new)
- `scripts/batch0-recovery-browser.cjs`: optional diagnostics access, console-error counting, query-string navigation checks and visible-loading detection; existing callers preserved.
- `scripts/reference/final-ux-employees.ts`, `scripts/reference/final-ux-dashboard.ts`: frozen pre-sprint implementations for regression oracles; never imported by application routes.
- `docs/performance-audit/final-ux/*`: sanitized evidence and this report.

## 6. Before-and-after browser and response times

Milliseconds: warm median [minimum–maximum], three samples per cell.

### Local production

| Route | Browser before → after | HTTP completion before → after | Assessment |
|---|---|---|---|
| Employee Profile | 1,970 [1,832–2,080] → 996 [992–1,071] | 941 [934–1,019] → 522 [519–523] | 49.4% faster browser median; 44.5% faster completion. Both ranges separate. Strongest measured improvement. |
| Hiring | 678 [622–713] → 362 [310–531] | 348 [345–365] → 516 [283–525] | Browser median improved 46.6%, but HTTP median increased 48.3%. No consistent server-time improvement claimed. |
| Dashboard | 1,312 [866–1,346] → 1,095 [595–1,185] | 1,054 [1,053–1,320] → 830 [757–1,092] | Observed medians lower; overlapping ranges mean improvement remains within measured variance. |
| Employee Directory, unchanged control | 942 [858–977] → 998 [909–1,204] | 558 [540–594] → 639 [602–682] | Measured slowdown retained. Unchanged query path; no Directory gain claimed. Shows cross-run variation. |

Production median TTFB: Profile 190 → 191 ms; Hiring 191 → 190 ms; Dashboard 339 → 337 ms; Directory 175 → 191 ms. Profile's main gain is completion of useful content, not initial streamed bytes.

### Local development

| Route | Browser before → after | HTTP completion before → after | Assessment |
|---|---|---|---|
| Employee Profile | 2,850 [2,159–3,306] → 2,106 [1,675–2,358] | 1,198 [1,173–1,221] → 989 [981–1,003] | Navigation ranges overlap; completion ranges separate. Development still slower than production. |
| Hiring | 1,501 [1,403–1,875] → 1,529 [1,409–1,665] | 989 [976–1,038] → 1,059 [1,039–1,171] | No development speedup established. |
| Dashboard | 1,777 [1,269–2,418] → 1,886 [1,506–2,066] | 1,330 [1,262–1,622] → 1,712 [1,491–1,740] | Browser ranges overlap; completion median regressed 28.7% despite fewer queries. Do not claim a development latency win. |
| Employee Directory, unchanged control | 1,433 [1,182–1,502] → 1,549 [1,387–1,996] | 884 [876–923] → 962 [918–1,028] | No change to this route; no speedup claimed. |

Payroll's change concerns pending-state correctness. Its page passed browser rendering/navigation checks in both modes, but a comparable pre-change Payroll page timing was not collected in this sprint. No Payroll page or generation latency claim is made.

## 7. Before-and-after database queries

Warm route counts include tenant/bootstrap/authentication work. Data-statement counts exclude emitted statements without table references, such as connection probes and transaction controls. Raw counts remain in the evidence.

| Route | Data statements before → after, both modes | Production total emitted median [range] before → after |
|---|---:|---|
| Employee Profile | 14 → 8 | 14 [14–14] → 8 [8–9] |
| Dashboard | 23 → 20 | 23 [23–37] → 20 [20–20] |
| Hiring | 6 → 6 | 6 [6–6] → 6 [6–6] |
| Employee Directory, unchanged | 7 → 7 | 9 [9–9] → 9 [9–10] |

Profile saves six data statements on this fixture; Dashboard saves three. Hiring changes dependency ordering rather than SQL count. The 37-statement Dashboard sample contained 23 table-bearing reads plus connection/control statements, not 37 HR reads. No per-click SQL attribution is claimed because browser prefetch can overlap route requests; these counts come from separate HTTP samples.

## 8. Attendance and payroll processing

Inspected the current service paths. Attendance still uses one bounded Serializable transaction per employee/day, with the Batch 3 retry/atomicity protections. Payroll still reads fresh inputs and performs a guarded entry create per employee. Removing that sequential work safely requires additional consistency/concurrency validation. Neither service was changed in this sprint; deadlines were not increased.

Historical Batch 3 results, **not remeasured here**: nine employee-days approximately 8.5 s; payroll 5/50/100 employees approximately 1.5/11.8/27.1 s. These remain known slow areas. Decimal formulas, snapshots, effective dates, finalized records, idempotency, audit history and leave balances were not modified. Payroll processing feedback is verified separately from processing speed.

## 9. Regression/build results

- PASS: H1 Employee Core, 22 existing assertions, plus complete/default and six-tab payload parity against the frozen implementation and foreign-tenant denial checks.
- PASS: H2 Employment/Probation, 24 existing assertions, plus the same parity checks on historical/inactive employment data.
- PASS: H8 Analytics, 48 assertions, including complete Dashboard view-model parity for Organization Admin, HR Admin and Hiring Manager. Tests use populated isolated fixtures.
- PASS: targeted Hiring default/filtered query-order and tenant-filter regression.
- PASS: actual PayrollGenerationForm rendered with pending/success/error action states. Stale success is absent while pending; controls lock; returned errors and setup details remain visible.
- PASS: TypeScript, Prisma validation and local production webpack build (74,209 ms).
- PASS: changed/new-file ESLint and `git diff --check`.
- PASS: both-mode browser navigation/content checks for Dashboard, Directory, Profile, Hiring, Attendance, Leave, Payroll, Analytics and Exit Management; all six Profile tabs. Production ESS Dashboard also passed normal password login through a temporary recovery-only employee account.
- Zero runtime exceptions, rendered error boundaries, failed HTTP responses or full-document navigations in the successful measured transitions/tab checks. After-change browser checks recorded zero console errors. The before harness recorded exceptions/HTTP failures but did not separately count all console errors.
- PASS: original `.env` hash matches the prior baseline; all 46 protected public-table fingerprints match. Temporary login users/accounts were removed. Historical fingerprint column projections exclude the later H10-added column, as in previous batches.

Initial verification caught test-helper typing/import issues; they were corrected before the successful TypeScript check/build. An initial development after-run failed in the optional browser diagnostic collector. Its partial samples are preserved in `after-development-initial-attempt.json` and excluded from summary statistics. The collector was hardened and the complete development rerun passed. No application runtime failure was established from that harness error.

No complete H1–H10 QA rerun was claimed. Service calculations and mutations outside the changed read/UI paths retain previous regression coverage and need comprehensive functional testing next.

## 10. Remaining slow areas

- Development first compilation and additional framework work remain visible. Warm development Dashboard completion regressed in these samples; fewer SQL statements do not guarantee faster end-to-end response.
- Dashboard retains other bounded hiring/employee relation previews and remote-query fan-out. Its production latency improvement is not established beyond variance.
- Hiring's browser and HTTP results disagree; repeat a small controlled check during functional testing before promising a server improvement. Its full board still loads all matching applications.
- Large Profile histories still load when their tab is requested; common employment history and compliance badge data remain available to preserve exact behavior.
- Attendance and payroll generation remain long-running at scale. No throughput improvement is claimed for them in this sprint.
- Remote connection latency, larger populated tenants, sustained contention, p95/p99, initial-login hydration and deployment-environment behavior remain uncharacterized here.

## 11. Readiness for comprehensive functional testing

**Ready to begin comprehensive functional testing on the verified local recovery branch.** The clearest user-facing improvement is Profile, with a smaller Dashboard query budget and an independently parallel Hiring path. All changed paths passed targeted regression/build and browser checks. This is not a production performance or full functional sign-off; keep the known processing delays and mixed timing results in the test plan.

Stopped after this sprint. Owned measurement servers were stopped. No push, deployment or subsequent feature work was started.
