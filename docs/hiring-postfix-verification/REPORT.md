# WorkPulse post-fix release verification

Assessment: **FAIL** for the legacy completion-metadata regression; **BLOCKED** for real database/concurrency/browser verification. The implementation is not ready for release sign-off.

## Scope and preservation

Reviewed the original 15 changed/new files described in `docs/hiring-functional-fixes-2026-10-26.md`, plus their authorization, conversion, document-policy, and UI callers. The checkout remains local `main` at `9717589` (`Redesign HR and ESS dashboard UI`).

This verification changed no application code. SHA-256 checks confirm that all original 15 files, the pre-existing `package-lock.json` change, `.env`, and `.env.recovery.local` are unchanged during verification. Additions are the verification-only runner `scripts/verify-hiring-postfix.cjs` and this evidence directory. There were no database writes, migrations, resets, seeds, production database connections, deployments, merges, pushes, or PRs.

## Release-readiness checks

| Check | Assessment | Evidence / limitation |
| --- | --- | --- |
| Review of 15 files for regressions | **FAIL** | Legacy completion timestamp clearing reproduced; details below |
| Tenant isolation and role authorization | **PASS** for source/in-memory tests | Application ownership derives through job; persisted role and organization rechecked; six additional negative boundary tests passed. PostgreSQL integration remains blocked |
| New ESLint violations in original change | **PASS** | 14 code/test files: zero errors, zero warnings; new verification runner also passes |
| Full-repository ESLint | **FAIL — existing** | Same 96 errors and 64 warnings, all outside the original change; no rules weakened |
| Current TypeScript | **PASS** | `node node_modules/typescript/bin/tsc --noEmit`, exit 0 |
| Isolated PostgreSQL identity | **PASS** | Live SQL identity and Neon control-plane agreement; separate non-default branch and endpoint |
| Test schema compatibility | **BLOCKED** | Missing `RecruitmentDocument.requestedAt`; Prisma read returns P2022 |
| Focused real onboarding/recruitment/conversion tests | **BLOCKED** | Current service queries require the missing column; no fixture writes attempted |
| Real concurrent transactions | **BLOCKED** | No compatible disposable target; simulated tests pass but do not prove PostgreSQL concurrent commits |
| Live browser workflow | **BLOCKED** | A schema-incompatible server cannot establish the requested end-to-end workflow; no real browser login/actions attempted |
| Runtime stage-changing entry points | **PASS** | Ordinary transitions use shared stage validation; HIRED uses shared readiness inside conversion; no other runtime status writers found |
| Missing mandatory tasks: active-candidate UI | **PASS** in rendered components | Eight cases across SAGA/generic and teaching/staff show NOT READY and disabled Hire Candidate with all other prerequisites satisfied |
| Missing mandatory tasks: server conversion | **PASS** in actual service with in-memory dependencies | OFFER and legacy HIRED both reject missing policy tasks before writes; existing synthetic suite also covers incomplete COMPLETED processes |
| Legacy completion-metadata preservation | **FAIL** | Verifying an unrelated stored task can reopen a legacy COMPLETED process and erase its prior completedAt |
| Legacy HIRED recovery presentation | **FAIL** for UI/server consistency | Existing UI shows completion claims and enabled Complete Employee Record even with missing tasks; server still rejects new conversion |
| Historical OFFER → HIRED/current OFFER root cause | **BLOCKED / unresolved** | The specific applicant's audit/write history was not queried; no records repaired |
| Existing data and redesign preservation | **PASS** | No database writes; original source/environment/lockfile hashes unchanged |

## Confirmed regression: historical completion metadata

Location: `src/features/hiring/onboarding-actions.ts:449–465`.

Synthetic reproduction against the real action:

1. An authorized HR user opens a legacy process marked COMPLETED with an existing `completedAt` timestamp.
2. That process has a custom stored task but lacks the mandatory current `Organization onboarding review` item. A corresponding SAGA example would lack mandatory institutional template items.
3. HR verifies the custom task from SUBMITTED to VERIFIED.
4. The new policy evaluator correctly returns incomplete because the policy item is missing.
5. The existing automatic-reopen branch now executes: it sets status to IN_PROGRESS and `completedAt` to null.

The verification action did not explicitly request reopening or reconciliation of historical completion. The stored task remains VERIFIED, but the original process-completion timestamp is lost. The prior stored-task-only check would have considered this now-verified custom task complete and would not have reopened this already-COMPLETED process. This is a new consequence of applying the new evaluator to the automatic completion/reopen path.

