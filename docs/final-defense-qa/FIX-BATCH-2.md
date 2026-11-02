# Final-defense stabilization — Batch 2: Production OTP readiness

Date: **2026-11-02, Asia/Singapore**. Evidence captured on 2026-11-01 UTC. Scope: production identity/migration inspection, isolated OTP upgrade rehearsal, configuration review, and release preparation. **No production migration, production record mutation, commit, push, deployment, payroll fix, or Batch 3 work was performed.**

## Executive summary and decision

**Isolated technical rehearsal: GO. Production migration/release execution: NO-GO pending the explicit gates below.**

The OTP migration is exactly one additive `ALTER TABLE`, adding only `otpHash`, `otpNonce`, and `otpAttempts`. A real PostgreSQL **38 → 39 migration rehearsal passed 13 checks** with synthetic legacy registrations. Original fields were preserved, and legacy links, new OTPs, cross-device verification, resend, expiry, tenant creation and replay rejection worked after upgrading.

Registration service tests passed **61 assertions**, the actual browser/local SMTP suite passed **27 checks**, and Vercel-style path-hosting compatibility passed **6 checks**. Batch 1 job, staff-security and tenant-routing regressions passed **17, 63 and 64 checks**, respectively. TypeScript, targeted lint, Prisma validation and the production build passed. These overlapping counts have different units and are not summed as one end-to-end total.

The connected services now identify the active Vercel production deployment and the Neon branch named `production`. However, **the active deployment's effective protected `DATABASE_URL` has not been independently bound to that Neon endpoint**. A matching local URL and a provider branch name are insufficient proof. Project environment metadata confirms required names exist, but not the values attached to the active deployment. A fresh owner-verified recovery point and production SMTP/secret validation are also outstanding.

**Do not execute the migration or release Batch 1 from this report alone.** First establish runtime target binding, confirm active configuration and recoverability, review the exact candidate, and obtain explicit approval for each production write/release step.

## Preservation and scope

Read [FIX-BATCH-1.md](FIX-BATCH-1.md) and the four original QA reports. Batch 1's application fixes and test change remain intact and uncommitted:

- `src/features/hiring/actions.ts`
- `src/lib/auth/session.ts`
- `scripts/test-staff-session-security.cjs`

Batch 2 introduced **no application, dependency, Prisma schema, repository migration, style or environment-file changes**. All new work is under this report and `batch-2/`. The starting checkout remains `cfcbd8512edbc3e74148e2541ed03bc9f37ec3cd` with the same three tracked Batch 1 edits. Hash verification covers all tracked files, original report text, `FIX-BATCH-1.md`, the entire Batch 1 evidence folder, and all three environment/rehearsal files. [Preservation audit](batch-2/preservation.json).

The inherited registration browser harness refreshes three representative shared QA screenshots; these are generated UI captures, not Batch 1 report/evidence-folder changes. The original Markdown reports and Batch 1 artifacts remain unchanged. No teammate application work was checked out, merged, reverted or overwritten.

## Verified identities and the unresolved production binding

### Vercel, read-only connected metadata

| Item | Observed value |
|---|---|
| Team ID | `team_UJrtsVOW9iHGOJYrMtflRVU2` |
| Project | `work-pulse` / `prj_O3lYRwFRzfShyGDhCzek5v0gW4pr` |
| Connected repository | `JmGarcia30/WorkPulse` |
| Production alias inspected | `work-pulse-omega.vercel.app` |
| Deployment serving that alias | `dpl_ERChyxVGShH7Sf81ykMzih25qxvb` |
| Deployment URL | `work-pulse-ouvmcqa5a-jose-miguel-garcias-projects.vercel.app` |
| State/target | `READY` / `production` |
| Deployment Git SHA/ref | `c820c5207d66399fd8d5bd2cef4c19332d87935b` / `main` |

Project/deployment/domain and environment metadata were read through connected tools. Environment decryption was **not requested**. No configuration was changed. [Sanitized provider evidence](batch-2/provider-metadata.json).

### Neon and live read-only SQL

| Item | Observed value |
|---|---|
| Neon project | `WorkPulse` / `late-block-61364102` |
| Region/PostgreSQL | `aws-ap-southeast-1` / PostgreSQL 18 |
| Provider production-named branch | `production` / `br-hidden-violet-azjl3vam` |
| Provider branch flags | Primary/default; provider `protected=false`; still treated as protected by this QA |
| Compute endpoint | `ep-weathered-mouse-azpx765h` |
| Database/schema reached using local protected candidate | `neondb` / `public` |
| Read-only enforcement | `default_transaction_read_only=on` |
| Recovery branch | `br-damp-fog-azmmxhga` / `ep-wild-mud-az8yzifu` |

