# WORKPULSE FULL SYSTEM PERFORMANCE AUDIT

Batch 1 — diagnosis only. Measured locally on 17 October 2026, Windows, Node 24.18.0, Next.js 16.3.6, React 19.2.8, Prisma 6.19.3. Repository: JmGarcia30/WorkPulse, including the existing uncommitted H10 work.

## 1. Executive summary

There are several distinct problems; the evidence does not support blaming Neon alone.

1. **Confirmed blocking schema mismatch:** `neondb/public` has none of the four H10 tables and lacks `ProbationRecord.closedBySeparationCaseId`. The latter breaks existing Dashboard, Employee Records, and Employee Profile reads with `P2022`. A streamed HTTP 200 is not evidence of a successful page render. Exit Management cannot receive a successful baseline until its schema is available.
2. **Confirmed development compilation cost:** the development trace records **15.386 seconds compiling `/dashboard`**. Its first instrumented request completed in 26.127 seconds. Production does not have this on-demand development compilation step.
3. **Confirmed production request overhead:** healthy warm HTTP responses still take approximately **1.99 seconds for ESS**, **1.95 seconds for Analytics**, and **1.02 seconds for Applicants**, using medians of three warm samples. These pages issue substantial numbers of SQL statements despite a small database.
4. **Confirmed round-trip cost and query multiplication:** warm `SELECT 1` measurements were approximately 66–76 ms across probe runs. Analytics issued 20–22 SQL statements and ESS 30–31 per warm request. Code contains payroll per-employee queries and four leave-balance queries per tracked type/cycle.
5. **Confirmed sidebar client navigation works:** 18 actual sidebar clicks across six routes produced zero document requests. Some transitions still take over a second because the destination data is slow. The sidebar itself is not causing a full reload on these measured transitions.
6. **P2028 mechanism reproduced safely:** three read-only interactive transactions expired after 5.03–5.65 seconds, completing 71–73 sequential trivial queries. This demonstrates the effect of the default transaction deadline and network round trips, but is not a reproduction of the historical H3 business operation.

No application source, business logic, schema, or deployment configuration was changed. No migrations, seeds, business actions, payroll generation, or finalized-record mutations were run. Only audit scripts and diagnostic artifacts were added.

## 2. Measured performance baseline

### Conditions and interpretation

- Local webpack development server on port 3100; local production server on port 3101. Servers were benchmarked separately, without concurrent builds during route measurements.
- Four sequential authenticated HTML GETs per route: first request plus three warm requests. Two development passes were collected; the tables use the second, instrumented pass consistently. Production has one four-request pass per route.
- Existing SAGA back-office and active ESS identities were used through short-lived sessions signed only in memory for the local audit. Login/password verification was not benchmarked.
- PostgreSQL connections were configured with `default_transaction_read_only=on`; the inspection connection confirmed that setting. No fixture schema or test data was created.
- **TTFB** measures response headers/first response availability. **Complete** measures reading the entire streamed HTML response. Neither is browser first paint or React CPU time.
- Warm figures are medians of three samples; ranges show all three. These small samples do not support meaningful p95/p99 claims.
- First route requests share a server process and a database already contacted by the inspection probe. They are **not proven Neon compute cold starts or Vercel cold starts**.
- SQL counts come from Prisma query events and include transaction-control statements where emitted. Failed renders can leave concurrent operations finishing after the error. Counts on failed routes are diagnostic ranges, not successful-work budgets.

### Production HTTP baseline

All times below are milliseconds. “Initial” means the first request to that route in this local production process.

