# WorkPulse remaining functional blockers — October 27, 2026

**Updated release readiness: BLOCKED.** The two reproduced legacy failures are corrected locally. Real PostgreSQL/concurrency/browser verification still requires explicit authorization for the reviewed isolated-branch migration and subsequent compatible-schema verification. The specific historical OFFER → HIRED/current OFFER discrepancy remains unconfirmed. No production records were queried or changed.

This report supersedes the earlier post-fix FAIL assessment for the two legacy failures. Work continues from local main `9717589` and preserves all earlier fixes and the HR/ESS redesign.

## Root causes and actual changes

### Legacy onboarding metadata

The automatic task-review path used policy completeness to decide whether to reopen an already-COMPLETED process. That treated missing policy items as permission to replace historical status and clear completedAt during an unrelated task verification.

Task verification now leaves COMPLETED process metadata intact. Missing policy items still fail the independent readiness/conversion evaluator. Task ownership/state/policy reads and updates now share a Serializable transaction; serialization conflicts return a refresh/review error.

Legitimate reopening uses the existing explicit **Reopen Item** action for a VERIFIED or WAIVED task. It requires an authorized HR/admin session, tenant ownership, and a fresh reason of 5–2000 characters. No automatic reopening occurs during verification. The reopening appends an audit event atomically with the task/process update, recording actor, tenant, time, reason, task ID, prior process state/completion timestamp, and prior verification/waiver evidence. Attachments and unrelated verified/waived tasks are retained. The original completedAt remains intact even during explicit reopening and later recompletion. Repeated verification/completion/reopen submissions are idempotent where the requested state already applies.

Audit events append to the existing process notes field with an `[onboarding-audit]` JSON marker, preserving prior notes. Completion after reopening records a new event rather than replacing the original completedAt. No new audit schema or migration is required. This provides application-level traceability; it is not a separately immutable audit table.

### Legacy HIRED recovery presentation

HIRED presentation previously returned an empty checklist and the recovery UI enabled Complete Employee Record without evaluating current prerequisites. The conversion service correctly rechecked them, causing a UI/server mismatch.

The HIRED readiness result now evaluates the same prerequisite function used by conversion and exposes `canCompleteEmployeeRecord`, actual checklist results, and unmet reasons while retaining the historical HIRED status. The card disables recovery and its confirmation when ineligible, displays the blocking reasons, and no longer claims all evidence was cleared. A fully eligible legacy candidate can complete the employee record; an existing employee link still leads to View Employee Record. Server-side authorization, current-data validation, probation rules, and atomic conversion remain authoritative and unchanged.

The existing modal, card layout, styles and stage displays are retained. Reopen Item now labels its existing notes field as a required reason and supports reversing a waiver through the existing task-state rules. Three pre-existing unused import/state warnings were removed from that edited modal.

## Files modified in this follow-up

| File | Purpose |
| --- | --- |
| `src/features/hiring/onboarding-actions.ts` | Preserve completed-process metadata; transactional explicit audited reopening; timestamp-preserving/idempotent completion |
| `src/features/hiring/onboarding-audit.ts` (new) | Append traceable process/task events without replacing historical notes |
| `src/features/hiring/readiness.ts` | Evaluate current prerequisites for legacy HIRED recovery |
| `src/components/hiring/HiringReadinessCard.tsx` | Block ineligible recovery and confirmation; show reasons using existing design |
| `src/components/hiring/OnboardingTaskReviewModal.tsx` | Require a fresh reopening reason; preserve existing modal workflow |
| `scripts/verify-hiring-postfix.cjs` | Turn the two old reproducers into assertions; add authorization, waiver, idempotency, conflict and migration-review evidence |
| This directory | Updated report, migration execution/rollback plan, and current test evidence |

No migration SQL, Prisma schema, package dependency, environment file, or production credential was changed. The pre-existing package-lock change remains untouched. Earlier recruitment transition logic, shared lifecycle numbering, tenant policies, employee conversion persistence and security checks were preserved.

## Migration investigation

Live control-plane metadata and read-only SQL reconfirmed test branch `workpulse-ess-design` / `br-damp-fog-azmmxhga`, endpoint `ep-wild-mud-az8yzifu`, project `late-block-61364102`, `neondb/public`, distinct from the default production branch. Metadata queries ran with read-only connections.

