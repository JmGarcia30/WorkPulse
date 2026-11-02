# Final-defense stabilization — Batch 1

Date: **2026-11-02, Asia/Singapore**. Base checkout: `cfcbd8512edbc3e74148e2541ed03bc9f37ec3cd`. Work is local and uncommitted. **No push, merge, production migration, or deployment was performed. Batch 2 has not started.**

**Result: Batch 1 passes local verification and is ready for review.** Both selected defects were reproduced and fixed. Production deployment remains blocked by the separate issues documented below.

## Scope and starting state

Read `REPORT.md`, `BUGS.md`, `TEST-RESULTS.md`, and `DEMO-READINESS.md`. Only QA-BUG-004 (job-edit data loss) and QA-BUG-005 (retained revoked HR cookie) were selected for stabilization. The initial working tree had no tracked edits and contained the existing untracked QA directory. No remote code was merged or checked out.

The installed Next.js cookie and Server Action guides were read before application edits. Original QA reports/evidence remain historical; Batch 1 observations are stored separately under [batch-1](batch-1/).

Every database test rechecked the live development branch and endpoint against `.env.recovery.local`, rejected the protected production endpoint, and used a new random empty schema with repository migrations and synthetic records. Test processes disabled external email, OAuth, AI, and Blob integrations. A synthetic SAGA-named tenant used by legacy tests existed only inside an owned test schema; actual SAGA records were not used or changed.

## QA-BUG-004: failed job edit loses structured requirements

**Baseline reproduced.** The original Server Action accepted a synthetic authorized HR session and a job containing one structured requirement. An edit with `closingDate='not-a-valid-date'` threw `PrismaClientValidationError`, after the requirement count changed **1 → 0**. [Reproduction](batch-1/before/job-atomicity.json), [command/result](batch-1/before/B1-job-reproduction.json), [log](batch-1/before/B1-job-reproduction.log).

**Confirmed root cause:** `updateJobAction` issued a committed standalone `jobRequirement.deleteMany` before preparing/completing `job.update`. A later validation/database error could not roll back the earlier deletion. Malformed requirement JSON also silently fell back to an empty list, potentially clearing requirements.

**Fix:**

- Reject invalid/non-calendar closing dates and malformed or incorrectly shaped requirement data before mutation.
- Move requirement deletion into `structuredReqs.deleteMany` inside the same nested Prisma job update as replacement creation and job-field updates. This is one atomic nested write: failures roll back both sides.
- Retain the existing role/ownership checks and include `organizationId` in the final update predicate.
- Preserve intentional empty-array clearing, existing defaults, normal editing, publication, closure, and last-writer-wins behavior for valid concurrent edits. No unrelated recruitment workflow or UI was changed.

**Regression result:** **17 checks passed** using actual PostgreSQL. Rejected inputs preserve the complete job snapshot, including original requirement IDs. A test-only database trigger deliberately fails replacement insertion; the original job fields and requirements survive. Tenant/role denial, copied sessions on another workspace host, normal replacement, explicit clearing, concurrent complete updates, publication and closure pass. [Result](batch-1/after/B1-job-regression.json), [log](batch-1/after/B1-job-regression.log), [test](batch-1/job-regression.cjs).

The trigger existed only in the new owned schema. No production trigger or migration was changed.

## QA-BUG-005: revoked HR cookie remains in Chrome

**Baseline reproduced over HTTPS.** Chrome retained `__Host-workpulse_session` after Authorize & Open Kiosk. Captured deletion-header metadata showed `Secure=false`, `HttpOnly=false`, root path and expiry. Chrome independently reported **`InvalidPrefix`** for that cookie response. This confirms the previously suspected response-header cause. [Browser metadata](batch-1/before-verified/kiosk-cookie.json), [deletion header](batch-1/before-verified/session-deletion-header.json).

**Authorization determination:** the copied pre-kiosk HR token had **no persisted session row**. Replaying it against the protected kiosk POST endpoint returned **HTTP 403**. The defect was residual browser state; the reproduced token did **not** retain HR authorization. [Actual database/HTTP check](batch-1/before-verified/copied-hr-authorization.json). The baseline overall browser run exited 1 for cookie removal, while its separate scan/security assertions completed. [Baseline result](batch-1/before-verified/B1-cookie-reproduction-verified.json).