| Route | Initial TTFB | Initial complete | Warm TTFB median | Warm complete median [range] | Warm SQL count | Main bottleneck / outcome |
|---|---:|---:|---:|---:|---:|---|
| Dashboard `/dashboard` | 1,947.1 | 2,623.2 | 747.5 | 833.0 [766.5–907.8] | 25–31 | **Failed render, P2022**; broad dashboard fan-out |
| Hiring `/dashboard/hiring/pipeline` | 690.3 | 693.8 | 324.4 | 327.6 [327.1–331.0] | 8 | Tenant/auth chain, sequential jobs then applications |
| Applicants `/dashboard/hiring/applicants` | 376.0 | 1,175.1 | 547.7 | 1,021.2 [910.3–1,414.2] | 12 | Relation hydration and data fetch after shell |
| Employee Records `/dashboard/employees` | 742.8 | 788.8 | 310.4 | 544.8 [509.3–827.0] | 11 | **Failed render, P2022** |
| Employee Profile `/dashboard/employees/[employeeId]` | 326.5 | 738.1 | 302.2 | 377.6 [363.2–802.0] | 9–11 | **Failed render, P2022**; full history query |
| Attendance `/dashboard/attendance` | 315.4 | 390.6 | 336.8 | 349.7 [308.7–456.2] | 8 | Organization and employee filter options; no employee selected |
| Attendance, selected employee | 270.1 | 1,134.7 | 299.9 | 777.5 [462.5–961.0] | 12 | Additional sequential detail/date/event reads |
| Leave `/dashboard/leave` | 337.4 | 849.5 | 311.1 | 832.9 [527.2–848.3] | 9 | All-request overview and relation reads |
| Payroll `/dashboard/payroll` | 298.4 | 524.1 | 322.3 | 547.9 [478.4–548.0] | 9 | Foundation queries; **no populated payroll period to exercise review** |
| Analytics `/dashboard/analytics` | 330.2 | 1,549.0 | 690.9 | 1,953.2 [1,400.6–2,039.0] | 20–22 | Repeated actor reads, sequential cohort setup, aggregate fan-out |
| ESS `/employee` | 1,755.3 | 1,756.2 | 1,988.1 | 1,989.5 [1,917.4–2,454.6] | 30–31 | Account/profile/schedule/leave/payslip orchestration |
| Exit `/dashboard/employees/exit` | 469.5 | 1,041.6 | 308.7 | 730.3 [719.0–825.8] | 10–11 | **Unavailable schema; error-path timing only** |

For the four unavailable routes, successful-page response time is **Not measured**. The timings above measure their failing/error response paths. HTTP 200 was returned for these streamed responses; it must not be treated as a successful functional check.

### Development comparison

| Route | Initial complete, ms | Warm complete median, ms | Warm range, ms |
|---|---:|---:|---:|
| Dashboard, failed render | 26,127.4 | 1,106.1 | 786.3–1,323.3 |
| Hiring | 3,416.2 | 905.2 | 893.3–1,133.0 |
| Applicants | 2,591.6 | 1,191.6 | 1,180.6–1,282.4 |
| Employee Records, failed render | 2,711.8 | 746.2 | 746.0–853.6 |
| Employee Profile, failed render | 4,937.8 | 876.6 | 847.5–1,017.6 |
| Attendance | 2,671.3 | 784.1 | 756.9–952.9 |
| Attendance, selected employee | 1,506.2 | 1,103.3 | 1,101.0–1,484.4 |
| Leave | 2,984.5 | 958.6 | 950.3–1,147.3 |
| Payroll, empty period state | 3,242.1 | 978.7 | 913.9–1,193.7 |
| Analytics | 3,104.1 | 1,909.0 | 1,489.2–2,338.7 |
| ESS | 4,323.3 | 1,484.9 | 1,377.5–2,103.3 |
| Exit, error path | 2,911.9 | 1,158.0 | 1,085.5–1,170.5 |

Production did not beat every development sample; remote database variance is visible. Avoid attributing every difference to the bundler.

### Browser sidebar navigation

Headless local Chrome, production mode, 1440×1000 viewport, no CPU/network throttling. Three cycles in one browser session. Time is click to last observed main-content DOM mutation, accepted after 600 ms without further main-content mutations and with no loading status present. It is an approximate content-settled measure, **not LCP, INP, or a paint metric**. Browser prefetch/router caches remain enabled, so revisits can be much faster.

| Destination | Three samples, ms | Median, ms | Network requests per click | Document requests |
|---|---|---:|---|---:|
| Applicants | 1,835 / 1,520 / 1,211 | 1,520 | 11 / 3 / 3 | 0 |
| Attendance | 749 / 322 / 174 | 322 | 7 / 3 / 3 | 0 |
| Leave | 1,190 / 1,054 / 823 | 1,054 | 4 / 3 / 3 | 0 |
| Payroll | 1,352 / 891 / 748 | 891 | 5 / 3 / 3 | 0 |
| Analytics | 2,936 / 1,424 / 1,088 | 1,424 | 4 / 3 / 3 | 0 |
| Hiring | 18 / 15 / 585 | 18 | 3 / 3 / 3 | 0 |

Dashboard, Employee Records/Profile, ESS, and Exit client navigation: **Not measured**. Their HTTP measurements are separate. These are not isolated uncached-navigation trials. The 15–18 ms Hiring revisits reflect cached/streamed behavior and must not be generalized to a first visit.

