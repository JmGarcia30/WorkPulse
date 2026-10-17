# WORKPULSE BATCH 0 — DATABASE COMPATIBILITY REPORT

17 October 2026. **Preparation complete; deployment and recovery verification BLOCKED. No migrations executed.** This report supplements `../REPORT.md` and does not replace its pre-optimization measurements.

## 1. Actual database environment and evidence

**Classification: deployment role uncertain; handle as production.**

- Local `.env` points at remote Neon `neondb/public`, not a local PostgreSQL server. The configured endpoint is pooled; the hostname indicates AWS `ap-southeast-1`.
- A live catalog query confirmed database `neondb`, schema `public`, PostgreSQL `18.6`, and the preflight connection's `default_transaction_read_only=on`.
- No `.vercel/project.json`, authenticated Vercel/Neon connector, or installed Vercel/Neon CLI was available. The relevant environment-variable-name inspection found `DATABASE_URL`, but no Vercel mapping, Neon control-plane credentials, separate direct URL or H10 test URL.
- This proves that local development accesses this remote database. It does **not** prove that the database is disposable development, staging, or Vercel production. No Vercel secrets were retrieved or deployment settings changed.
- Neither the database name `neondb`, a small row count, nor local development settings establish its deployment role. Production usage cannot be excluded, so production safeguards apply as requested.

Evidence: `preflight.json`. No connection URL, username, password, session token or employee record is included.

## 2. Migration status

The live database has **20 successfully applied migrations**, **two pending local migrations**, no unresolved failed/in-progress migration, and no database migration missing from the local migration directory. The directory contains 22 migration files. `_prisma_migrations` has an additional historical H5 attempt marked rolled back.

| Order | Migration | Status | SHA-256 of current file bytes |
|---|---|---|---|
| 1 | `20261017090000_h10_1_exit_clearance` | Pending | `ff13d527ce230b08eaa54d99a6d2c75e493a5235e34903f300f3752cb46c974a` |
| 2 | `20261017120000_h10_2_final_separation` | Pending; requires H10.1 | `8b2cad450524f1eef19fa32c1a8756fb60eb49dec28dfafe469d294b3e041bce` |

Applied migration checksums: **19 exact byte matches; one H4 match after LF/CRLF normalization; zero unexplained active checksum mismatches.** The successfully applied H5 workflow migration matches the local and committed file exactly. Its older rolled-back attempt has a different checksum; that is historical evidence, not a reason to edit the migration or migration table. The initial preflight incorrectly included rolled-back attempts in its match decision; the checker and saved results were corrected without database writes.

Required dependencies already exist: H2's validated `ProbationRecord_lifecycle_state_check`, the existing User/Employee/Employment/Attendance/Leave/Payroll tables, and existing `EmployeeStatus` values expected by the client. H10.2 depends on H10.1's enum types, case table and partial active-case index. Apply H10.1 before H10.2 using the migration runner, not selected SQL fragments.

No historical migration was edited. A checksum warning alone is not repaired with `migrate resolve`; `migrate deploy` is not a full drift detector. Prisma 6 documents that deployment can warn about modified migrations, applies pending migrations, and does not generate the client or reset the database. [Prisma 6 deployment behavior](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/development-and-production).

## 3. Schema mismatch findings

Confirmed absent tables:

- `EmployeeSeparationCase`
- `EmployeeClearanceItem`
- `EmployeeSeparationReview`
- `EmployeeSeparationAudit`

The sole generated-client column missing from **existing** tables is `ProbationRecord.closedBySeparationCaseId` (nullable TEXT). Its index and foreign key are also part of pending H10.2. All six H10 enum types are absent, including the final approval/completion enum values supplied by H10.2. None of the **16 expected H10 triggers** exists yet.

H10.1 adds case/clearance/review/audit tables, composite tenant foreign keys, User/Employee composite unique indexes, partial active-case uniqueness, checks and audit/review immutability/time triggers. H10.2 adds ten nullable case columns and the probation link, expands enum states, replaces active-case uniqueness and the probation lifecycle constraint, and adds final-state/scope/post-separation write guards.