Neon search, branch/project metadata and endpoint listing independently associate the production-named branch with that endpoint. Live SQL using the local protected candidate returns the same branch/endpoint/database. The candidate is therefore **a verified Neon production-named database**, not merely an arbitrary local endpoint.

**Still BLOCKED:** proving that this is the database used by the active Vercel deployment. Production `DATABASE_URL` is stored as a non-readable sensitive variable. No Neon integration configuration or project connector binding was returned by the read-only Vercel tools. The active deployment's effective secret value/runtime database identity was not available. Do not replace this missing proof with an assumption, an environment overwrite, or a diagnostic deployment without approval.

Required owner evidence: an existing deployment-specific secret provisioning/binding record or existing authorized runtime identity evidence that ties deployment `dpl_ERChyxVGShH7Sf81ykMzih25qxvb` to the exact Neon project, branch, endpoint, database and schema. If that evidence names a different database, repeat the entire read-only comparison for that confirmed target and stop this candidate's migration plan.

## Migration history and SQL review

Both the initial and final metadata inspections used enforced read-only connections and selected only identity, migration history and schema metadata. No production registration submission or production business-record edit was attempted.

| Target | Repository migrations | Applied | Pending | Checksum mismatch / unresolved / unknown |
|---|---:|---:|---|---|
| Verified Neon production-named candidate | 39 | **38** | `20261027000100_company_registration_otp` only | None |
| Existing recovery database | 39 | **39** | None | None |

[Initial candidate evidence](batch-2/evidence/database-protected.json), [final candidate evidence](batch-2/final-readonly/database-protected.json), [final recovery evidence](batch-2/final-readonly/database-development.json). The missing migration remained unapplied after QA. Applied checksums were compared allowing LF/CRLF normalization.

Reviewed file: [migration.sql](../../prisma/migrations/20261027000100_company_registration_otp/migration.sql).

```sql
-- REVIEWED SQL ONLY — NOT EXECUTED AGAINST PRODUCTION
ALTER TABLE "CompanyRegistration"
  ADD COLUMN "otpHash" TEXT,
  ADD COLUMN "otpNonce" TEXT,
  ADD COLUMN "otpAttempts" INTEGER NOT NULL DEFAULT 0;
```

SHA-256, raw and LF-normalized in this checkout:

`03544310cff45c2014a32aeaf2874239f1f3c00c1a744c4307b6cd29cfa133c9`

The review harness asserts the entire non-comment statement matches that exact SQL. It contains no DML, drop, rename, index/constraint replacement, secret update or business-record conversion. Existing columns remain unchanged; new hash/nonce fields are nullable, and existing rows obtain a zero attempt default. [Review manifest](batch-2/release-preparation.json).

