# IT Evaluation release blockers

## Latest emergency release attempt — 2026-11-02

**Operational release authorized but BLOCKED in Phase 1.** [Attempt, concrete safety blocker, completed preparation and continuation steps](release-blockers/emergency/RELEASE-ATTEMPT.md). Fresh provider checks confirm Production credentials are separated from general Preview access, the review freeze-smoke deployment is CANCELED, and the live domain still serves the existing READY deployment. The old shared-scope findings below are historical.

Actual active-deployment Neon binding remains unverified: protected DATABASE_URL is unreadable, the deployed SHA has no runtime identity diagnostic, and the newly installed Vercel CLI reports no authenticated session. A device-login flow is pending. Production-only non-secret expected identity pins were added and read back; no credential value, deployment, domain or freeze setting changed. Intended Neon provider branch remains **38/40**, zero unresolved; both pending migration hashes still match the rehearsal. No fresh recovery point, production migration, release commit/push or deployment was executed before the mandatory runtime-binding gate. Existing live login rendered in Chrome; new live features and authenticated tests remain unverified. Controlled receiving-inbox access remains unconfirmed. **NO-GO until the concrete access/identity gate is resolved.**

## Current resolution — 2026-11-02

**Release recommendation: NO-GO.** [Final resolution, owner actions and exact safe release order](release-blockers/resolution/FINAL-RESOLUTION.md) supersedes the historical release-control proposal below. The passed 38 → 39 → 40 rehearsal was preserved and not repeated.

Resolved locally: fail-closed hosted database configuration/startup verification, Preview SMTP and Gmail API suppression, documented repository Git deployment control (`git.deploymentEnabled: false`), and technical review of the inert pre-existing `h10_fail_audit()` helper. No production cleanup is required for its current unattached state; record owner acceptance of known drift. New code and configuration are **not deployed**.

Remaining gates: owner-provisioned/verified synthetic-only Preview database and separate credentials; owner-applied Vercel scopes (current database/SMTP defaults still shared); actual Production and Preview deployment runtime identity; independently verified pre-push deployment freeze; real controlled inbox recovery/security-alert/duplicate delivery verification; production-window backup and approvals. No inbox access was confirmed and no external messages were attempted. Production records, migrations, secrets, live settings, commits, pushes and deployments were untouched.

[Fresh provider metadata](release-blockers/resolution/provider-metadata.json), [read-only clone identity](release-blockers/resolution/clone-identity.json), [helper review](release-blockers/resolution/helper-review.json), [SMTP BLOCKED evidence](release-blockers/resolution/smtp-inbox.json), and [targeted regression results](release-blockers/resolution/environment.json) support these scopes; provider SQL identity is not claimed as a Vercel runtime binding.

Required future order: **local reviewed commit → verified freeze/isolation/runtime/inbox/backup gates → production migration 39 → verify → migration 40 → verify → authorized push → authorized staged Production deployment → runtime/smoke verification → authorized promotion**. Stop at any failed gate. Exact owner steps and validation evidence are in the final resolution. All prior Batch 1–3 and IT changes/evidence remain preserved.

## Preserved migration rehearsal and earlier verification record

The text below records the prior completed rehearsal, not new actions or a current claim that no application safety code has been added. Use the current resolution above for outstanding gates and release control.

Date: **2026-11-02, Asia/Singapore**. Local and remote baseline: `b24616ba92294018da82341b2f3e8d3a35c69f32` (`main`).

**Overall decision: NO-GO for pushing main, production migrations, or release.** Migration compatibility is now demonstrated on a pinned production-snapshot clone. The release still requires verified runtime database binding, isolated Preview settings, verified deployment suppression, live inbox delivery, and disposition of one pre-existing database drift item. No production migration, business-record mutation, environment/secret change, live Vercel setting change, commit, push or deployment occurred.

Read [IT Evaluation readiness](IT-EVAL-READINESS.md), [push safety](IT-EVAL-PUSH-SAFETY.md), [Batch 2 migration/release documentation](FIX-BATCH-2.md) and the existing preflight, postflight and rehearsal scripts. Reused existing functionality and tests. No application feature, statutory rule, legal verification date or migration SQL was changed in this work. New files are confined to this report and [release-blockers](release-blockers/).

## 1. Exact migration review

