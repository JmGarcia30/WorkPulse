# Final Basic/Pro release verification

Base release: `f79f8fb698bc8515150422a3f4197dc542776a1e` (remote `main`). Continuation branch: `feature/final-basic-pro-entitlements`.

## Production verification

Vercel production deployment `dpl_E9K92xTtnPy3CrCs7gufEDC3HhkN` is READY and serves the exact base commit at https://work-pulse-omega.vercel.app. Build/deployment events confirm completion. The available 30-minute runtime-error query and error/fatal log query returned no entries; this limited window does not prove authenticated workflows.

Read-only database connections verified the production project/branch/endpoint/database identity using the existing safety checks. All **47 committed migrations** are successfully applied, with matching checksums, no pending migrations, and no unfinished attempts. Employee registration columns, account/subscription models and all six role values exist. Both plans currently have unset monthly/yearly prices and no employee limits. The stored feature flags are still the previous draft definitions; the continuation implements the approved policy without needing a data migration.

Public homepage, SAGA HR login page, Platform Admin login page and RFID attendance kiosk return HTTP 200. Employee Records, Add Employee, ESS, ESS payroll, payroll, leave, attendance and Subscription & Billing correctly redirect unauthenticated requests to SAGA login. Platform subscriptions redirect to Platform Admin login. No checked response rendered a server exception.

**Production login, employee role controls, employee records, personal ESS/payslip content and authenticated HR/Platform Admin subscription screens remain unverified.** An existing authorized session/test login was requested; none was available. No production account was created, password reset, activation consumed or real SAGA record modified. No confirmed production application defect was found in these checks.

Evidence: `verification/production-vercel.json`, `production-database.json` and `production-http.json`.

## Implementation

- Central approved Basic/Pro definitions override stale draft catalog flags when evaluating entitlements and displaying available plans. Saving plan configuration persists those definitions, retains configurable nullable prices and request availability, and removes employee limits. Gmail is included in both tiers.
- Basic has five simultaneously **PUBLISHED** jobs; Pro has unlimited. DRAFT, CLOSED and ARCHIVED jobs do not count. Existing published jobs count regardless of publication/closing dates. No existing jobs are unpublished or deleted. Over-limit tenants can edit, close and republish existing published jobs, but cannot increase their published count.
- All application job writes use the existing audited transaction boundary. It acquires the same immutable organization-ID advisory transaction lock used by subscription activation/review, counts before/after mutation and rejects an over-limit increase atomically. Concurrent publication and plan changes share that lock. A failed publish leaves no job or success audit behind.
- Pending Pro requests grant no extra capacity. Nonlegacy expired/future/inactive/unassigned Pro falls back to Basic's cap immediately. Existing legacy optional-feature access remains in place for transition; legacy Pro retains its unlimited publishing allowance. Explicit Basic subscriptions use the five-job cap even with legacy access.
- Basic analytics reuses only the existing workforce summary calculation and does not execute advanced attendance, leave or payroll aggregates. Pro retains existing full analytics and the existing analytics PDF report/export; direct Basic PDF requests return 403. Existing employee and attendance reports/exports remain standard features. No new analytics/reporting product was invented.
- AI parsing and custom branding use the approved tier rules through the existing server guards. Existing request, approval, rejection, history, expiry and two-year complimentary SAGA Pro services are retained.
- Publishing from the existing job-detail form now displays rejected-publication feedback; previously its wrapper discarded action errors. Direct published-job creation also displays quota feedback.

No payment gateway, payment simulation, employee cap, dashboard redesign, slug behavior change or schema migration was added.

## Validation

See `verification/checks.json`, `verification/test-results.json`, `verification/final-plan-scenarios.json` and their logs for final results. Tests use existing disposable schemas on the identity-verified nonproduction endpoint; no new Neon branch was created. Two existing migrations were applied only to the disposable `subscription_test_*` schema to bring it from 45 to 47. The outdated development **public** schema was not migrated or treated as a production failure.