Read-only conflict checks found no existing H10 relation/function name collisions in the inspected object set, and **zero existing probation rows rejected by the replacement lifecycle predicate with the new link initially null**. Other scalar/enum fields expected by the generated client had no additional missing-column gaps on existing tables. This is not a complete independent replay/schema-diff proof; that remains an approved isolated-database validation step.

Pre-deployment exact row counts were saved without row contents:

| Table | Rows |
|---|---:|
| Employee | 7 |
| EmploymentRecord | 11 |
| ProbationRecord | 8 |
| EmployeeStatusHistory | 6 |
| EmploymentDecisionHistory | 5 |
| PayrollEntry | 0 |
| LeaveRequest | 1 |
| AttendanceEvent | 0 |
| DailyAttendanceRecord | 77 |

These counts are a preflight reference, not proof of post-migration history preservation. Postflight should compare protected-row fingerprints or a controlled before/after comparison as well as counts; counts alone can miss altered values.

## 4. Required migration actions

**The following is a prepared runbook, not executed work.** Prerequisites are explicit deployment approval, verified target identity and recovery, and a reviewed/pinned release artifact containing both currently untracked H10 migrations and the matching application/schema.

1. Confirm the exact Neon project/branch/database/schema and whether Vercel Production/Preview uses it. Compare environment targets securely without printing credentials. Confirm all consumers, not just this workstation.
2. Verify recovery as described below. Rehearse the migrations on a separately approved disposable clone and run fixture-based regressions there. Do not use the configured production-treated database as a convenient test target.
3. Prepare and build the matching application artifact. Establish a write-quiescence/maintenance window for HR/attendance/leave/payroll operations and background jobs. Check for long-running transactions and active DDL blockers immediately before the window; a current lock snapshot would not guarantee availability later.
4. Inject the **verified direct, non-pooler migration connection** for this same branch into `DATABASE_URL` in a controlled deployment job. The current schema has no `directUrl`, so a separate `DIRECT_URL` variable alone would not redirect Prisma. Obtain the direct URL through Neon; do not guess it or echo it. Preserve Prisma's advisory locking; do not copy the test script's advisory-lock disabling flag into deployment.
5. Run the following commands from the pinned release directory only after approval. Prisma is the installed 6.19.3 CLI; avoid an implicit latest-version download:

```powershell
# EXECUTION GATE: explicit approval, verified backup and correct target required.
# DATABASE_URL is securely injected by the migration job; never paste/echo it here.
node node_modules/prisma/build/index.js migrate status --schema prisma/schema.prisma
# Expect exactly the two reviewed H10 migrations pending; stop on any deviation.
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
node node_modules/prisma/build/index.js migrate status --schema prisma/schema.prisma
node scripts/check-batch0-compatibility.cjs postflight
```

`migrate status` can return a nonzero exit code when migrations are pending; inspect its meaning rather than treating pending status as an instruction to reset. Deployment applies **all** pending migrations, so the exact pending set must be checked first. The preflight checker confirms its connection is read-only even in the migration job and writes `postflight.json` separately from `preflight.json`.

6. Verify both new migration rows finished successfully with expected checksums, zero pending/unfinished migrations, all four tables, the probation column/index/FK, validated constraints, active-case partial index and all 16 enabled triggers. Review the trigger functions' schema binding/search path. Check history against the protected pre-window baseline.
7. Release/promote the matching generated-client/application build, or restart the already-matching local server after the schema is ready. Keep H10 mutations unavailable until schema and all relevant application instances agree. Run rendered-page and authorization smoke checks before resuming writes.
8. Save new successful-response measurements separately. Resume normal traffic only after the agreed checks pass.