Installed Prisma: **6.19.3**. The repository has **40** migration directories. The verified production-named branch still has **38** successfully applied migrations and **zero unresolved** migrations. No migration was falsely marked completed.

| Order | Migration | Exact local file SHA-256 | Requirements and effect |
|---|---|---|---|
| 39 | [`20261027000100_company_registration_otp`](../../prisma/migrations/20261027000100_company_registration_otp/migration.sql) | `03544310cff45c2014a32aeaf2874239f1f3c00c1a744c4307b6cd29cfa133c9` | Existing `CompanyRegistration`; one ALTER adds nullable `otpHash`/`otpNonce` and integer `otpAttempts NOT NULL DEFAULT 0`. |
| 40 | [`20261102000100_it_eval_account_security`](../../prisma/migrations/20261102000100_it_eval_account_security/migration.sql) | `8274df43cf0f6af94c39f77aaae7193b60cb6d3ac0f66bd5d4729b98f9be1c23` | Existing `Organization(id)` and `User(id, organizationId)` unique key. Creates immutable `AccountSecurityEvent`, `StaffPasswordReset`, indexes, fixed-action CHECK, scoped foreign keys, function and immutability trigger. |

These exact byte hashes differ if line endings change. Existing applied migration checksums were validated against the repository's exact/LF/CRLF equivalents, matching prior verification practice. All 40 applied checksums matched after rehearsal. Do not edit a migration after approving its artifact hash or silently replace an already-applied checksum.

Both migrations are additive. Neither contains business-record UPDATE/DELETE, DROP, data replacement or historical backfill. The event trigger's UPDATE/DELETE keywords define rejection behavior; they do not mutate existing history. Reset receipts and security events start empty. Prisma schema changes add those two models and relations; they do not create duplicate user/profile records.

The new foreign keys intentionally restrict deletion of referenced organizations/users after security/reset records exist. Existing deployed application paths tested here do not require deleting those referenced accounts. Schema-first compatibility does not authorize later destructive account cleanup. DDL still takes locks: use a reviewed window and inspect contention before execution. Do not assume a successful local build applies migrations; build/postinstall only generate Prisma Client.

## 2. Verified snapshot clone and migration rehearsal

| Identity | Verified value |
|---|---|
| Neon project | `late-block-61364102` |
| Production-named parent | `br-hidden-violet-azjl3vam`, endpoint `ep-weathered-mouse-azpx765h` |
| New isolated branch | `it-eval-release-rehearsal-20261102`, `br-odd-field-azce2cjf` |
| Isolated endpoint | `ep-patient-cake-az9urbbj` |
| Pinned production snapshot point | LSN **`0/16544B40`**, parent timestamp **`2026-11-02T07:08:51Z`** |
| Clone origin and state | Provider confirms `parent-data`, correct parent/LSN, ready, neither primary nor default |
| SQL identity | `neondb`, expected isolated branch and endpoint |

This is a normal Neon branch created from the production parent's consistent point-in-time data snapshot. It contains inherited real records. It is **not** a synthetic-only database and was never used to send messages or display inherited records in browsers. No named-snapshot restore over any branch was performed. Production's protected Vercel runtime binding remains a separate, unproven fact.

Only clone `public` received migrations. Before execution, the harness verified endpoint exclusion, 38 matching applied migrations, no unresolved history, absent OTP columns/security/reset tables, and absence of conflicting `it_eval_immutable_security_event()`.

Rehearsal results:

- **PASS: 38 → 39 → 40**, with each stage recorded separately and then verified. [Summary](release-blockers/evidence/summary.json), [39 log](release-blockers/evidence/apply-39.log), [40 log](release-blockers/evidence/apply-40.log).
- **PASS: all 73 original public tables retain their counts and complete original-column data fingerprints.** Fingerprints were computed inside PostgreSQL; raw tenant records, documents, hashes, tokens and credentials were not exported to reports. [Final preservation](release-blockers/evidence/final-data-preservation.json).
- Existing columns, constraints, indexes and triggers remain unchanged. The newly added OTP fields have their expected null/null/zero defaults on existing rows; both new public tables remain empty. No historical event was manufactured.
- **PASS: 40 successful migration records, matching checksums, no unresolved migration, repeat deploy is a no-op, Prisma migrate status is up to date.** [History/catalog after](release-blockers/evidence/after.json), [status](release-blockers/evidence/migration-status.log), [repeat](release-blockers/evidence/repeat-noop.log).
- **PASS: seven focused deployed-client compatibility checks.** Generated a separate client from the exact deployed commit's Prisma schema and loaded that commit's actual `staff-security.ts`. Synthetic fixtures exercised authentication, foreign-tenant denial, persistent sessions, Batch 1 atomic job requirement replacement, registration defaults and scoped reads; every fixture transaction rolled back. [Result](release-blockers/evidence/deployed-compatibility.json). This is focused compatibility evidence, not a full production HTTP smoke test or proof of every workload.

