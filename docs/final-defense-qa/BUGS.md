# WorkPulse QA findings and priorities

Tested commit: `cfcbd8512edbc3e74148e2541ed03bc9f37ec3cd`. Date: 2026-11-02 Asia/Singapore. No application fixes applied.

Severity follows the requested rubric: P0 = security exposure, data loss, or system-wide failure; P1 = essential workflow or defense blocker; P2 = important issue with a workaround; P3 = cosmetic/minor. QA-BUG-004 is **P0 under the requested data-loss category**. Its observed scope is one synthetic job's structured requirements following an invalid edit; no production data loss or system-wide incident was observed.

## Confirmed application/quality defects

### QA-BUG-001 — Current-date payroll falls outside verified rules

- **Module/severity:** Payroll/statutory; **P1**, defense blocker for current-date payroll. Fail-closed safeguards themselves are working as intended.
- **Reproduce:** Run `node docs/final-defense-qa/qa-runner.cjs run PAY-008-independent docs/final-defense-qa/statutory-check.cjs`. Inspect the current-date cases in [evidence](evidence/statutory-independent.json). Each agency is given a valid mandatory private-employee context, PHP 35,000 monthly basis, and contribution month `2026-11`. BIR receives valid taxable compensation with pay dates `2026-10-23`, `2026-10-31`, `2026-11-02`, and `2026-11-15`.
- **Expected:** Reviewed rules cover the intended defense/payroll date and allow supported, fully configured payroll. Unreviewed dates must remain blocked.
- **Actual:** Each agency throws `UNVERIFIED_SCHEDULE`; BIR throws `UNVERIFIED_RULES`. October month-end payment is also outside BIR coverage. Historical September examples pass.
- **Confirmed cause/location:** `src/features/payroll/statutory/schedules.ts:2` ends month coverage at `2026-10`; `src/features/payroll/statutory/calculator.ts:65` enforces it. `src/features/payroll/bir/rules.ts:2` and `:22` end coverage at `2026-10-22`; `src/features/payroll/bir/validation.ts:30` enforces it. Benefit rules have the same reviewed endpoint.
- **Impact:** November payroll cannot be promised for the defense. An October period paid after October 22 is not a safe workaround.
- **Recommended fix:** Review current primary agency/BIR issuances and supported profile assumptions, then update reviewed rule metadata and any actual rule changes through normal code review. Never merely extend a date or bypass validation to pass a demo.
- **Required regressions:** All prior boundary cases; defense-date payroll; month-end payment; effective-date changes; unsupported historical/profile rejection; monthly and both semi-monthly cutoffs; finalization and immutable snapshots; ESS output. Independent expected amounts required.

### QA-BUG-002 — Repository lint gate fails

- **Module/severity:** Build quality/CI; **P2**. The optimized build passes independently.
- **Reproduce:** `node docs/final-defense-qa/qa-runner.cjs run ENV-004-lint node_modules/eslint/bin/eslint.js . --ignore-pattern docs/final-defense-qa/**`.
- **Expected:** Existing repository lint gate exits zero.
- **Actual:** Exit 1, **100 errors and 61 warnings**, excluding the newly added QA harness. See [full output](evidence/ENV-004-lint.log).
- **Confirmed causes/locations:** CommonJS harness/storage scripts trigger `@typescript-eslint/no-require-imports`, including `scripts/batch0-recovery-environment.cjs:2` and files under `storage/hiring-policy` and `storage/integration-check`. Application JSX also fails `react/no-unescaped-entities` at `src/app/(dashboard)/dashboard/organization/setup/page.tsx:18`. There are unused-variable warnings across redesigned components.
- **Recommended fix:** Establish intentional ESLint scope/overrides for operational CommonJS scripts, remove or exclude generated scratch artifacts appropriately, and correct actual source lint errors. Do not hide all source errors or equate a build pass with a lint pass.
- **Required regressions:** Repository lint and application-source lint both exit zero; TypeScript and production build still pass; no broad suppression conceals application errors.

### QA-BUG-004 — Rejected job update deletes existing structured requirements