**Confirmed root cause:** `destroySession` revoked the server-side session and called `cookies().delete(COOKIE_NAME)`. The installed Next cookie implementation's string-name deletion emits an expired cookie without the original production `Secure` attribute. A `__Host-` cookie requires that attribute even for expiration; Chrome rejected the deletion as `InvalidPrefix`.

**Fix:** keep server-side revocation first, then explicitly set an expired empty cookie with matching host-only scope, `Path=/`, `HttpOnly`, production `Secure`, `SameSite=Lax`, `Max-Age=0`, and epoch expiry. No `Domain` is set. Authentication, token format, tenant binding, session lifetime, kiosk origin checks and authorization rules are unchanged.

The staff-security test's cookie jar was corrected to model browser expiration when `.set` receives zero max-age or a past expiry; this is needed because cookie clearing now uses an explicit expiry header. The actual Chrome tests independently verify removal, so mock behavior is not the sole evidence.

**Post-fix verification:** the rebuilt production application passed **24 HTTPS browser assertions**. Kiosk authorization leaves no HR cookie and Chrome reports no prefix rejection. The expired response has `Secure`, `HttpOnly`, root path and no `Domain`. The copied HR token still returns HTTP 403. Ordinary ESS logout also removes the browser cookie, deletes its server-side session, and replaying the copied token against ESS returns HTTP 307 to login. Keyboard scans, lost-confirmation retries, cross-tenant/origin denial and HR/ESS synchronization remain working. [Overall result](batch-1/after/B1-cookie-browser-verified.json), [browser log](batch-1/after/B1-cookie-browser-verified.log), [cookie metadata](batch-1/after/kiosk-cookie.json), [header metadata](batch-1/after/session-deletion-header.json), [copied HR replay](batch-1/after/copied-hr-authorization.json), [ordinary logout](batch-1/after/ordinary-logout.json).

## Files changed

| File | Purpose |
|---|---|
| [src/features/hiring/actions.ts](../../src/features/hiring/actions.ts) | Validate edited date/requirements; atomically replace requirements with a tenant-scoped nested job update |
| [src/lib/auth/session.ts](../../src/lib/auth/session.ts) | Expire the host-only staff cookie with valid production attributes after revocation |
| [scripts/test-staff-session-security.cjs](../../scripts/test-staff-session-security.cjs) | Make its test-only cookie jar honor expiry-setting semantics |
| [batch-1/job-regression.cjs](batch-1/job-regression.cjs) | Database-backed job rejection/rollback/authorization/concurrency regressions |
| [batch-1/logout-browser.cjs](batch-1/logout-browser.cjs) | Browser logout and copied ESS token replay checks |
| [qa-runner.cjs](qa-runner.cjs), [isolated.cjs](isolated.cjs), [adapt-legacy.cjs](adapt-legacy.cjs), [exported-suites.cjs](exported-suites.cjs), [local-https.cjs](local-https.cjs) | Separate evidence destinations, browser expiry semantics, cookie metadata/rejection reasons without values, copied HR token replay and local HTTPS instrumentation |
| [batch-1/audit.cjs](batch-1/audit.cjs), [batch-1/cleanup.cjs](batch-1/cleanup.cjs) | Track source/environment preservation and remove only Batch 1 manifest-owned schemas |
| [batch-1/validate.cjs](batch-1/validate.cjs) | Validate report evidence links and scan Batch 1 evidence for configured secrets |

The production changes are limited to **two application files**. No dependencies, Prisma schema, repository SQL migrations, payroll rules, TSX pages, styles, or deployment settings were changed.

## Executed tests