The old deployed schema includes OTP fields even though the inspected 38-migration database does not. Migration 39 therefore repairs that schema mismatch rather than removing an old application dependency. Migration 40's new tables do not require the old application to use them. Tests support a schema-first release while the old application remains deployed; production binding, locks, backup and operational gates still apply.

### Drift found — do not call the database completely drift-free

An independently replayed 38-migration catalog matched the snapshot's columns, constraints, indexes and non-internal triggers. All **247 enum label/order rows** and **22 application migration function definitions** match after normalizing only CRLF/LF and excluding extension-owned functions. The new security immutability function is the expected addition.

**One extra function exists: `public.h10_fail_audit()`**, not defined by repository migrations. A read-only query confirmed it also exists on the production-named branch, with body fingerprint `b74bbdd0572348f92148f597613deac8` and **zero attached triggers**. It matches the legacy failure-injection helper in [test-h10-1-separation.ts](../../scripts/test-h10-1-separation.ts:211). It was not introduced by this rehearsal and was not removed or changed.

The extended drift check correctly remains **FAIL / OWNER REVIEW REQUIRED** for this extra object. It did not prevent either additive migration or the executed tests; no current application failure from the unattached helper was demonstrated. Before production writes, the owner must explicitly accept this drift baseline or separately authorize a reviewed cleanup. Do not conceal it or automatically drop it. [Drift details](release-blockers/evidence/schema-drift.json), [production confirmation](release-blockers/evidence/preexisting-function-drift.json).

## 3. Vercel and environment identity