The initial 10-second Hiring capture observed 51 network requests, 11 script responses and 181,578 bytes transferred for completed script requests. This window includes background prefetching, assets and aborted fetches; 51 is **not** the number of required navigation requests or a confirmed duplication bug. Each measured transition completed without a detected error UI or HTTP ≥400 response.

### Database and server timing

- Initial inspection: first `SELECT 1` 3,267.6 ms; subsequent calls 66.2, 66.7, 66.4, 66.2 and 67.2 ms. Later process-first connections were around 0.7–0.8 seconds. The reason for the 3.27-second initial connection is **not isolated** between connection/TLS setup, compute wake-up and other startup work.
- Instrumented production warm median **sum of Prisma statement durations**: Hiring 544 ms, Applicants 1,308 ms, Analytics 2,964 ms, ESS 4,493 ms. Parallel queries overlap: these sums can exceed the request duration and include round-trip/engine overhead. They are **not PostgreSQL CPU time** and must not be subtracted from response time to calculate React cost.
- A representative October attendance aggregate used the existing organization/date/status index via an index-only scan. PostgreSQL planning was 0.167 ms; execution 0.078 ms. It matched **zero rows**, so this only verifies the empty-range plan and does not establish populated-range or large-tenant performance.
- React-only server render CPU, per-route database-server execution time, lock wait attribution and pool wait attribution: **Not measured**. Framework trace spans include waiting and cannot provide that separation.

## 3. Slowest routes

Among successful warm production HTTP requests: **ESS (1.990 s), Analytics (1.953 s), Applicants (1.021 s), Leave (0.833 s), selected-employee Attendance (0.778 s)**.

Among measured sidebar clicks, Applicants and Analytics have the largest medians. Analytics had the slowest individual click, 2.936 seconds. The largest development first request was Dashboard, 26.127 seconds, ending in a schema error. Broken pages should be repaired before their performance ranking is interpreted.

## 4. Database bottlenecks

**Payroll — confirmed query patterns, populated-period cost not measured.** `src/features/payroll/queries.ts:9` loads all employees, compensation history, periods, policies and leave types for every tab. When a period exists, it fetches entries, then calls `assessPayrollPeriod()`, which fetches employees and entries again. `src/features/payroll/review.ts:76–103` performs an awaited compensation count for each employee whose entry passes preliminary checks. For N qualifying employees this adds N sequential statements. At a 70 ms illustrative round trip, 100 counts alone imply roughly seven seconds; this is an estimate, not a measured payroll workload. Payroll generation also sequentially reads compensation, attendance and leave and writes an entry per employee (`service.ts:152` onward); generation was not executed.

**ESS leave — confirmed query multiplication.** `src/features/leave/read-model.ts:15` runs four statements per balance-tracked type/cycle: ledger aggregate, pending aggregate, default-grant lookup and pending-uncalculated count. These are parallel promises, not a single batched database operation. The measured ESS page emitted 30–31 statements. The dashboard also obtains full leave requests and all finalized payslips only to show a latest item (`employee-self-service/read-model.ts:86`, `payroll/payslip.ts:135`). There are no payroll entries in the inspected database estimates, so the latter scaling cost is not exercised.

**Analytics — confirmed repeated validation and query fan-out.** The page calls the guard, `getAnalytics()` calls it again, and `readAnalytics()` performs another actor lookup. Three SQL statements involving User were observed in every warm request. The employee/cohort read precedes ten aggregate/read operations. Attendance status/finalized/tardiness aggregates overlap in data scope; any consolidation must preserve the different denominator and category rules. Payroll aggregation is already performed in SQL; replacing it with raw record loading would be a regression.

**Dashboard — broad fan-out plus failed query.** `src/features/dashboard/read-model.ts:184–499` launches 19 top-level operations, with relation expansion producing more SQL. Some attendance counts/groups overlap. This path currently fails on the missing probation field, so neither its query budget nor its apparent response time is a healthy baseline.

**Pagination and histories.** Applicants already paginate at nine rows; Employee Records paginate and cap included employment records; Exit has pagination but is unavailable. The hiring pipeline, job list, leave-admin overview, employee filter options, employee histories, compensation/policy/period history and employee payslip list have unbounded reads. Full relations are frequently loaded even when only a subset is displayed. Current database-wide catalog estimates are small: 7 employees, 22 applications, 77 daily attendance records and no payroll periods/entries. These are approximate estimates, not tenant-specific exact counts. Large-table scanning is therefore not demonstrated as the present primary cause.