| ID | Test | Result | Evidence |
|---|---|---|---|
| B1-job-reproduction | Original invalid-date job edit | **FAIL as expected**, requirement count 1 → 0 | [Before](batch-1/before/job-atomicity.json) |
| B1-cookie-reproduction-verified | Original production cookie clearing | **FAIL as expected**, retained cookie and Chrome `InvalidPrefix` | [Before](batch-1/before-verified/kiosk-cookie.json) |
| B1-copied-HR-before | Replay original revoked HR token | **PASS**, row absent and protected POST returns 403 | [Before](batch-1/before-verified/copied-hr-authorization.json) |
| B1-job-regression | Invalid inputs, forced DB failure, ownership/role isolation, successful/concurrent edits and publication/closure | **PASS, 17 assertions** | [Log](batch-1/after/B1-job-regression.log) |
| B1-staff-security | Production session/login/logout, role/password/account changes, tenant boundaries, copied tokens and kiosk separation | **PASS, 63 assertions** | [Log](batch-1/after/B1-staff-security.log) |
| B1-routing | Host/path routing, tenant sessions and document/configuration isolation | **PASS, 64 assertions** | [Log](batch-1/after/B1-routing.log) |
| B1-hiring | Real PostgreSQL recruitment, Teaching/Non-Teaching conversion and concurrent stage/conversion operations | **PASS, 61 checks** | [Log](batch-1/after/B1-hiring.log) |
| B1-hiring-functional | Offline current recruitment/readiness/action regressions | **PASS, 63 functional groups** | [Log](batch-1/after/B1-hiring-functional.log) |
| B1-candidate-security | Offline candidate proof/session/ownership/replay restrictions | **PASS** | [Log](batch-1/after/B1-candidate-security.log) |
| B1-typescript | `tsc --noEmit --incremental false` | **PASS** | [Result](batch-1/after/B1-typescript.json) |
| B1-targeted-lint | ESLint on the three changed tracked files | **PASS** | [Result](batch-1/after/B1-targeted-lint.json) |
| B1-production-build | Optimized `next build --webpack` | **PASS** | [Log](batch-1/after/B1-production-build.log) |
| B1-cookie-browser-verified | Rebuilt HTTPS browser: cookie clearing, revoked-token replay, RFID and HR/ESS, ordinary logout | **PASS, 24 assertions, exit 0** | [Log](batch-1/after/B1-cookie-browser-verified.log) |
| B1-preservation | Tracked-file baseline hashes and environment hashes | **PASS**, only the three listed tracked files differ; commit and all environment files unchanged | [Audit](batch-1/preservation.json) |
| B1-cleanup | Recheck development identity; remove only Batch 1 manifest-owned schemas | **PASS, 9 synthetic schemas removed** | [Evidence](batch-1/cleanup.json) |

All final application test runs above exited zero. Test counts use different units and overlap; they are not summed as an end-to-end total. The production build used the installed generated Prisma client, since no schema changed. Repository-wide lint was not reclassified as passing; the passing lint command covers only the changed tracked files.

## Test-harness corrections

An initial baseline browser instrumentation attempt selected nonexistent `StaffSession.id`; it stopped before the new replay check. The lookup was corrected to select `userId`, and a separate `before-verified` run captured the actual database/HTTP result. The job and cookie reproductions themselves remain independently evidenced.

An initial post-fix browser run stopped on quoting syntax in the newly added test-only logout hook. It did not execute application assertions. The hook was corrected and syntax-checked, and its replacement run uses a separate result ID. These failures are retained rather than represented as application regressions.

## Remaining risks and deployment readiness

- The original protected-production OTP migration gap, expired statutory/BIR coverage, repository-wide lint failures, newer remote careers UI commits and previously untested workflows are **outside Batch 1**. They were not fixed or reclassified as passing.
- No payroll rule, clock, legal-review prerequisite, or production safeguard was bypassed.
- Physical RFID equipment remains a human test requirement. Local HTTPS/Chrome validates software behavior, not reader hardware or the live deployment's certificate/proxy configuration.
- Server logs retain `The destination stream closed early` during navigation, also observed before the fix. It was not fixed or claimed resolved; the final browser suite exited zero and reported no unexpected kiosk browser exceptions. Negative authorization probes also produce expected server-side denial logs.
- Invalid edits return to the existing edit route with a validation error query. No UI redesign or new error-message component was added. Creation and other recruitment actions were deliberately left unchanged.
- Full deployment readiness is **not established** by this batch. Production remains **NO-GO for the unrestricted current-date demo** described in the original report.

**Review boundary:** Batch 1 is to be reviewed using this report and its evidence before any push to `main`. Batch 2 has not started. No push or production deployment is authorized or performed by these results.