Authenticated metadata confirms team `team_UJrtsVOW9iHGOJYrMtflRVU2`, project **`work-pulse` / `prj_O3lYRwFRzfShyGDhCzek5v0gW4pr`**, with production deployment [`dpl_G2xJzwCrDAxQaLPynEmLucZKDHTZ`](https://vercel.com/jose-miguel-garcias-projects/work-pulse/G2xJzwCrDAxQaLPynEmLucZKDHTZ): READY, source **git**, target **production**, repository **JmGarcia30/WorkPulse**, branch **main**, commit **b24616ba92294018da82341b2f3e8d3a35c69f32**.

[Credential-free provider evidence](release-blockers/evidence/provider-verification.json) records metadata only. A read request for environment values still returned no readable values for protected variables; readable unrelated values were never logged/saved. Consequently:

| Release check | Result |
|---|---|
| Provider production database identity/schema | **VERIFIED:** production-named Neon branch is still at 38, with both pending migrations absent. [Read-only result](release-blockers/evidence/production-readonly.json). |
| Active Vercel production → exact Neon endpoint binding | **BLOCKED:** protected value unavailable; no existing runtime endpoint-identity diagnostic was found. Local credentials and matching branch names do not prove the active deployment's captured connection. No diagnostic was deployed. |
| Generic Preview database isolation | **FAIL:** the same default DATABASE_URL environment record, `dNVmW5LzHeqt40VZ`, targets **production and preview**. A distinct override, `o0a6QWfPbdklImz0`, applies only to `employee-ui-design`. That override does not isolate other Preview branches. |
| Preview messaging isolation | **FAIL:** Gmail user, Gmail app password and EMAIL_FROM records also target **production and preview**. No verified Preview recipient restriction/isolated SMTP binding exists. No live message was sent. |
| Preview document-storage isolation | **UNVERIFIED RISK:** the Blob token is shared across Production/Preview/Development. This batch did not probe storage writes or change the token. |
| Effective automatic-deployment prevention | **BLOCKED:** Git-to-production is confirmed, but available project metadata omits effective Git enable/ignored-build controls; no authenticated CLI is available locally. No live setting was changed. |

The shared environment entry proves a shared configured default; the actual protected endpoint value remains unreadable. We did not test Preview isolation by making a production write. Production/Preview must be treated as unsafe for testing until approved environment separation is independently verified.

### Supported release-prevention plan — prepared, not applied

Vercel supports an Ignored Build Step that cancels a build on exit 0, and `git.deploymentEnabled: false` to disable automatic Git deployments. A production build can also be explicitly staged without domain assignment and promoted later. [Project settings](https://vercel.com/docs/project-configuration/project-settings), [Git configuration](https://vercel.com/docs/project-configuration/git-configuration), [CLI staging](https://vercel.com/docs/cli/deploying-from-cli).

Preferred next approval: the owner authorizes a temporary **Don't build anything / exit 0** project setting, records the exact project/team and previous value, and independently verifies the effective saved state before any push. Confirm there is no repository ignoreCommand override, competing deployment workflow or deploy hook that defeats the intended freeze. A local vercel.json addition, commit-message convention or plan to cancel after push is not proof. Disabling custom-domain assignment alone does not stop a deployment from running against production resources.

A staged deployment/promotion is a later, separately approved **deployment**, so none was created now. It would still use production resources and cannot substitute for database migration, environment verification or safe test recipients. No code/configuration disabling Git deployments was added speculatively.

## 4. Authentication and SMTP verification

All new authentication tests ran on fresh, fully migrated **synthetic schemas inside the verified clone**, not inherited public tenants. The runner checked branch/endpoint identity and public migration count 40 before creating each schema. Every process used offline integration settings. Browser tests used actual Next production output, Chrome, normal login, rendered forms, Server Actions and PostgreSQL. Request-cookie/header injection is confined to the separate service regression harnesses.

**PASS: 67 security assertions** cover HR and Organization Administrator own profile/name/password changes; employee/manager rejection; required current password; HR and employee recovery; expired/reused/parallel reset links; fifth actual incorrect attempt; successful attempts not counting as failures; lockout and recipient deduplication; session revocation; role/tenant isolation; platform-only audit metadata; immutable events; and safe draft deletion. [Run](release-blockers/evidence/RB-security.json), [checks](release-blockers/evidence/reused/docs/final-defense-qa/it-eval/evidence/security-checks.json).

**Live external SMTP/inbox delivery: BLOCKED.** No approved isolated live SMTP profile or owner-controlled receiving inbox was supplied/confirmed. The clarification remains unanswered at reporting. Existing local Gmail settings were not treated as an approved isolated transport. The repository's old live-email script has a hard-coded real recipient and reports SMTP acceptance as success; it was not executed. No production email credential was changed.

Separately, **local transport integration passed** using Nodemailer and a real loopback SMTP receiving fixture restricted to `@fixture.invalid`. The browser receiver captured one reset email and three owner/administrator alerts; duplicate-alert tests received no extra messages. [Receipt](release-blockers/evidence/reused/docs/final-defense-qa/it-eval/evidence/browser/smtp-receipt.json). This validates local application delivery and body receipt, **not** an external mailbox, live provider authentication, spam placement or production deliverability. SMTP acceptance logs and fixture receipts are not substituted for the blocked live inbox check.

## 5. Regression and validation results

| Suite | Final result |
|---|---|
| Security/profile/recovery/lockouts | **PASS — 67 assertions.** [Run](release-blockers/evidence/RB-security.json). |
| Desktop/mobile browser | **PASS — 26 checks**, 1440px and 390px, including job audits, HR profile, password change/recovery, ESS login, fifth-failure messages, platform audit privacy and safe deletion. [Run](release-blockers/evidence/RB-browser.json), [checks](release-blockers/evidence/reused/docs/final-defense-qa/it-eval/evidence/browser/checks.json). |
| Separate Platform Administrator authentication | **PASS — 59 original checks**, plus rejection of an unlinked employee before configuring its test fixture. [Run](release-blockers/evidence/RB-platform-final.json), [log](release-blockers/evidence/RB-platform-final.log). |
| Staff sessions/security | **PASS — 63 assertions.** [Run](release-blockers/evidence/RB-staff-verified.json). |
| Recruitment integrity/concurrency | **PASS — 61 checks.** [Run](release-blockers/evidence/RB-recruitment-verified.json). |
| ESS | **PASS — six scenario groups.** [Run](release-blockers/evidence/RB-ESS-verified.json). |
| Attendance/RFID | **PASS — 65 assertions.** [Run](release-blockers/evidence/RB-RFID-verified.json). |
| Payroll integration/workflow/presentation/phase 3/B3 readiness | **PASS — 156 assertions** (56/24/28/15/33). [Run](release-blockers/evidence/RB-payroll-verified.json), [summary](release-blockers/evidence/reused/docs/final-defense-qa/it-eval/evidence/payroll-summary.json). |
| Statutory/BIR pure regression | **PASS — 149 tests.** [Result](release-blockers/evidence/statutory.json). Historical success does not verify November compliance. |
| Prisma validation and clone migration status | **PASS.** [Validation](release-blockers/evidence/prisma.json), [migration status](release-blockers/evidence/migration-status.json). |
| TypeScript, targeted ESLint, production build | **PASS.** [TypeScript](release-blockers/evidence/typescript.json), [lint](release-blockers/evidence/lint.json), [build](release-blockers/evidence/build.json). |
| Original local files | **PASS — 2,200 baseline files byte-identical**, including all Batch 1–3 and IT source, reports/evidence and environment files. [Result](release-blockers/evidence/file-preservation.json). |
| Existing clone public records | **PASS — all 73 original tables preserved**, new public security/reset tables empty. [Result](release-blockers/evidence/final-data-preservation.json). |
| Extended drift | **FAIL / owner disposition required** for one pre-existing unattached helper; all compared migration-owned definitions match. [Result](release-blockers/evidence/schema-drift.json). |

Counts have different units and repeated runs are not added together. Prior reports and test implementations remain unchanged; reused evidence writes were redirected into this batch.

Failed/intermediate runs are retained honestly:

- Concurrent schema setup initially hit PostgreSQL's shared Prisma advisory-lock P1002 timeout. No test assertion ran in those failed setups. The new runner retries only this lock timeout with a finite limit, never resets a database or marks a failed migration applied. All repeated target suites passed.
- The legacy platform test tried to create an EMPLOYEE session without an activated EmployeeAccount. Production correctly rejected it. A test-only adapter now first asserts that rejection, then creates the missing fictional employee configuration; its obsolete dependent-fixture cleanup was replaced by retaining the owned schema. Application guards were not weakened. Initial failed runs remain recorded.
- A compatibility client staged under .next was removed by the concurrent production build. It was regenerated from the same deployed schema/source into ignored node_modules cache and the seven checks passed.
- Function comparison initially included CRLF/LF differences and extension-owned functions living once in public. Normalizing line endings only and excluding extension objects exposed the genuine remaining helper drift; it was not hidden by normalization.
- Provider rejected a custom suspend-interval option before branch creation. A follow-up list confirmed no partial branch; creation with account defaults succeeded. No production setting changed.

## 6. Exact production migration/release sequence — future operator only

**Do not execute this section until all explicit approvals below exist.** The old Batch 2 instructions expected 39 total migrations and are historical; this release must approve **40**, with these exact two pending migrations.

1. **Freeze release and verify identities.** Record current main/candidate SHA, active production deployment ID, production alias, project/team, effective deployment-skip state and competing workflows/hooks. Bind the active deployment's effective database to branch/endpoint/database/schema through an owner-approved runtime identity check that prints IDs only. Stop on any mismatch. Separately verify Preview has a different endpoint/role and isolated mail/storage configuration.
2. **Review immutable artifacts.** Approve the two SQL hashes above, installed Prisma 6.19.3 and the complete 40-migration tree. [Prepared bundle manifest](release-blockers/evidence/migration-bundles.json) lists every copied hash. The first-39 bundle uses the deployed commit's schema; the all-40 bundle uses the current schema. Bundles live in ignored cache and are preparation artifacts, not authorization.
3. **Establish recovery immediately before the window.** Create/confirm an owner-approved named snapshot or recovery point on the verified runtime production branch; record ID, source branch, LSN/timestamp, expiry/retention, restore permissions and availability. Do not rely solely on an old snapshot or retention setting. Validate recovery into a separate isolated target with email/integrations disabled. A private approved pg_dump is an additional option; never commit a dump, copy secrets into commands, or restore over production to test recovery.
4. **Run read-only preflight.** Use [preflight.sql](release-blockers/preflight.sql) on the same bound endpoint, with statement timeout. Require 38 successful matching migrations, zero unresolved/unknown migrations, absent new objects and exactly the two pending migrations. Explicitly dispose of or accept the documented helper drift through owner approval. Review locks and arrange a short write/DDL window if needed; do not kill sessions automatically. Recheck the candidate and backup immediately before writes.
5. **Migration 39, then verify.** With the approved target injected only into the operator process, run the reviewed first-39 bundle using the installed CLI:

   ```powershell
   node node_modules/prisma/build/index.js migrate deploy --schema node_modules/.cache/workpulse-release/migration-first39/schema.prisma
   ```

   Require 39 successful migrations, matching OTP checksum, correct three columns/defaults, no unresolved entry and preserved original fields. Keep the existing application deployed. Stop on failure; inspect history/objects and do not assume all DDL was rolled back.
6. **Migration 40, then verify.** Only after the stage-39 check succeeds:

   ```powershell
   node node_modules/prisma/build/index.js migrate deploy --schema node_modules/.cache/workpulse-release/migration-all40/schema.prisma
   node node_modules/prisma/build/index.js migrate status --schema node_modules/.cache/workpulse-release/migration-all40/schema.prisma
   ```

   Use [postflight.sql](release-blockers/postflight.sql). Require 40 successful matching migrations, no unresolved entry, exact new tables/indexes/check/FKs/function/trigger, unchanged existing definitions, and expected data preservation. A subsequent deploy must be a no-op. No fake applied markers, reset, db push, destructive downgrade or history deletion is permitted.
7. **Recovery on failure.** Keep the release frozen and retain the old application when schema-compatible. Capture credential-free migration/catalog errors. Never blindly rerun partially applied SQL or mark it completed. Any forward repair, migration-history reconciliation or database cutover requires separate reviewed approval. Prefer leaving additive objects in place over dropping newly created audit/reset data. If restoration is necessary, restore to a separate target, validate consistency and reconcile writes made after the snapshot before approving cutover. Restoring old data directly over production can discard legitimate HR/payroll history and is not authorized by this plan.
8. **Only then consider push/release.** After verified deployment prevention, migration/postflight approval, safe Preview configuration and actual inbox receipt, approve the exact commit and push separately. Keep auto-release suppressed during independent review/testing. Any staged production deployment, promotion or re-enabling automatic releases requires its own explicit approval. Record rollback application SHA and effective endpoint; do not force-push or assume old deployment environment snapshots update automatically.

## 7. Remaining gates, approvals and assessment

| Gate | Status / required approval |
|---|---|
| Additive migration technical compatibility | **GO on the isolated snapshot clone**, with focused old-client compatibility and preserved data. Production remains unmigrated by instruction. |
| Existing helper drift | Owner must accept the baseline or separately approve reviewed cleanup; no automatic production deletion. |
| Runtime production database binding | **BLOCKED** pending owner-approved, non-secret runtime endpoint evidence. |
| Preview isolation | **NO-GO** until the owner authorizes and verifies separate database/mail settings; shared Blob access also needs review. |
| Automatic release prevention | **BLOCKED** until a specific live setting change is authorized, applied and independently verified. None changed here. |
| Live email delivery | **BLOCKED** pending approved isolated SMTP configuration, controlled receiving inbox and actual mailbox receipt evidence. |
| Backup/restore at production window | Owner must approve a fresh recoverable point and safe separate-target restore validation. The rehearsal clone is evidence, not a current production rollback guarantee. |
| Production migration | Separate explicit approval for the exact target, two reviewed migrations, write window, backup, gates and postflight. **Not granted/executed in this task.** |
| Push and deployment/promotion | Separate explicit approval for the reviewed commit and verified release controls. **Not executed.** |

The local candidate is suitable for independent code review and a future local commit after review. **It is not ready to push to main or release under the current external configuration.** Application/security regression failures were not reproduced in the completed final suites; external configuration and drift gates cannot be closed by changing production without authorization.

Existing limitations remain: legacy unverified accounts need proper activation/verification; lockout email uses at-most-one SMTP attempt rather than a durable retry worker; audits show the latest 100 recorded events; duplicate recruitment archive remains deferred; **November payroll compliance remains NO-GO under unchanged statutory verification coverage**. No verification date was extended and historical tests were not relabeled as current compliance.

The isolated branch and owned schemas are retained for review, including dependent synthetic fixtures. Cleanup requires an approved isolated-target plan; no real records or immutable official history were deleted. Stopped after rehearsal, validation and reporting. No push or deployment.