**Indexes.** The live catalog contains relevant tenant/date attendance, tenant/employee/event-time, tenant/payroll-period/employee, tenant/status leave and employee-compensation indexes. No missing or ineffective index was proven to be the principal bottleneck. Candidate future plans to evaluate include Employee `(organizationId,lastName,firstName,id)` for ordered directories and EmploymentRecord `(employeeId,effectiveFrom)` for current/history reads. Existing indexes, row counts, write overhead and realistic query plans must be checked before adding either. Do not add indexes simply because a small table uses a sequential scan.

## 5. Authentication and tenant-resolution findings

- Root layout is a small server component. Dashboard layout validates the back-office context and awaits branding before returning the shell. Proxy handles host/path routing and cookie presence; it does **not** perform Prisma queries or cryptographic session verification.
- `getSession()` verifies the signed JWT locally and does not itself query the database. It is not request-cached. `requireBackOfficeContext()` also is not cached and checks the persisted user and tenant membership.
- `resolveRequestTenant()`, `getOrganizationBrandingBySlug()` and `getOrganizationBranding()` **already use React `cache()`**. Repeated layout/page branding calls are not automatically repeated database loads in one server-render request.
- Tenant bootstrap still performs a serial slug→organization-id lookup followed by organization/branding reads. Normal request traces show two Organization statements and one OrganizationBranding statement. Attendance/Analytics may separately retrieve organization timezone.
- Repeated guard calls do **not** imply the same number of SQL round trips: Prisma batched the concurrent identical `findUnique` checks into one User SQL statement for Dashboard, Applicants, Leave and Payroll. Request-scoped guard caching is still appropriate for duplicate JWT/context work, but promising a database-query reduction on all those routes would be inaccurate.
- Analytics does perform three User statements. ESS already caches `requireEmployeeSelfContext()`, but the payslip path independently checks active account/employee membership; measured SQL includes User twice, including relation predicates. Reuse requires a trusted scoped read API, not bypassing payroll authorization.

Recommended cache boundary: request-scoped memoization of session and trusted context with role, persisted membership and tenant checks preserved. **No process-global user/tenant context cache, no shared authenticated HR/payroll cache.** Mutation authorization must remain fresh within its transaction. React request memoization should not be assumed to deduplicate unrelated server actions or route-handler requests.

## 6. Navigation and React rendering findings

The sidebar uses `next/link`, `usePathname()` and tenant-prefix helpers. Its section buttons expand menus; child links navigate. All measured browser clicks used these actual links and preserved client-side navigation. The sidebar does not call `router.refresh()` or poll. A small extra effect update on pathname change is visible in code but is not a measured bottleneck.

Loading UI exists at `(dashboard)/loading.tsx`, and Hiring Pipeline and Interviews also have route loading files. This is not a system with no loading states. However, many sibling modules lack a nearby loading boundary; a common ancestor boundary alone does not guarantee immediate module-specific feedback on every retained-layout transition. Shell authorization awaits and page-wide read models can postpone useful content.

Other findings:

- Ordinary `<form method="GET">` searches in hiring, employee filters and attendance perform browser form navigation. The measured sidebar behavior does not eliminate those separate document navigations. Converting them to framework Form/client navigation could preserve the shell without changing filtering rules.
- Several internal Hiring/ESS/Payroll links and `router.push()` targets use bare `/dashboard` or `/employee` paths. On temporary path-tenancy deployments, the proxy can redirect these back to `/saga/...`, adding a hop. Sidebar links already preserve the prefix. This is code evidence; the Vercel redirect cost was **not measured**.
- Nineteen `router.refresh()` call sites exist. Most follow explicit mutations and are not evidence of a navigation loop. `CandidateOnboardingSection.tsx:105` is a special case: it invokes a synchronization server action on mount and conditionally refreshes. Development Strict Mode/remounts can repeat the action. Its frequency and cost were **not measured**; applicant detail was intentionally not opened in the browser to avoid that business action.
- Applicant detail statically imports its tab tree. Its built page chunk is 204,143 bytes, or 37,123 bytes using offline gzip. Payroll is 60,431 / 12,522 bytes; Leave 35,599 / 6,776; Pipeline 27,129 / 7,581. These exclude shared chunks and are not full route transfer sizes. Candidate detail/tab/modal splitting is a reasonable P2 experiment.
- Charts use custom SVG; no heavyweight chart package is present in the dependency list. No evidence was found that Gemini, document parsing or PDF parsing is being downloaded as shared sidebar JavaScript. Dependency presence alone does not establish client bundle inclusion.
- Some components, such as the employee filter wrapper, are marked client despite largely rendering markup. Reducing such boundaries may help marginally; hydration CPU and avoidable re-render time were **not measured**.
- TenantLogo bypasses Next image optimization for local/API sources. `/api/branding/[kind]` resolves tenant/branding again and retrieves the asset, with `private,max-age=300`. This is an additional HTTP request with its own cache scope. Original image dimensions and decode cost were **not measured**; do not rank this above the database findings.

