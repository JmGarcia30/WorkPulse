# Recruitment and onboarding functional fixes — October 26, 2026

## Scope and baseline

Local `main` and the existing `origin/main` reference both pointed to `9717589` (`Redesign HR and ESS dashboard UI`). No remote fetch, merge, push, deployment, or PR was performed. `package-lock.json` was already modified when work began and was left untouched. No environment files, credentials, schemas, migrations, seeds, or stored application records were changed.

## P3-BUG-01 — incomplete onboarding checklist

**Confirmed cause:** `calculateHiringReadiness` accepted either a COMPLETED process or successful validation of only the tasks present. Neither path established that mandatory policy tasks existed. Manual and automatic process completion also validated only stored required flags.

**Correction:** Initialization and validation now share one template resolver. SAGA uses the existing faculty/staff templates; other tenants retain their configured category-specific document policy and organization onboarding review. Validation checks every mandatory template item, even if its stored task was incorrectly marked optional, plus additional stored required tasks. Missing items, empty checklists, unverified required items, and CANCELLED processes block readiness. COMPLETED never substitutes for evidence. VERIFIED and WAIVED remain valid outcomes.

Only documented legacy title aliases are accepted, including the combined historical TOR/diploma record. Unknown titles or missing policy/category context require review rather than an automatic rewrite. Evaluation does not write tasks or documents. The applicant profile no longer initializes recruitment documents while reading readiness.

The existing employee conversion service already invokes this readiness evaluator inside its serializable transaction, including prerequisite evaluation for legacy HIRED applications. It therefore enforces the corrected rules without changing conversion persistence, tenant checks, probation rules, or idempotency behavior.

**Retest:** PASS using synthetic fixtures: complete, empty, partial, pending, incorrectly optional, waived, cancelled, documented/unknown legacy titles, both SAGA categories, custom tenant policy, conversion denial before writes, successful conversion, and conversion retry.

## P2-BUG-01 — recruitment prerequisites

**Confirmed cause:** The status action checked the status adjacency graph, but never evaluated interviews, evaluations, examinations, or institutional endorsements. Its read occurred outside the status/history transaction.

**Correction:** A shared transition evaluator retains the existing adjacency graph and applies these gates:

| Destination | Required checks |
| --- | --- |
| SCREENING | Existing valid transition and authorization |
| SHORTLISTED / INTERVIEW | Applicable organization's mandatory recruitment documents satisfied using existing document-policy semantics |
| ASSESSMENT | Documents plus assigned early interviews completed with positive evaluation |
| OFFER | Documents, assigned assessments, assigned interviews, and SAGA's mandatory examination/HOD/President gates; teaching demonstration for faculty only |
| HIRED | Existing dedicated employee conversion; ordinary status action remains prohibited |
| REJECTED / WITHDRAWN | Existing authorized terminal workflows; no recruitment completion gate |

SAGA's ASSESSMENT board column groups written examination, teaching demonstration (faculty), HOD interview, and President interview. Those later institutional interview types do not block entry into ASSESSMENT: that would put interviews before the required examination. A scheduled initial screening still blocks entry. All required institutional outcomes must clear before OFFER. No new mandatory initial-screening interview is invented if one was never assigned.

Completed interviews require RECOMMEND or STRONGLY_RECOMMEND. Missing evaluations, MAYBE, negative recommendations, scheduled interviews, and no-shows cannot establish approval. Cancelled interviews are not outstanding assigned activities; mandatory institutional interview types still require completed approved evidence. FAILED/EXPIRED/pending assessments block, and PASSED assessments with a configured threshold require a qualifying recorded score. SAGA's final hiring readiness additionally requires both existing institutional contract signature flags.

The server transaction rechecks the actor role/tenant, reads policy and prerequisites, conditionally updates the expected current status, and appends history atomically at Serializable isolation. Duplicate completed submissions do not append history. Serialization conflicts return a clear refresh/review error. Applications already linked to employees cannot progress or be rejected/withdrawn through a historical inconsistent application status; they require HR review.