- **Module/severity:** Recruitment/job editing; **P0 under the requested data-loss rubric**, confirmed scoped loss on invalid update. This does not imply production records were lost.
- **Reproduce:** Run `node docs/final-defense-qa/isolated.cjs fresh REC-004-job-actions docs/final-defense-qa/exported-suites.cjs ../docs/final-defense-qa/job-check.cjs` against the verified QA environment. The harness creates a synthetic HR session and job with one structured requirement; confirms normal creation/publication/edit/closure; then invokes `updateJobAction` with otherwise valid fields and `closingDate='not-a-valid-date'`.
- **Expected:** Reject the invalid edit while preserving the job and its existing requirement rows.
- **Actual:** `PrismaClientValidationError`; requirement count changes **1 → 0**. The action fails after deletion. See [atomicity evidence](evidence/job-atomicity.json) and [test log](evidence/REC-004-job-actions.log).
- **Confirmed cause/location:** `src/features/hiring/actions.ts:169` deletes requirements before the later `prisma.job.update` at `:173`. These statements are not enclosed in one transaction, and date/nested data validation does not finish before deletion.
- **Scope:** Reproduced through the real Server Action with a synthetic authorized HR session and malformed payload. The HTML date picker normally prevents typing this exact value; a malformed/stale request or another update failure can reach the non-atomic sequence. No production job was edited. An ordinary valid edit passed.
- **Recommended fix:** Validate all fields before writing, then replace requirements and update the job in one transaction. Return an actionable validation failure. Preserve authorization and tenant ownership checks.
- **Required regressions:** Invalid date; invalid structured-requirement data; forced update failure; successful update; tenant/role denial; overlapping edits. Every rejected edit must retain preexisting requirements and job state.

### QA-BUG-005 — Kiosk authorization leaves a revoked HR cookie in Chrome

- **Module/severity:** RFID/staff session handling; **P2**. No retained HR authorization was demonstrated.
- **Reproduce:** Run `node docs/final-defense-qa/isolated.cjs fresh RFID-008-cookie-and-scans docs/final-defense-qa/adapt-legacy.cjs test-rfid-browser.cjs` with the local QA certificate prepared as in this run. Sign in to the synthetic workspace over HTTPS, enroll a card, and select Authorize & Open Kiosk. Inspect cookie metadata without copying its value.
- **Expected:** Kiosk cookie is set and the former HR session cookie is removed from the browser, consistent with the route's stated behavior.
- **Actual:** Kiosk opens with an HttpOnly/Strict cookie, but `__Host-workpulse_session` remains for `saga.localhost`, Secure and HttpOnly. [Cookie evidence](evidence/kiosk-cookie.json). The overall browser suite exits 1 for this failure. Its separate 21 keyboard/scan/HR/ESS checks passed: [log](evidence/RFID-008-cookie-and-scans.log).
- **Confirmed location:** `src/app/api/attendance/rfid/kiosk/route.ts` calls `destroySession`; `src/lib/auth/session.ts` revokes the persisted token and uses `cookieStore.delete(COOKIE_NAME)`. The exact response-header/browser rejection reason was not captured. Missing production cookie attributes on the deletion is a **suspected cause**, not a confirmed wire-level diagnosis.
- **Security scope:** Production-mode service checks explicitly show copied HR tokens are revoked when opening the kiosk, and the independent kiosk session remains usable. The residual cookie must not be described as proof of active HR access.
- **Recommended fix:** Inspect the deletion response on HTTPS and expire the host-only cookie with attributes matching its production constraints. Verify browser removal as well as server revocation; do not weaken `__Host-`, Secure, or origin requirements.
- **Required regressions:** Actual Chrome cookie disappearance after kiosk authorization/logout; copied-token rejection; another independently logged-in session's behavior; root/path workspace routing; kiosk scan continuity; HTTPS deployment. Preserve the 21 passing scanning assertions.

## Confirmed configuration/deployment blockers

### QA-CONFIG-001 — Protected production is missing registration OTP migration