## 7. Next.js / Vercel findings

The installed framework guides for caching without Cache Components, navigation, Link and local development were read. This app has no `cacheComponents` configuration; authenticated routes use cookies/headers and are dynamic in the successful build output. Prisma results are not automatically cached by Next's fetch cache. Request cache deduplication is different from cross-request page caching.

`package.json` explicitly uses webpack for both development and build. Trace compilation spans include Dashboard 15.386 s, Employee Profile 2.909 s, Pipeline 2.075 s, Payroll 1.717 s, ESS 1.700 s and Attendance 1.540 s. This confirms meaningful local on-demand compilation overhead. Test Turbopack compatibility and timing before recommending a switch; no bundler/configuration was changed.

The successful production webpack build took **45.621 seconds total**, including **11.2 s compilation** and **3.9 s TypeScript**. All protected routes were marked dynamic. Production `next start` was then benchmarked; it does not run development route compilation per request.

The first audit-runner build inherited `NODE_ENV=development` from its preloaded environment and failed prerendering. It is retained as `build-environment-failure.txt` for transparency. The runner was corrected to explicitly use production, and the build passed. **That contaminated build is not classified as an application build defect.** Standard Next CLI normally assigns its command environment before loading `.env`; no environment file was edited.

The configured database uses a **Neon pooler endpoint**. Its hostname indicates **AWS ap-southeast-1**, an inferred region identifier rather than a provider-console verification. The Prisma module uses a global development singleton and a module-level production instance; it does not create a client inside every query. No explicit pool limit, connect timeout or transaction override is configured. Per-instance serverless pool multiplication remains a deployment hypothesis, not a demonstrated leak.

No usable Vercel origin, deployment credentials/log access, deployment-region configuration or local `.vercel` project linkage was found in the inspected configuration. **Vercel was not measured.** Its region, cold starts, function CPU/memory, pool waits and real-user latency remain **Not measured**. Before any regional change, obtain the actual function region and correlate function/SQL timing with the Neon region. Local database RTT is not evidence of Vercel-to-Neon RTT.

## 8. H3 transaction timeout analysis

Prisma's installed runtime types document default interactive transaction `maxWait=2000 ms`, `timeout=5000 ms`. The application does not override those globally. The H3 fixture at `scripts/test-h3-attendance.ts:74` runs many sequential creates, reads, materializations, savepoints and assertions in one default-timeout transaction. That fixture was **not executed**, because it writes application data and toggles triggers elsewhere in the script.

Safe read-only probes, all using default transaction options:

| Trial | Completed sequential SELECTs | Total elapsed, ms | Result |
|---|---:|---:|---|
| 1 | 73 | 5,029.2 | P2028 |
| 2 | 71 | 5,645.1 | P2028 |
| 3 | 72 | 5,052.7 | P2028 |

This confirms that accumulated round trips can exhaust the deadline even with trivial SQL and no competing audit transaction. It does not prove that the old H3 error had the same exact statement or cause; its original trace was unavailable. External database load was not controlled, and pool acquisition/lock waits were not independently measured.

`materializeAttendancePeriod()` currently uses one short employee-selection transaction and then **one Serializable transaction per employee per day**, awaited sequentially. It does not put the entire period into a single transaction. Inside each day, organization, employment, schedule with relations, events, correction, optional leave and upsert operations introduce many round trips. Consequently:

- The historical long fixture is a credible timeout risk.
- Current period evaluation is O(days × employees) in transaction count and query work, so it can be slow even if individual transactions stay below five seconds.
- A cold connection, added relation reads, lock contention or concurrent work could consume the remaining per-day deadline; their contribution to the original error remains unproven.
- Increasing a timeout alone does not remove the query pattern. Batch 2 should profile an isolated fixture, batch immutable inputs where safe, preserve per-day atomicity/Serializable correctness and consider bounded conflict retries only where idempotency is established.
- The initial actor/employee read-only transaction may be unnecessary for some semantics, but removing it requires a consistency/authorization review. Likewise, the H10 list transaction deliberately keeps count and page in one snapshot; it should not be called unnecessary simply because it is a read.

## 9. Confirmed bugs discovered

**Confirmed runtime bug:** generated Prisma expectations exceed the live schema. The missing probation column produces `P2022` on existing routes. Both H10 migrations remain absent and all four H10 tables are unavailable. This explains broken existing pages and H10 unavailability, not all latency on healthy pages.

**Confirmed operational diagnostic gap:** streamed error responses can carry HTTP 200. Status-only checks would falsely report these pages healthy. Functional content/error-boundary checks and server error telemetry are needed.

**Reproduced failure mechanism, not a new proven H3 business bug:** default interactive transactions expire with enough sequential remote round trips. The original H3 failure was not replayed.

No sidebar refresh loop, cross-tenant data leak, missing critical index, client-side AI bundle leak, production build failure or Vercel cold-start defect was confirmed.

## 10. Prioritized P0 / P1 / P2 issues

Estimates below are hypotheses for Batch 2 validation, not promised improvements. “Risk” refers to implementing the proposed fix.

| Issue | Severity | Affected modules | Supporting measurement / code evidence | Likely root cause and certainty | Recommended fix | Regression risk | Expected improvement — estimate |
|---|---|---|---|---|---|---|---|
| schema mismatch breaks existing pages and H10 | **P0** | Dashboard, Employees, Profile, Exit | P2022; catalog lacks probation field and four H10 tables; migrations absent | **Confirmed** generated-client/schema mismatch | Review coordinated schema/client rollout and explicit compatible projections; handle H10 unavailability. Apply no migration until separately authorized | High: schema, constraints, lifecycle | Restore usable pages; speed percentage not applicable |
| broad ESS read fan-out | **P1** | ESS dashboard, leave, payroll summary | 30–31 SQL; 1.990 s warm; four queries per tracked type/cycle | **Confirmed** query multiplication; individual contributions not isolated | Group ledger/pending reads, reuse trusted context, fetch latest payslip directly, paginate histories | Medium/high: entitlement and account-scope semantics | Reduce balance reads from 4C toward a small fixed number; latency gain requires A/B measurement |
| repeated actor/cohort reads and aggregates | **P1** | Analytics | 20–22 SQL; 1.953 s warm; three User statements | **Confirmed** repeated validation plus sequential prerequisites; exact cost split unmeasured | Request-cache trusted context, preserve raw-helper authorization contract, consolidate compatible aggregates | Medium/high: HR metrics/security | Approximately 70–200 ms for removed serial validation work at local RTT; larger aggregate gain unquantified |
| payroll review N+1 and duplicate hydration | **P1** | Payroll populated periods | review.ts:76–103; queries.ts reloads employees/entries through review | **Confirmed pattern**, populated-period runtime not measured | Batch effective-compensation counts and share request-local read inputs; retain complete review validation | High: payroll eligibility/finalization | Remove up to N−1 count round trips; about 6.9 s at N=100 and 70 ms, illustrative only |
| attendance transaction/query multiplication | **P1** | Attendance evaluation, leave attendance sync, H3 fixtures | service.ts:338–365 per employee/day; safe P2028 probes at ~5 s | **Confirmed pattern/mechanism**; historical attribution unproven | Profile isolated test schema later; batch stable inputs and preserve atomicity; explicit transaction budget after measurement | High: attendance evidence, concurrency | O(days×employees) repeated input reads can fall substantially; no measured percentage |
| tenant bootstrap waterfall | **P1** | All authenticated modules, branding API | Normal traces: Organization ×2, Branding ×1, before user validation | **Confirmed** serial slug→id→branding lookup; network/SQL split not isolated | Resolve organization and minimum brand data through fewer scoped reads; retain request memoization | Medium: tenant routing/isolation | About one saved serial RTT (~70 ms locally) if one organization lookup is removed |
| dashboard query fan-out | **P1** | Dashboard | 19 top-level operations; 25–31 warm statements on failed path | **Confirmed structure**, healthy cost not measured | Repair schema first; consolidate overlapping attendance statistics and defer noncritical panels | Medium/high: KPI semantics | Lower query count and earlier useful panels; percentage unmeasured |
| first-visit development compilation | **P1** | All local modules | Dashboard compile 15.386 s; first request 26.127 s | **Confirmed** webpack compilation contribution; remaining first-request cost mixed | A/B Turbopack in a later batch; inspect imports; use production baseline for runtime diagnosis | Medium: bundler compatibility | Potentially seconds off first local visits; no measured Turbopack improvement |
| unbounded read models | **P1** | Pipeline, leave overview, profiles, payroll configuration, ESS history | findMany without take/skip; current database small | **Confirmed scaling risk**, not proof of current large scans | Pagination, tab-specific reads, minimal selections and bounded recent summaries | Medium: completeness/order/UI expectations | Less transfer/hydration as histories grow; current gain unquantified |
| eager applicant detail tab tree | **P2** | Applicant detail, some payroll tabs | Applicant page chunk 204.1 KB raw /37.1 KB gzip; static tab imports | **Confirmed bundle size**, CPU/interaction impact unmeasured | Load inactive heavy tabs/modals on demand after confirming boundaries | Low/medium: pending/loading behavior | Smaller initial route JavaScript; exact bytes depend on chunk sharing |
| native GET form navigation and prefix redirects | **P2** | Search/filter forms; temporary path tenancy | Native GET forms; bare internal paths; sidebar already uses tenant helper | **Confirmed source behavior**, redirect cost unmeasured | Framework form/client navigation and consistent tenant href helpers | Medium: URL/filter/browser history behavior | Avoid a document reload or one redirect on affected interactions; no time estimate |
| mount synchronization and redundant refresh risk | **P2** | Applicant onboarding detail | CandidateOnboardingSection effect invokes action and conditional refresh | **Confirmed trigger**, frequency not measured | Trace mount/action/revalidate behavior; make repeat work cheap/idempotent without removing required sync | Medium/high: onboarding state | Potentially one action/refresh per unnecessary remount; no measured latency |
| loading boundaries and passive client wrappers | **P2** | Several sibling modules/filter wrappers | Common dashboard loader; only selected route loaders; mostly-markup client wrappers | **Confirmed structure**, rendering cost not measured | Targeted loading/Suspense boundaries, smaller client boundaries | Low/medium | Earlier feedback and less hydration; no reduction in required DB work implied |
| branding asset round trip | **P2** | Shared shell | Unoptimized local image; DB-backed API; private five-minute cache | **Confirmed extra asset path**, decode/duplicate request impact unmeasured | Measure asset bytes/cache hits before changing delivery | Low/medium: tenant branding/cache privacy | Asset-request savings only; no measured time estimate |