The existing board and profile both render StatusChangeDialog. It now fetches read-only, tenant-scoped restrictions, explains the selected action's blockers, and disables submission until checks load and pass. The server independently repeats validation. Existing component styles and layouts remain.

**Retest:** PASS using real actions/services with in-memory dependencies: legitimate progression, missing documents, incomplete/negative/missing evaluations, missing and failed examinations, missing institutional approvals, teaching/staff distinctions, stage skipping, terminal states, unauthorized role/tenant, duplicates, simulated simultaneous updates, and simulated rejection/conversion contention.

## P3-FIND-02 — history/status mismatch

**Confirmed code-level defect:** The previous stage action could read ASSESSMENT, pause, then unconditionally write OFFER after another request had advanced the application and converted it to HIRED. Its stale status could overwrite the newer state. A synthetic interleaving reproduces an OFFER current status with a recorded OFFER → HIRED event. The new transaction/current-status condition prevents this stale write.

**Additional evidence:** `prisma/seed.ts` includes upserts that assign OFFER to existing applications, including Teresa's fixture, without reconciling historical status events. These scripts were inspected only; none was executed. The conversion code already writes status, hire history, and employee records in one serializable transaction. Timeline rendering displays stored history; the profile loads current status and history through the same application query.

**Remaining uncertainty:** No production audit history or employee records were queried. Neither the seed path nor the concurrency defect is established as the cause of the reported applicant's mismatch. Existing records were not repaired. Determining that cause still requires an authorized read-only audit of the specific record and its write history.

**Retest:** PASS for the modeled old race, current terminal-write prevention, existing-employee mismatch protection, status/history agreement after synthetic concurrent updates, and atomic conversion/idempotency. These are in-memory transaction simulations, not a PostgreSQL concurrency benchmark.

## P3-BUG-02 — incorrect stage number

**Confirmed cause:** ApplicantProfileView supplied `stageNumber={2}` and category-only totals independent of the progress tracker.

**Correction:** The tracker's existing step definitions/state calculation are shared in `lifecycle.ts`. Both components use the same active index and step count. Totals remain 10 for SAGA teaching, 9 for SAGA staff, and 7 for the existing generic tenant lifecycle. OFFER maps to contract even without an offer row; HIRED maps to the final step; rejected/withdrawn keep their terminal label and disable active progression. Generic assessment/review fallback no longer resolves to a missing institutional step. No CSS or layout redesign.

**Retest:** PASS across all application statuses, both categories, and SAGA/generic tenant modes.

## Changed files

| File | Purpose |
| --- | --- |
| `src/features/hiring/onboarding-pipeline.ts` | Shared templates and read-only policy completeness evaluator |
| `src/features/hiring/onboarding-actions.ts` | Reuse templates; validate manual/automatic completion against policy |
| `src/features/hiring/readiness.ts` | Remove completion bypass; enforce checklist, evaluations, examinations, signatures |
| `src/features/hiring/qualification.ts` | Shared assessment pass and positive interview outcome rules |
| `src/features/hiring/stage-prerequisites.ts` | Central policy-to-board prerequisite checks and existing-employee protection |
| `src/features/hiring/status-transition.ts` | Transactional authorization, tenant scope, prerequisite read, conditional update, audit |
| `src/features/hiring/actions.ts` | Invoke transactional service; expose read-only transition restrictions |
| `src/features/hiring/lifecycle.ts` | Shared lifecycle steps and active-stage calculation |
| `src/components/hiring/StatusChangeDialog.tsx` | Display server restrictions in existing board/profile control |
| `src/components/hiring/ApplicantProfileView.tsx` | Derive stage number/total from shared lifecycle |
| `src/components/hiring/HiringProgressTracker.tsx` | Consume shared lifecycle calculation |
| `src/app/(dashboard)/dashboard/hiring/applicants/[applicationId]/page.tsx` | Remove read-time checklist initialization |
| `scripts/test-hiring-functional-fixes.cjs` | Synthetic domain, action, conversion, and transaction regression fixtures |
| `scripts/test-hiring-policy.cjs` | Replace formerly incomplete “ready” fixtures with complete policy fixtures and approved evaluations |
| This report | Root causes, rules, validation, limits, and preservation evidence |