The reproducer uses in-memory fixtures only; no actual completion timestamp was changed. See `boundaries-and-legacy.json`. This warrants a targeted preservation correction and regression test before release. No correction was implemented during this verification-only task.

## Legacy HIRED presentation

`calculateHiringReadiness` intentionally short-circuits HIRED records to an Already Hired presentation with an empty checklist. `HiringReadinessCard.tsx:143` can then offer Complete Employee Record when no employee link exists, irrespective of missing mandatory tasks. The card also says prerequisites were cleared.

Four rendered legacy cases reproduced this presentation across SAGA/generic and both categories. This behavior pre-existed these fixes. Server conversion correctly calls `calculateHiringPrerequisites` for HIRED and rejects missing mandatory items before creating employee records, so it is not a hiring bypass. It remains a UI/server consistency and legacy-recovery messaging issue; blanket UI-blocking claims must be limited to active applications.

## Database isolation and exact blocker

The available configured recovery target was verified on this turn:

| Property | Verified value |
| --- | --- |
| Neon project | `late-block-61364102` |
| Test branch | `workpulse-ess-design` / `br-damp-fog-azmmxhga` |
| Test endpoint | `ep-wild-mud-az8yzifu` |
| Database / schema | `neondb` / `public` |
| Live metadata connection | `default_transaction_read_only=on` |
| Control-plane flags | default=false, primary=false, ready |
| Default branch | `production` / `br-hidden-violet-azjl3vam` |
| Production endpoint, metadata only | `ep-weathered-mouse-azpx765h` |

The test branch is a separate child of the production branch. Reads/writes on it do not route to the production endpoint. The environment helper additionally rejects an endpoint matching `.env`; its pooled/direct recovery URLs agree. No credentials are included in evidence files.

All 73 generated Prisma models' scalar columns and enum values were compared with catalog metadata. Exactly one scalar column is absent: `RecruitmentDocument.requestedAt`. No enum values or unresolved migrations were found. There are 37 finished, non-rolled-back migrations. Local migration `20261026000000_stage_document_requests` is pending. A read through `db.recruitmentDocument.findFirst({ select: { requestedAt: true } })` confirms Prisma **P2022**.

The new transition service, applicant profile, and employee conversion use recruitment-document includes that expect the current model. Running fixtures despite this mismatch would not verify the current application. No schema workaround, alternate Prisma schema, migration, or reset was attempted.

Other project branches were listed only as metadata: snapshots, pre-change backups, and the retained checkpoint. Only the recovery profile supplies an established disposable target and credentials. Backups were not repurposed; no production fallback was used. The requirement to run real database tests when a *compatible* safe environment exists was not satisfied. A verified compatible disposable schema is required to unblock these checks; this report does not authorize applying the pending migration.

Evidence: `control-plane.json`, `database-preflight.json`.

## Recruitment entry-point audit

Searches covered runtime application updates/upserts, application-status history creation, raw UPDATE statements, shared action callers, and conversion callers.

| Path | Enforcement |
| --- | --- |
| Board card → StatusChangeDialog | Fetches read-only server restrictions; invokes updateApplicationStatusAction |
| Applicant profile → sidebar → StatusChangeDialog | Same component/action; no alternate client mutation |
| updateApplicationStatusAction → transitionApplicationStatus | Session role check, persisted actor/tenant check, application ownership, shared getStageTransitionBlockers, Serializable conditional update plus audit |
| HiringReadinessCard → convertApplicationToEmployeeAction | Session permission check; organization and actor derived from session |
| convertApplicationToEmployeeAction → convertApplicationToEmployee | Transactional actor/tenant ownership; OFFER-only or legacy HIRED handling; calculateHiringReadiness / calculateHiringPrerequisites; atomic employee/status/history writes |
| Public submission | Creates APPLIED explicitly; cannot choose progression status |
| prepareHiredEmployeeRecord | Preview mapper only; does not persist status or employee |

Only `status-transition.ts` and `employees/conversion.ts` persist changes to existing application statuses in `src`. HIRED conversion uses the shared readiness evaluator rather than the board transition function. That is intentional because employee creation and its history must be atomic.

Seeds and legacy test/maintenance scripts have direct status writes outside this runtime boundary. They were not executed and must not be considered safe production transition APIs. Their possible involvement in old history mismatches remains unresolved.

## Review of the original files