An application/database rollout **must be coordinated**. Adding nullable structures generally permits older reads, but new triggers change existing write behavior. Old and in-flight writers must not be assumed fully compatible merely because the changes add columns. An application rollback does not remove these guards. No production release or migration is authorized by this runbook alone.

## 5. Backup/deployment safety considerations

**Verified recovery option: BLOCKED — none verified in this session.** No authenticated Neon control-plane access, tested dump/restore artifact, or confirmed retention window was available. Managed Neon branding is not proof that this project's historical restore point is usable.

Supported preparation option: create a restricted pre-H10 child branch from the exact target branch and verify it is readable, has the expected schema/history, and is retained for the recovery window; disable premature expiration. Use a separate disposable branch for rehearsal. Neon documents copy-on-write branch isolation and current/past-data branch creation. Creating either branch requires authorization and was not attempted. [Neon branch management](https://neon.com/docs/manage/branches).

Before calling recovery verified, record the branch/reference and UTC recovery time, confirm account permissions/retention, and demonstrate a readable restore or rehearsal recovery target with protected counts/fingerprints. For PITR, verify the configured history window actually covers the chosen point. Record the recovery operator, application reconnect procedure and acceptable write-loss window. A logical backup is an alternative only after its integrity and restoration into an isolated target have been tested.

Lock/impact review:

- H10.1 builds ordinary, **non-concurrent indexes on existing User and Employee tables**. These can block writes during index construction.
- H10.2 alters ProbationRecord, adds/validates a foreign key and replacement check, and creates an index. ALTER TABLE can take strong locks even when a nullable-column addition avoids rewriting existing row contents.
- Trigger creation affects existing employment/account/compensation/leave/attendance/payroll tables. The post-separation guard executes a `FOR UPDATE` employee lookup before checking status, adding employee-row locking to affected writes even for active employees. Rehearse concurrency behavior; do not remove the guard to reduce locks.
- H10.2 replaces its case partial index inside the second transaction, so the replacement should not expose a committed uniqueness gap if that transaction succeeds.
- H10.1 has no explicit transaction envelope; do not assume the entire two-migration rollout is atomic. H10.2 **explicitly commits enum additions before opening its remaining DDL transaction**. A later failure can leave committed enum changes; a blind retry can fail on existing values.
- There is no top-level employee/payroll/leave/attendance data rewrite in the pending H10 SQL. Existing histories should remain in place. Replacing constraints/indexes and adding guards still requires operational review. The old H5 migration contains a LeaveRequest backfill but is already applied and must not be rerun.

PostgreSQL documents that ordinary index builds and table-alteration operations have different lock modes and can conflict with concurrent writes. [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html).

On migration failure: keep writes quiesced, retain sanitized error evidence, inspect actual committed objects and migration status, and choose reviewed forward recovery or the verified restore procedure. Do not edit historical SQL, overwrite checksums, drop objects, mark migrations applied, or run resets to make the runner green. Prisma's production recovery procedures require reconciling the actual database state. [Prisma 6 production recovery](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/patching-and-hotfixing).

## 6. Changes performed

- Added `scripts/check-batch0-compatibility.cjs`: read-only catalog/checksum/constraint/count inspection; optional snapshot label for separate postflight evidence.
- Added `scripts/validate-batch0-build.cjs`: runs Prisma validate/generate and the production webpack build with read-only database options and sanitized captured logs.
- Added this report, preflight evidence, regression/build results and a blocked baseline record under `docs/performance-audit/batch-0/`.
- Regenerated local Prisma client artifacts and `.next` build output using existing configuration. This updates generated files only; it does not deploy database structures.
- Preserved all pre-existing application edits, H10 migration SQL, tests and interface work. No application source, business logic, environment file, deployment configuration or historical migration was edited. No database writes or migrations were issued by this task.

## 7. Successful-page verification

| Check | Result |
|---|---|
| Dashboard renders actual content without framework error | **BLOCKED** |
| Employee Records renders actual content | **BLOCKED** |
| Employee Profile renders actual content | **BLOCKED** |
| Exit Management renders actual content | **BLOCKED** |
| H10 tables / audit triggers exist | **BLOCKED for recovery sign-off; currently confirmed absent** |
| Employee histories unchanged after migration | **BLOCKED** |
| No runtime Prisma P2022 remains | **BLOCKED** |

No new page-success claim is made. After deployment, validate actual rendered expected content plus framework/server error evidence. An HTTP 200, successful TypeScript check or successful build is insufficient. Do not mint local sessions to bypass authentication: use authorized normal test sign-in/session flows for recovery verification.

## 8. Performance baseline

**Post-compatibility baseline: BLOCKED / Not measured.** See `baseline-recovery.json`. Do not substitute the previous audit's failed-render timings as recovered-page measurements.

After approved recovery, collect an initial request and three warm requests for each of the four routes in development and production modes separately, using the same accounts/data/ranges and instrumentation approach. Record initial TTFB, full-response completion median/range, SQL statement count, runtime errors and successful rendered content. Use normal authenticated browser sessions and three navigation repetitions where possible. Distinguish per-route first requests from actual process/compute cold starts.

Keep the original audit artifacts unchanged. The existing performance-audit harness should **not** be rerun unmodified for this sign-off: it signs sessions directly, lacks robust successful-content/error-digest checks and writes its default output over the original files. Before measurement, adapt diagnosis-only verification to use authorized sign-in/session flows, validated route-specific content/error checks and a dedicated Batch 0 output path. No auth bypass or performance optimization is permitted.

## 9. Regression results

| Check | Result in this task | Evidence / limitation |
|---|---|---|
| TypeScript | **PASS** | `node node_modules/typescript/bin/tsc --noEmit`, exit 0 |
| Prisma schema validation | **PASS** | Existing installed Prisma CLI, exit 0 |
| Prisma client generation | **PASS** | Exit 0; no migration |
| Production build | **PASS** | Same package build steps: generate then `next build --webpack`, production environment; build phase 35.964 s |
| SaaS tenant shell | **PASS** | Host/navigation/branding assertions; no database. Initial sandbox attempt failed before assertions in OS user-info lookup; permitted rerun passed |
| H1 / H2 | **BLOCKED; not run** | Scripts create/delete records and need an approved disposable test target |
| H10.1 / H10.2 | **BLOCKED; not run** | Scripts create schemas, replay migrations and write fixtures; fall back to configured database if test URL is absent |
| H10 interface | **BLOCKED; not run** | Real server-action submissions with fixture writes, after test-schema migration replay |
| ESS / Leave / Payroll | **BLOCKED; not run** | Database-backed fixture transactions/writes; schema still incompatible |
| Live tenant database isolation | **BLOCKED; not run** | SaaS shell assertions are not a live authorization regression |

For the approved disposable environment, the existing harness can run H1/H2/H4/H5/H6/S1 regressions through `npm run test:h10-2 -- --regressions-only`, with separately injected disposable `DATABASE_URL` and `H10_TEST_DATABASE_URL`. Run normal `test:h10-1`, `test:h10-2`, and `test:h10-interface` as well; the regressions-only branch does not run normal H10.2 integration. Confirm cleanup targets and side-effect transports first. The suites create and remove fixture schemas, so this plan does not authorize running them on production-treated `neondb/public` or its server without a separately reviewed isolation boundary.

## 10. Remaining blockers and approval boundary

1. Database deployment role and actual Vercel target mapping are unconfirmed.
2. No recovery branch, tested backup or applicable restore window is verified.
3. No approved disposable target exists for migration rehearsal and database regressions.
4. No explicit approval to deploy H10.1 then H10.2 has been given. The two migrations also remain untracked in the working tree and must be included in a reviewed/pinned deployment artifact.
5. Recovered rendered-page verification, history comparisons, P2022 clearance and successful-response measurements depend on approved migration deployment and are **BLOCKED**.

**Stopped before migration execution. No Batch 1 optimization was started.**