The observed remote RTT amplifies all query-pattern issues. Regional mismatch, pool exhaustion and Neon compute wake-up remain **investigation hypotheses**, not additional confirmed P1 root causes.

## 11. Recommended Batch 2 fixes

1. **Restore a valid functional baseline first.** Review H10 rollout safety and the missing probation field. Decide explicitly how old-schema environments remain supported. No migration approval or execution is part of this audit.
2. **Reduce read-only request overhead.** Add request-scoped session/context deduplication, reduce tenant lookup steps, and remove Analytics' repeated actor work through a trusted boundary. Verify persisted-role changes and tenant mismatch rejection.
3. **Batch ESS and payroll reads.** Group leave balances and compensation applicability counts, avoid duplicate entry hydration, and request only the latest finalized payslip for the dashboard. Keep calculations, snapshot validation and authorization unchanged.
4. **Bound the large read models.** Introduce pagination/tab-specific retrieval where currently unbounded. Preserve deterministic ordering and totals.
5. **Address attendance execution separately.** Use disposable-schema integration evidence for transaction budgets, conflict behavior and materialization batching. Do not widen transaction timeouts blindly or parallelize writes without an atomicity/idempotency design.
6. **Improve perceived navigation after server work is understood.** Add targeted loading boundaries, make search forms preserve the client shell, fix remaining prefix handling and split heavy inactive tabs.
7. **Run controlled development and deployment comparisons.** A/B bundlers, then obtain real Vercel region/log/telemetry evidence before changing regions or pool settings.

Acceptance should compare the same dataset, identities and filter ranges; repeat successful render checks; separately record first/warm requests; capture per-request SQL counts, database spans and browser navigation; and verify cross-user/cross-tenant isolation. Numerical targets should be set after the P0 pages render successfully.