- **Module/severity:** Company registration/deployment; **P1** for deploying or demonstrating current OTP code against this database.
- **Reproduce (read-only):** Run the QA inspector with network access: `node docs/final-defense-qa/qa-runner.cjs inspect`. It forces read-only connections, reads `_prisma_migrations` and column metadata, and compares local migration checksums. Do not invoke registration against production to reproduce this finding.
- **Expected:** All migrations required by the intended application revision are applied to its database.
- **Actual:** Protected production has **38/39** repository migrations; `20261027000100_company_registration_otp` is absent. Development has 39/39. Applied checksums match; no unresolved migration was found. [Evidence](evidence/database-protected.json).
- **Confirmed cause/location:** Unapplied additive SQL in `prisma/migrations/20261027000100_company_registration_otp/migration.sql:2` adds `otpHash`, `otpNonce`, `otpAttempts`. Current registration service reads/writes these fields.
- **Impact qualification:** This is a confirmed schema prerequisite. A live production request failure was **not** executed, and the deployed code SHA was not established. Do not claim a production outage was observed.
- **Recommended action:** Review the deployed revision, additive migration and release procedure; stage/test the exact release, obtain normal release authorization, then verify migration state. This QA session made no production migration changes.
- **Required regressions:** Schema/client compatibility; legacy pending links; new six-digit OTP; failed/resend/expired/reused code; first HR login/branding; no change to existing organizations/business records.

### QA-CONFIG-002 — Tested checkout differs from current GitHub main

- **Module/severity:** Release provenance; **P2** validation gap, not an application defect.
- **Evidence:** Read-only `git ls-remote` and `git fetch origin main` found `c820c52` ahead of tested `cfcbd85` by three careers UI commits. Three files differ. No merge/checkout was performed.
- **Expected/actual:** Defense readiness should refer to the exact revision shown; the executed suite applies to an older checkout.
- **Action/regression:** Select a reviewed defense revision and rerun careers/application rendering and Apply-button checks, then the affected smoke flow. Do not silently reuse these results as proof of the newer UI.

## Test failures that are not confirmed application defects

| ID | Observed failure | Assessment / next regression |
|---|---|---|
| EMP-001-core | `NOT_READY` at legacy conversion fixture, missing current onboarding requirements | Fixture predates current readiness policy. Updated real hiring suite passed 61 checks. Repair fixture; retain prerequisites. Full original H1 suite did not pass. |
| EMP-002-probation | `LEGAL_REVIEW_REQUIRED` on a generic-tenant teaching renewal | Fixture does not satisfy current organization/legal-review rules. Investigate/update fixture with agreed policy; do not weaken employment safeguards. |
| PAY-003-foundation | Expected eligible generation assertion fails after 18 checks | Older test assumes payroll can generate without current verified inputs/opening history. Current integration/workflow suites pass. Update fixture requirements; do not disable statutory checks. |
| ADM-003-clean | `StaffCredentialsChanged` while creating an EMPLOYEE session without an active employee account | Current staff security correctly rejects that fixture. Earlier platform checks executed, but full account-management suite remains incomplete. |
| EXIT-003-separation | 35 checks complete, then dynamic import of extensionless leave service fails | Node/test-loader compatibility issue. Do not mark whole suite passed; final-pay/resignation service suites passed separately. |
| REC-007-browser | `NORMAL_LOGIN_TIMEOUT`, destination-stream error | Full hiring browser journey blocked during its transaction-backed login harness. Registration browser successfully exercised real HR login. Cause not established as a product defect; retain as a browser coverage gap. |
| Initial schema/loader runs | `uv_os_get_passwd ENOMEM`, missing `server-only`, search-path trigger lookups, cross-suite total-count interference | Runner/environment problems; rerun offline tests with correct process permissions/import handling and integration tests in separate schemas. Passing replacement IDs are in TEST-RESULTS. |
| Migration setup attempts | `P1002`, advisory lock acquisition timeout | Competing schema migrations share a database-wide lock. Retained locks and retried/serialized setup. Not a missing application migration. |
| Initial candidate/UI tests | Production-cookie assumption; `Poppins is not a function` outside Next compilation | Adapted offline runs passed. Font stub was used only in the offline render test, not the actual browser application. |
| Initial RFID browser | `INVALID_ORIGIN` over HTTP with production build | Production requires HTTPS. Enrollment/replacement passed; keyboard stage was not reached. HTTPS retry results are recorded in TEST-RESULTS. |

## Unconfirmed risks and coverage gaps

Real organization recruitment-mail authorization, Blob deployment permissions, external AI resume parsing, all browser role/endpoint combinations, and physical RFID have not been established by this QA. These are **BLOCKED/NOT TESTED**, not invented bugs. New-tenant notice/leave/payroll configuration is also required before demonstrating those workflows; an empty setup warning is expected behavior.

No source changes, test-safeguard removal, feature implementation, or deployment was performed to resolve any finding.