| File(s) | Review result |
| --- | --- |
| `onboarding-pipeline.ts` | Read-only template comparison; required flags cannot suppress mandatory template items; documented aliases and waivers retained; exact title/version limitations remain |
| `onboarding-actions.ts` | Tenant/role checks remain; shared template initialization/manual completion verified; automatic legacy reopen regression identified |
| `readiness.ts`, `qualification.ts` | Missing checklist items block; COMPLETED cannot bypass; positive evaluations, passing scores, and SAGA signature requirements are shared with conversion; HIRED presentation limitation noted |
| `stage-prerequisites.ts`, `status-transition.ts`, `actions.ts` | Trusted owning-organization policy, valid graph, rejection/withdrawal, actor checks, conditional status write/audit, duplicate behavior reviewed; no alternative runtime bypass found |
| `lifecycle.ts`, `ApplicantProfileView.tsx`, `HiringProgressTracker.tsx` | Shared step number/count; teaching/staff/generic, terminal, OFFER and HIRED paths reviewed; CSS/layout unchanged |
| `StatusChangeDialog.tsx` | Restriction loading blocks submission, stale requests are ignored, and server checks repeat independently; live interaction awaits browser verification |
| Applicant profile `page.tsx` | Policy resolved from owned job organization; same task titles/statuses passed to UI evaluator as conversion; no read-time checklist initialization |
| `test-hiring-functional-fixes.cjs` | Real services with synthetic models; concurrency is explicitly simulated, not PostgreSQL proof; did not originally cover legacy completedAt clearing |
| `test-hiring-policy.cjs` | Complete positive fixtures and negative document/policy cases; no weakened authorization |
| Original implementation report | Reviewed; superseded by this report for current database availability, legacy-metadata regression, and UI recovery limitations |

## Executed validation

| Command | Result |
| --- | --- |
| `node scripts/verify-hiring-postfix.cjs database` | Identity PASS, schema BLOCKED; catalog reads and expected P2022 only, zero writes |
| `node scripts/verify-hiring-postfix.cjs lint` | Changed-file PASS, repository-existing FAIL |
| `node node_modules/eslint/bin/eslint.js scripts/verify-hiring-postfix.cjs` | PASS |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node scripts/verify-hiring-postfix.cjs components` | Eight active UI assertions PASS; four legacy HIRED presentations observed; static rendering only |
| `node scripts/verify-hiring-postfix.cjs boundaries` | Six boundary/legacy conversion checks PASS; historical completion clearing reproduced and classified FAIL |
| `node scripts/verify-hiring-postfix.cjs regressions` | All five existing suites exit 0: functional fixes (63 groups), policy, candidate security, document headers/private storage, pipeline-page reads |
| `node scripts/verify-hiring-postfix.cjs preservation` | PASS — 18 file hashes unchanged |

Synthetic suites use process-local `NODE_ENV=production` and `PLATFORM_ROOT_DOMAIN=localhost` for their existing secure-cookie/host expectations. They mock email, storage, and database dependencies. Rendered components explicitly reject database access. Test evidence is in the adjacent JSON files. The verification runner required execution outside the Windows filesystem sandbox for tsx/user lookup and the read-only database connection. No package installation or environment-file change was needed.

The prior production build passed; it was not rerun to claim database compatibility. A production build or static render cannot substitute for PostgreSQL/browser tests.

## Remaining risks and next release gates

1. Correct the automatic legacy-completion path so a task verification cannot erase historical completion metadata solely because policy items are absent; retain explicit HR reconciliation and auditability.
2. Decide how legacy HIRED recovery should present missing prerequisites while preserving the established employee-conversion gate. The existing UI should not imply that missing evidence was verified.
3. Provide a positively verified, compatible disposable database. Then run real onboarding completion/conversion, tenant/role boundaries, simultaneous stage changes, conversion/rejection contention, duplicate conversion, and browser profile/board/hire flows with synthetic records and preservation checks.
4. The automatic task-status path still loads task/process state before a default-isolation transaction, unlike manual completion and stage conversion. Stale process completion under simultaneous task verification/reopening remains a concurrency risk to test. Readiness independently checks current task evidence, so a stale COMPLETED label alone cannot permit hiring.
5. Historical tasks lack stable template keys/version snapshots. Exact aliases preserve documented legacy evidence; renamed/unknown or retired required tasks need explicit authorized HR treatment. No fuzzy equivalence or silent backfill is applied. The no-policy utility fallback remains available to compatibility callers, but all audited runtime hiring entry points supply trusted organization policy.
6. The original OFFER → HIRED/current OFFER discrepancy is not attributable to a specific writer yet. Seed status resets and the modeled stale-write defect are plausible code paths, not proven causes for the reported applicant. Employee/history existence and timestamps require a separate authorized read-only record audit. No repair should follow from this verification alone.

No product fixes, migrations, or production actions were performed to make these checks pass.