It is additive but still acquires a table lock. PostgreSQL 18 can add a nonvolatile constant default without rewriting every row, but lock acquisition can wait behind other transactions. A short approved maintenance window and bounded lock/statement timeouts are still required. [PostgreSQL ALTER TABLE reference](https://www.postgresql.org/docs/18/sql-altertable.html), [timeout settings](https://www.postgresql.org/docs/18/runtime-config-client.html).

The raw SQL is **not** idempotent: running it again would encounter existing columns. The **Prisma migration deployment** is history-aware; the repeated isolated deploy was verified as a no-op. Do not add `IF NOT EXISTS`, change reviewed migration bytes, manually apply SQL and blindly mark it applied, or replace migration history to force success.

## Isolated upgrade and regression results

Tests ran on new empty schemas within the independently verified recovery branch, not existing recovery tables or production. The migration rehearsal deployed the first 38 repository migrations, inserted four synthetic pre-OTP records, copied in the exact reviewed migration, and deployed migration 39. No real registration row or recipient was used.

| ID | Executed scenario | Result / evidence |
|---|---|---|
| B2-M01 | Pre-upgrade schema actually lacks OTP columns | PASS |
| B2-M02 | Upgrade adds exactly three columns; all previous column definitions unchanged | PASS |
| B2-M03 | Original fields preserved for pending, expired, verified/linked, and failed-delivery registrations | PASS, all four rows |
| B2-M04 | Existing rows receive null hash/nonce and zero attempts | PASS |
| B2-M05/M06 | 39 successful history records; repeated deploy has no pending work | PASS |
| B2-M07/M08 | A pre-migration pending legacy link verifies cross-device after upgrade; expired legacy link remains rejected | PASS |
| B2-M09/M10 | New six-digit OTP creates no user before verification; cross-device resend invalidates old code | PASS |
| B2-M11/M12/M13 | Expired code rejected; replacement code creates only its own HR tenant; reuse rejected | PASS |

All 13 upgrade checks: [result](batch-2/evidence/B2-migration-rehearsal.json), [harness](batch-2/migration-rehearsal.cjs), [38-migration baseline log](batch-2/evidence/B2-before-38.log), [upgrade log](batch-2/evidence/B2-apply-otp.log), [no-op redeploy log](batch-2/evidence/B2-repeat-deploy.log). Emails in this upgrade-specific harness used an injected synthetic-only sender; transport is exercised separately below.

| ID | Additional test | Result | Evidence |
|---|---|---|---|
| B2-registration-service | Correct/wrong/expired/reused/resend/exhausted OTP, legacy compatibility, cross-device proof, delivery failure, activation atomicity and rate limits | **PASS, 61 assertions** | [Log](batch-2/evidence/B2-registration-service.log) |
| B2-registration-browser | Actual registration → loopback SMTP → cross-device resend/verification → tenant login → branding; concurrent attempts/verification | **PASS, 27 checks** | [Checks](batch-2/evidence/legacy/docs/company-registration-otp/browser-tests.json), [log](batch-2/evidence/B2-registration-browser.log) |
| B2-layout | Reused browser matrix on 19 HR routes at desktop/mobile widths | **PASS, 57/57** | [Matrix](batch-2/evidence/legacy/docs/company-registration-otp/qa-layout-matrix.json) |
| B2-hosting-compatibility | Vercel `/w/tenant/login`, signed routing and persisted tenant resolution; HTTP/conflicting root/public origin rejection | **PASS, 6 checks** | [Log](batch-2/evidence/B2-hosting-compatibility.log) |
| B2-job-preservation | Batch 1 failed-edit/DB rollback, authorization and concurrency regression | **PASS, 17 checks** | [Log](batch-2/evidence/B2-job-preservation.log) |
| B2-staff-security | Production cookie/session revocation, roles, tenant binding, copied tokens and kiosk separation | **PASS, 63 checks** | [Log](batch-2/evidence/B2-staff-security.log) |
| B2-tenant-routing | Signed host/path routing and cross-tenant document/configuration/session isolation | **PASS, 64 checks** | [Log](batch-2/evidence/B2-tenant-routing.log) |
| B2-typescript | Full `tsc --noEmit --incremental false` | **PASS** | [Result](batch-2/evidence/B2-typescript.json) |
| B2-targeted-lint | Registration, platform email entry point, tenant host logic and Batch 1's three tracked files | **PASS** | [Result](batch-2/evidence/B2-targeted-lint.json) |
| B2-prisma-validation | Installed Prisma schema validation | **PASS** | [Result](batch-2/evidence/B2-prisma-validation.json) |
| B2-production-build | Installed Next optimized webpack build | **PASS** | [Log](batch-2/evidence/B2-production-build.log) |
| B2-cli | Installed Prisma 6 migration-deploy command/help | **PASS** | [Help](batch-2/evidence/B2-prisma-cli-help.log) |

The browser sink binds to loopback and accepts only `@fixture.invalid` recipients. No real SMTP account was authenticated and no live email was sent. Actual production email delivery, production registration, and production migrations are **NOT TESTED / NOT EXECUTED**. The hosting test uses the production hostname as an in-process configuration string; it makes no production web request.

Tests used Prisma/client **6.19.3**, Next **16.3.6**, Node **24.18.0**. The build portion was run directly as `next build --webpack`; no schema/dependency change required a client upgrade. Do not substitute newer online Prisma command conventions for this project's installed, tested version.

## Secrets, SMTP and compatibility review

No secret values were printed, decrypted, pulled to files, rotated or changed. [Metadata](batch-2/provider-metadata.json), [local boolean-only checks](batch-2/configuration-review.json).

| Configuration | Code requirement and observed status | Remaining verification |
|---|---|---|
| `DATABASE_URL` | Production-scoped sensitive variable exists. Local candidate reaches the verified Neon branch. | Active deployment's exact database binding and migration credential authority remain unproven. |
| `SESSION_SECRET` | Production-scoped sensitive variable exists. Local profiles meet the code's 32-character minimum. | Actual deployed value/length/stability cannot be established from metadata. Do not rotate it during rollout. |
| `COMPANY_REGISTRATION_OTP_SECRET` | Optional dedicated OTP HMAC key, otherwise `SESSION_SECRET`; chosen key must have at least 32 characters. No dedicated key appears in returned metadata. | Absence is supported, not itself a blocker. Owner must confirm the intended stable fallback/key across instances and deployments. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Production-scoped sensitive names exist; the current production metadata lists the Gmail group rather than generic SMTP group. | Owner must confirm the active deployment's actual mailbox/app password, sender permission and delivery. Presence alone is not authentication or deliverability proof. |
| Generic SMTP alternative | `SMTP_HOST`, port/secure mode, `SMTP_USER`, `SMTP_PASSWORD` are supported. Gmail credential variables take precedence over SMTP credential variables in code. | Use one coherent group; do not combine a custom host with unrelated Gmail credentials. No generic group was returned for Production. |
| `EMAIL_FROM` | Production-scoped name exists. OTP uses `requireConfiguredSender`, which selects the authenticated mailbox rather than this branding override. | Changing `EMAIL_FROM` alone cannot repair failed OTP sender authentication. |
| `PLATFORM_ROOT_DOMAIN` / `PLATFORM_PUBLIC_ORIGIN` | Both names exist for Production; values are sensitive/non-readable. Origin must be canonical, HTTPS, with matching root/public host and no path/query/credentials. | Owner must validate actual active values. For a `.vercel.app` root, use the canonical single host and `/w/:slug`, not invented wildcard Vercel subdomains. |
| OAuth/email encryption, Blob, AI keys | Their Production names are visible in metadata. They serve other integrations. | They are not a substitute for platform OTP SMTP. No unrelated key or integration was changed/tested here. |

Compatibility considerations:

1. **Database first:** current OTP code references the new columns. If the inspected 38-migration candidate is the runtime database, OTP operations would encounter a schema incompatibility. No live production request was submitted to demonstrate an outage.
2. **Legacy records:** additive columns do not erase `tokenHash`, `browserHash`, password hashes, existing organization links, expiry or verified state. Pre-upgrade legacy-link compatibility was actually tested.
3. **Key stability:** OTP verification is keyed HMAC. Introducing a different dedicated OTP key or rotating the fallback invalidates pending codes; rotating `SESSION_SECRET` also affects sessions/routing. Keep existing keys stable in this release unless a separately approved rotation/reissue plan exists.
4. **Mail unavailable:** sensitive verification messages fail closed without exposing code-bearing previews; no active user/tenant is created merely because mail fails. Service failure-path tests passed. Production sender health remains unverified.
5. **Deployment snapshots:** current project environment metadata is not proof of values captured by an older deployment. Configuration changes affect subsequent deployments and must be reviewed with the release, not assumed effective immediately. [Vercel environment-variable documentation](https://vercel.com/docs/environment-variables).
6. **Batch 1:** the cookie-expiration and job-atomicity fixes remain unchanged. No payroll-rule or legal/hiring safeguard was bypassed.

## Backup and recovery readiness

Read-only Neon metadata for the candidate project reports:

- Configured history retention: **21,600 seconds / six hours**.
- One listed snapshot for this source branch: `snap-wandering-block-az759oda`, created **2026-10-25T13:46:47Z**.
- Snapshot schedule response: empty.

[Backup metadata](batch-2/backup-metadata.json). No snapshot/export was created and no restore was attempted. A retention setting does not prove a particular recoverable timestamp, and the old snapshot is not a fresh pre-migration recovery point. Its current restore usability/expiry and the owner's restoration authority were not established.

**Required before approval:** confirm the actual runtime branch, record an available recovery point immediately before the approved window, verify its availability and restore permissions, and validate recovery into a separately authorized isolated target. Keep backup contents outside Git/report artifacts and disable mail/integrations on any restored validation target. An approved private `pg_dump` export is an alternative/additional safeguard; supply credentials via an authorized credential provider, not process arguments or copied report text. Do not restore over production as a routine rollback.

## Production migration runbook — prepared only

**Every production write in this section requires separate explicit approval. None was executed.** Do not execute steps on the basis of a provider branch name alone.

### 1. Freeze provenance and prove the runtime target

1. Re-resolve the Production alias and record the deployment ID and immutable SHA. If either differs from this report, inspect/review that delta before proceeding.
2. Obtain owner-verifiable evidence binding that deployment's effective `DATABASE_URL` to a specific Neon project, branch, endpoint, database and schema. Do not print the URL or pull secrets into the workspace.
3. Use an approved **direct/non-pooled** migration connection for that verified target. Credentials must be supplied only to the short-lived approved process. Preserve deployed environment variables and local `.env` files.
4. Execute the supplied [read-only preflight](batch-2/preflight.sql). Confirm identity, `public` schema, all applied checksums, no unresolved/unknown migrations, and **exactly one pending migration: the reviewed OTP migration**. Confirm the three columns are absent. Unexpected history, already-present columns, drift or a different endpoint is a stop condition, not permission to repair production ad hoc.
5. Confirm repository migration set is still the reviewed 39 and that the migration's normalized SHA-256 matches this report. Preserve an immutable copy of migration/history metadata for the owner.

### 2. Establish the window and recovery point

1. Owner approves the target, SQL/hash, operator, timing, recovery artifact and failure authority. Establish a low-traffic registration window using an existing approved operational mechanism; do not add a new feature or silently stop the whole service.
2. Create/verify the fresh approved recovery point and record its UTC timestamp/ID and restoration route. Confirm it precedes the migration and is within the actual recoverable range.
3. Check active locks/long transactions on `CompanyRegistration` using metadata-only diagnostics; do not dump application SQL/parameters. Resolve contention through the normal operator process. Do not kill production sessions automatically.
4. Set bounded migration-process connection options, for example a **5-second lock timeout and 60-second statement timeout**. These are proposed operational limits to approve for the window, not permanent database settings. Keep Prisma's advisory locking enabled. [Timeout reference](https://www.postgresql.org/docs/18/runtime-config-client.html).

### 3. Apply only through the pinned migration tool

Use the reviewed migration tree and installed/pinned **Prisma 6.19.3**, after all gates and write approval:

```text
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
```

The process's `DATABASE_URL` must come from the approved secret source, select the independently verified direct endpoint/database/`public` schema, and carry the approved timeout options. Do not put a database URL in command-line arguments, shell history or report text. Do not run from a checkout containing additional unreviewed migrations; `migrate deploy` applies pending migrations, not a named single target. No `migrate dev`, `db push`, reset, seed, history rewrite or advisory-lock disabling is permitted.

The exact SQL already exists in deployed commit `c820c52`; this is an unapplied database prerequisite, not a request to generate a new migration. The isolated rehearsal applied it through Prisma and confirmed a subsequent deploy was a no-op.

### 4. Post-migration read-only verification

1. Execute [postflight.sql](batch-2/postflight.sql) against the **same verified endpoint**. Require all 39 migrations successfully recorded, the new migration checksum matching the approved bytes/normalization, and no failed/unresolved entry.
2. Require exactly these definitions: nullable text `otpHash`; nullable text `otpNonce`; non-null integer `otpAttempts` with default zero. Inspect metadata for preservation of old columns/constraints. Do not print registration rows or secret hashes.
3. Compare approved non-sensitive baseline counts/metadata from the window if available; account for legitimate concurrent activity rather than assuming every count change was caused by DDL. Existing-field preservation was proved on synthetic legacy rows in rehearsal, not by exporting production records.
4. Check current application/runtime errors using redacted diagnostics. A production registration/tenant smoke test **creates records and sends mail** and therefore needs its own explicit approval and controlled recipient/account plan. Until then, use the passing isolated browser/service flow as functional evidence; do not claim a live production signup passed.
5. Record final identity/history/result with the owner, then release the operational window only when postflight succeeds.

### 5. Failure handling

- **Preflight mismatch or no backup:** stop before writes; retain read-only findings. Do not substitute the recovery branch as production.
- **Lock/statement timeout:** stop, collect redacted error and history/column metadata, and investigate contention. Do not disable locks or retry blindly.
- **Migration process fails:** the single `ALTER TABLE` is one statement, but process failure can leave migration bookkeeping requiring inspection. Determine separately whether none/all of the columns exist and whether the migration record is finished, failed or unfinished. Do not edit `_prisma_migrations` directly.
- **History/schema disagreement:** any `migrate resolve --rolled-back` or `--applied` reconciliation is a separate reviewed/approved write, only after proving actual schema state and exact migration contents. Never mark applied to hide a failed/missing change.
- **DDL succeeds but application fails:** prefer forward diagnosis or rollback to a reviewed schema-compatible application deployment while **retaining the additive columns**. Do not drop columns to undo this release; pending OTP state may already exist. An older link-only application cannot necessarily process newly issued OTPs, so review that compatibility before rollback.
- **Recovery required:** restore the approved backup to a separate isolated target first, validate, and seek explicit approval for any cutover/production restore. Restoring an old database over production could discard unrelated employee, attendance, payroll and organization changes. That is not authorized by this report.

## Releasing Batch 1 without mixing unreviewed changes

The local checkout is still `cfcbd85`; the live deployed baseline is `c820c52`, three careers styling commits ahead. Do not push the entire current workspace or use `git add .`.

Prepared artifact: [batch-1-reviewed-files.patch](batch-2/release/batch-1-reviewed-files.patch).

SHA-256: `c53a32275ad240868778ddd013d0b7b342870eddbc075970c30ec07497913631`.

The patch contains only the two Batch 1 application files and its staff-security test fixture. All three base files are byte-identical between local HEAD and deployed `c820c52`. A **temporary, separate Git index** successfully checked patch application against `c820c52`; the actual working tree/index, branch and commits were not replaced. [Preparation evidence](batch-2/release-preparation.json).

After review/approval, the release operator should:

1. Reconfirm active deployment SHA and remote `main`; if either changed, review the differences and regenerate/check the candidate. Approve the deployed baseline explicitly. It includes existing live careers UI work, not new Batch 1 changes.
2. Create a separate release branch/worktree from the approved baseline outside this active teammate workspace. Apply the selected patch with `git apply --index`, then require staged paths to be exactly those three files. Keep QA evidence/test helpers as separately selected review artifacts; do not bulk-stage the untracked QA directory or any `.env`/storage/build artifacts.
3. Review the staged diff, migration hash and selected regression artifacts. Commit only after authorization. No commit was created here.
4. Run TypeScript, targeted lint, optimized build, OTP upgrade/service/browser, Batch 1 regressions and the affected careers smoke checks on the **exact combined release SHA**. This report tested the current checkout plus Batch 1, not a newly committed `c820c52 + patch` candidate. Patch applicability is not a substitute for those tests.
5. Get approval before any push. A non-production branch push may create a Vercel Preview automatically; it must use isolated credentials and controlled SMTP, never production. Confirm project/environment bindings before such a push.
6. Obtain separate approval for the production migration and for deployment/promotion. Complete the verified database-first/postflight sequence, then release only the reviewed immutable application SHA through the normal PR/release path. No force-push and no unrelated commits.
7. After approved deployment, repeat read-only schema/runtime identity checks and verify cookie clearing/job editing in a separately authorized controlled smoke test. Record deployment ID/SHA and a reviewed compatible rollback target.

## Remaining blockers and final assessment

| Gate | Status |
|---|---|
| Additive SQL review and synthetic 38 → 39 upgrade | **PASS / technically ready** |
| Local OTP, legacy, browser SMTP and compatibility regressions | **PASS** |
| Batch 1 preservation and regressions | **PASS** |
| Exact active Vercel deployment → effective database binding | **BLOCKED / UNVERIFIED** |
| Actual deployed secret values/host pair and SMTP sender health | **UNVERIFIED; metadata presence only** |
| Fresh pre-migration recoverable point and restore validation | **NOT ESTABLISHED** |
| Exact combined release SHA built/tested and reviewed | **NOT YET CREATED / NOT TESTED** |
| Production migration, commits/pushes and deployment approval | **NOT GRANTED / NOT EXECUTED** |

Seven Batch 2 manifest-owned synthetic schemas were removed after rechecking recovery identity. Nested registration-browser schemas were disposed by that suite. [Cleanup](batch-2/cleanup.json). Final read-only checks still show the candidate at 38/39. Batch 1 and original report text/environment files are unchanged by hash. No payroll work or Batch 3 was started.

**Final decision: NO-GO to execute production writes or release now.** The migration and isolated application flows are ready for review; the target/configuration/recovery/release gates must be closed first. The unrelated current-date payroll limitation and broader defense-readiness gaps in the original reports remain outside this batch.