There are 37 finished migrations with matching checksums, no unfinished migrations, and exactly one pending migration: `20261026000000_stage_document_requests`. All 73 generated models and enum values were inspected. The sole missing column remains `RecruitmentDocument.requestedAt`; a Prisma read still returns P2022.

The unchanged migration adds a nullable timestamp with no default/backfill. Its SHA-256, dependencies, lock considerations, preservation fingerprint, safe execution conditions, and non-destructive rollback strategy are in [MIGRATION-PLAN.md](MIGRATION-PLAN.md). The test table currently has 171 records; their original fields were fingerprinted read-only. No records were updated.

**Remaining prerequisite:** explicit authorization to apply only the reviewed migration to the named isolated branch. Before applying, repeat identity/checksum/pending-scope checks and capture a fresh preservation baseline. No authorization is assumed from this report. Do not substitute production or bypass the missing field with an altered test schema.

## Retest results

| Check | Result |
| --- | --- |
| Original functional fixes suite | PASS — 63 synthetic groups covering completeness, recruitment prerequisites, tenant/role boundaries, conversion, simulated duplicate/concurrent updates, history integrity and stage numbering |
| Original hiring-policy suite | PASS — SAGA teaching/staff and custom tenants remain distinct |
| Candidate-security suite | PASS — all existing security groups |
| Document-security/private-storage suite | PASS |
| Pipeline page/filter/tenant suite | PASS |
| New legacy metadata/boundary tests | PASS — 12 groups; incomplete COMPLETED verification, authorized reasoned reopening, waiver evidence, re-verification, recompletion, duplicates, tenant/role denial and simulated P2034 |
| Rendered-component regressions | PASS — 22 cases across SAGA/generic, teaching/staff, missing tasks/documents, eligible legacy recovery, and required fresh reopening reasons |
| Changed-file ESLint | PASS — zero errors/warnings |
| Full-repository ESLint | FAIL — 96 pre-existing errors, 61 warnings; unrelated errors unchanged; 3 warnings removed from the edited modal |
| TypeScript | PASS |
| Production build | PASS — dummy local database URL supplied in process memory |
| Isolated database identity / migration review | PASS — read-only evidence only |
| Real PostgreSQL onboarding, recruitment, conversion and concurrency tests | BLOCKED — missing requestedAt and migration authorization |
| Live browser workflow | BLOCKED — same schema dependency; rendered tests are not browser verification |
| Specific historical status mismatch root cause | BLOCKED / unresolved — no automatic repair |

Commands: `node scripts/verify-hiring-postfix.cjs boundaries`, `components`, `regressions`, `database`, and `lint`, with process-local `WP_VERIFICATION_DIRECTORY=docs/hiring-blocker-resolution-2026-10-27`; `node node_modules/typescript/bin/tsc --noEmit`; `node node_modules/next/dist/bin/next build --webpack`. Synthetic security children use their established production-cookie/localhost settings and mock all database/mail/storage operations. The PostgreSQL verifier is strictly read-only and never migrates.

## Historical data risks and remaining work

- No historical timestamp or request date is reconstructed. If previous application versions already erased completion metadata, this change cannot infer it; authorized audit/recovery is required.
- Explicit task reopening now retains former verification/waiver evidence in process notes. The task's current status may change by the user's explicit request, while the audit retains its previous state. Unknown legacy policy-title equivalences still require HR review.
- `completedAt` retains the original completion timestamp. Later reopening/completion events carry their own timestamps in the audit notes, rather than overwriting history.
- After the requestedAt migration, existing PENDING documents with a null request date may need explicit HR requests under the already-present stage-document workflow. No silent request backfill is planned.
- Actual concurrent PostgreSQL commits and browser interactions are not yet proven. Once the schema is compatible and authorized, retest simultaneous stage updates, conversion/rejection contention, duplicate conversion, concurrent task reopening/verification, audit consistency and synthetic-fixture cleanup.
- P3-FIND-02 remains uncertain for the originally reported record. Seed status resets and the previous stale transition path are established code paths, but neither proves that applicant's cause. No history, employee or status record was repaired.

No push, deploy, merge, PR, reset, seed, migration application, or production change was performed.