Regression evidence writes are redirected into this report's directory. The runner verifies original `.env` bytes and every pre-existing modified/untracked payroll recovery file by SHA-256; unrelated payroll work is excluded from this change.

| Check | Result |
| --- | --- |
| TypeScript, Prisma validation, changed-file ESLint, production webpack build | Pass |
| Final plan/enforcement/form/report scenarios | 37 pass |
| Existing subscription engine + subscription domain | 38 engine scenarios pass; domain passes |
| Direct registration, activation, roles, privilege/tenant checks, recruitment conversion | 46 pass |
| Personal payslip access across all four employee-linked roles | Pass |
| ESS activation, expiry, one-time use, link isolation and audit | Pass |
| Leave | 103 assertions pass |
| Attendance | 39 assertions pass in a clean disposable schema |
| RFID | 65 assertions pass |
| Existing analytics | 44 assertions pass |
| Payroll integration / presentation / workflow / phase 3 | 56 / 28 / 24 / 15 assertions pass |
| SaaS shell and hiring policy | Pass |
| Existing CSV/PDF format suite | Inherited BOM assertion failure at line 19 |

The first attendance run failed because the old suite asserts a schema-wide event count of exactly one in a reused schema containing earlier fixtures. The unchanged suite passed in a clean schema; the runner now automatically isolates it. Raw first-run results are retained in `test-results.json`; `attendance-clean-results.json` records the passing rerun. No attendance application change was needed.

The separate existing export-format suite expects `Response.text()` to preserve the CSV UTF-8 BOM, which the decoder strips. Its test file and export utility have identical Git blobs to `f79f8fb`. This inherited assertion remains unchanged; actual Basic standard-export and Pro analytics-PDF endpoint checks pass. See `inherited-failures.json` for details. No implementation-caused failures remain.

Payroll recovery preservation and original `.env` hash checks passed after all suites. The React skill checklist was applied to the changed TSX; existing server authorization, component structure, form labels and alert feedback are retained.

Reproduce with `node scripts/verify-final-plans.cjs` and `node scripts/verify-final-plans.cjs --checks`. Profiles are ignored local files and identity checks must pass; do not substitute production URLs. `--policy-only` runs just the 37 final-plan scenarios, and `--attendance-clean` runs the isolated attendance suite.

## Remaining work

1. Complete authenticated, read-only production checks with an existing authorized HR/ESS/Platform Admin session.
2. Obtain separate authorization before pushing or deploying this continuation. The approved behavior is local until that release. No production migration is required.
3. Decide plan prices later; both remain unset. Existing catalog flags can be synchronized through the Platform Admin Save plan action after release; runtime enforcement already uses the approved policy.

## Exact code files changed

```text
src/app/(dashboard)/dashboard/analytics/page.tsx
src/app/(dashboard)/dashboard/hiring/jobs/[jobId]/page.tsx
src/app/(dashboard)/dashboard/hiring/jobs/new/page.tsx
src/app/(dashboard)/dashboard/subscription/page.tsx
src/app/api/reports/analytics/route.ts
src/app/platform/(protected)/subscriptions/page.tsx
src/features/account-security/job-audit.ts
src/features/analytics/queries.ts
src/features/analytics/read-model.ts
src/features/hiring/actions.ts
src/features/subscriptions/actions.ts
src/features/subscriptions/approved-plans.ts
src/features/subscriptions/domain.ts
src/features/subscriptions/job-limit.ts
src/features/subscriptions/plan-editor.tsx
src/features/subscriptions/service.ts
scripts/final-plan-test-preload.cjs
scripts/test-final-plans.cjs
scripts/verify-final-plans.cjs
scripts/verify-production-final-plans.cjs
```

Documentation and generated verification artifacts are confined to `docs/final-plan-release/`; `changed-files.json` lists each exact path. Existing payroll recovery files remain outside this delivery.