## 12. Risks and affected files

| Proposed area | Files likely affected in Batch 2 | Main risk |
|---|---|---|
| H10/schema compatibility | prisma/schema.prisma; pending H10 migrations; employees/queries.ts; dashboard/read-model.ts | Existing H10 constraints, audit history and lifecycle behavior |
| Request identity/tenant reads | lib/auth/session.ts; lib/auth/guards.ts; lib/tenant/server.ts; organization-branding/read-model.ts | Stale roles or cross-tenant/context reuse if cached outside a request |
| ESS reads | employee-self-service/context.ts, read-model.ts; leave/read-model.ts; payroll/payslip.ts | Entitlement accuracy, finalized-payslip scope and account state |
| Analytics/dashboard | analytics/queries.ts, read-model.ts; dashboard/read-model.ts; associated pages | Metric cohort/denominator and visibility changes |
| Payroll reads | payroll/queries.ts, review.ts, service.ts | Effective dates, review eligibility, immutable snapshot validation |
| Attendance | attendance/service.ts, queries.ts; leave/service.ts; H3 test fixture | Transaction isolation, corrections, leave sync and immutable evidence |
| Navigation/client work | DashboardSidebarNav.tsx; tenant/navigation.ts; profile/tab components; GET filter forms; route loading files | URL prefixes, browser history, unsaved state and loading behavior |

Existing modified files at audit start and finish: package.json, prisma/schema.prisma, DashboardSidebarNav.tsx, employee-self-service/accounts.ts and activation.ts, leave/service.ts, permissions/rbac.ts. Existing untracked H10 migrations, tests/readiness script, Exit routes, separation feature and account-state helper were preserved. No existing work was discarded or staged.

Added files are confined to `docs/performance-audit/` and `scripts/performance-audit*.cjs`. Generated `.next` artifacts were produced by dev/build/browser checks. The audit stops without optimization changes or deployment.

## 13. Validation limitations and evidence index

- Vercel, load/concurrency, real-user Web Vitals, slow networks/mobile CPU, lock/pool waits, memory pressure, query p95 and React render/hydration CPU: **Not measured**.
- The selected tenant is small; payroll contains no populated period to exercise review/generation or salary-heavy rendering. No data was seeded to conceal this limitation.
- Exit has no successful baseline, and Dashboard/Employee pages currently hit the missing probation field. Failed render timings cannot predict performance after schema compatibility is restored.
- Attendance default view only loads options. A selected-employee route was separately measured; the current-month dataset may be sparse. The EXPLAIN sample matches zero rows.
- Browser measurements use one session and caches/prefetching. They do not prove uncached navigation or Vercel behavior. The first browser attempt did not expose a sidebar and was excluded; the retried run produced all 18 valid clicks.
- Instrumentation runs outside application source via a process-local Prisma preload. It changes logging behavior and adds measurement overhead, so treat absolute numbers as a reproducible local baseline rather than a production SLA.
- The safe transaction probe demonstrates deadline exhaustion, not the original H3 business failure. Original incident logs and deployment traces were not available.
- No business-action tests, H1–H10 integration scripts, seeds, trigger modifications or migrations were run. No passwords, tokens, employee records, salary amounts, raw SQL parameters or HTTP response bodies were saved in the artifacts.

Evidence files:

- `dev-first-pass.json`: first valid development HTTP pass, existing development logging.
- `dev.json`, `prod.json`: instrumented route timings and per-statement duration/table metadata.
- `dev-trace-summary.json`: largest framework compile/request/render spans; spans include waiting.
- `database.json`: read-only setting, schema/index catalog, approximate table sizes, latest connection probe.
- `transaction.json`: three safe P2028 probes.
- `query-plan.json`: sanitized read-only attendance EXPLAIN summary.
- `browser.json`, `browser-initial.json`: three sidebar cycles and the initial capture, without page text or request URLs.
- `chunks.json`: built JavaScript file and offline gzip sizes, including shared chunks that must not be blindly added to a route total.
- `build.txt`: successful production build. `build-environment-failure.txt`: excluded first audit-runner attempt.
- `scripts/performance-audit.cjs`, `performance-audit-preload.cjs`, `performance-audit-browser.cjs`: reproducible diagnostic harness. These create local servers and use read-only database options; they do not run migrations or submit business actions.

**Audit complete. Stop here; Batch 2 has not been implemented.**