`src/features/employees/conversion.ts` and `src/features/hiring/pipeline.ts` were reinspected and retain their existing persistence/authorization and adjacency rules respectively. Their shared evaluator/action callers provide the fixes.

## Validation

Commands use locally installed binaries because PowerShell blocks `npx.ps1`. The tsx test runner required execution outside the filesystem sandbox because Windows user lookup failed inside it (`uv_os_get_passwd ENOMEM`). All tests below use synthetic in-memory database/mail/storage dependencies; none connects to PostgreSQL.

| Check / exact command | Result |
| --- | --- |
| `node scripts/test-hiring-functional-fixes.cjs` | PASS — 63 regression groups |
| `node scripts/test-hiring-policy.cjs` | PASS — category/tenant policies, legacy retention, document validation, complete readiness |
| `node scripts/test-hiring-candidate-security.cjs` with process-local `NODE_ENV=production`, `PLATFORM_ROOT_DOMAIN=localhost` | PASS — all four security groups, including tenant binding and identity protection |
| `node scripts/test-candidate-document-headers.cjs` with process-local `PLATFORM_ROOT_DOMAIN=localhost` | PASS — all three document handlers, tenant/public host checks, private Blob SDK contract |
| `node scripts/test-final-ux-hiring.cjs` | PASS — actual pipeline page's parallel reads, filters, foreign-ID fallback, tenant scope |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node node_modules/eslint/bin/eslint.js` | FAIL — 96 existing errors and 64 warnings outside changed files |
| ESLint with the 14 changed code/test paths explicitly supplied | PASS — zero errors/warnings |
| `node node_modules/prisma/build/index.js generate` then `node node_modules/next/dist/bin/next build --webpack` | PASS — production compile, type validation, static generation, traces |
| `git diff --check` | PASS |

For every build process, DATABASE_URL was explicitly replaced in process memory with `postgresql://synthetic:synthetic@127.0.0.1:9/workpulse_build_isolated?connect_timeout=1`. No environment file was edited. Prisma generation does not migrate or write database data. Initial document-security execution failed because its `localhost` host fixture omitted the application's default `:3000` port; explicit matching host configuration made the existing test pass without altering any security check. Candidate-security requires production cookie mode to exercise its secure-cookie assertions.

Database-dependent institutional hiring, onboarding sync, sprint suites, H1 employee-core, recovery conversion, and browser/HTTP fixture harnesses were **SKIPPED**: no currently verified isolated database was established for this task. Some target named seed applicants or use historical recovery configuration and would write records. They were inspected before deciding not to run them. No migration, reset, seed, database-writing script, production HTTP action, or live mail operation was executed.

## Preserved records, limits, and policy decisions

All existing recruitment, onboarding, employee, document, waiver, and audit records remain untouched. No task deletion, data repair, automatic policy backfill, or migration is included. Existing verified/waived evidence is accepted where it matches current policy or the documented legacy mapping. Custom tenant policies are resolved through the application's owning organization, never inferred from category or task titles alone.

Unknown/renamed legacy task titles and missing policy items require authorized HR review using the existing task workflow. The schema has no stable policy-template key/version on historical tasks; this patch intentionally does not infer equivalence from fuzzy titles or silently migrate them. Retired tasks still marked required remain subject to explicit HR treatment. Additional tenant-specific interview-stage customization has no configuration in the current schema; this patch preserves assigned-activity rules and the existing SAGA institutional requirements rather than adding a new policy system.

Real PostgreSQL concurrent commits and full browser interaction remain to be retested once a disposable database is verified. The specific historical mismatch and the reason Teresa had only one task remain unconfirmed. Whether ambiguous legacy tasks should satisfy renamed requirements is an HR policy decision; they remain blocked pending explicit review. No unrelated job-archive, public-careers URL, or cosmetic work was included.

Final scope: 9 modified existing code/test files, 5 new code/test files, and this new report. The pre-existing `package-lock.json` change remains separate. No commit, push, merge, PR, or deployment was performed.
