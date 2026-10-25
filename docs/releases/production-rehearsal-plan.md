# Controlled production migration and merge plan

Status: **isolated rehearsal executed; migration/data checks pass; strict schema gate flags two pre-existing index-name differences; production NO-GO**.

Update at 2026-10-25T15:09:17Z: the user supplied a private rehearsal profile.
Read-only SQL verified branch `br-nameless-sea-azximn2k`, endpoint
`ep-wispy-field-azwr6g4o`, before writes. All 13 reviewed migrations applied
successfully and all 51 existing tables retained identical original-column
fingerprints and row counts. The final ledger matches all 37 local migrations;
14 reviewed custom triggers, 62 named constraints, function bodies and index
validity passed verification. Prisma reports only two index-name differences
that were present before deployment. No corrective DDL was run. See
[the rehearsal report](isolated-rehearsal/report.md) and
[machine-readable result](isolated-rehearsal/result.json).

Production, development, recovery configuration and Vercel were untouched.
The remaining preparation text below records the earlier access limitations;
the missing rehearsal connection limitation is now superseded. Saved-snapshot
origin/time and restoration provenance remain independently unverified.

### Earlier preparation record

No application code, authentication implementation, running localhost process,
environment/recovery configuration or database was changed by this preparation.
No authentication suite, unrelated tests, merge, push or deployment was run.

## Prepared bundle and preserved implementation

The working tree contains **37 migration files**. Against the previously recorded
24-migration **candidate** ledger, the prospective pending bundle is these 13:

1. `20261022000200_organization_probation_policy`
2. `20261022000300_payroll_statutory_integration`
3. `20261023000100_platform_administration`
4. `20261023000200_organization_onboarding`
5. `20261023000300_public_company_registration`
6. `20261023000400_organization_gmail_integration`
7. `20261024000100_saga_recruitment_sender`
8. `20261024000200_hr_email_delivery`
9. `20261024000300_organization_resignation_policy`
10. `20261024000400_employee_final_pay`
11. `20261024000500_ess_resignation_notice`
12. `20261025000100_rfid_attendance_phase1`
13. `20261025000200_staff_session_security`

All 13 SQL checksums match their retained reviewed development evidence. No old
migration was edited. `production-rehearsal-manifest.json` records exact files,
checksums and fingerprints of the completed staff-security source, which remains
unchanged. Include those currently uncommitted implementation files and the new
StaffSession migration in the final reviewed release commit; do not merge only
the earlier 36-migration commit.

Review outcome: the bundle adds tables, columns, indexes, enum value, constraints
and triggers. It does not drop historical business tables/columns or explicitly
rewrite historical employee, attendance or payroll data. StaffSession functions
delete only session records when future credential/access changes require it.
Existing separation cases receive the new HR provenance default. Risks requiring
rehearsal are validated constraints/indexes and DDL locks, enum/trigger rollback,
and the code's dependency on the new schema. New payroll tables do not establish
reviewed statutory/opening inputs or approved financial policies automatically.

## Why the requested rehearsal has not run

No saved production snapshot/export file, snapshot ID, dedicated snapshot
connection, isolated rehearsal connection, or Neon provider authorization is
available in the workspace. The only configured checkpoint is
`br-shy-glitter-az5vqooe`, explicitly documented as a development checkpoint whose
parent is `br-damp-fog-azmmxhga`; it is not verified as the requested production
snapshot and must not be substituted or migrated in place.

The requested input is the saved snapshot's Neon project ID, snapshot/source
branch ID and UTC timestamp, plus access to a new isolated copy (or authorized
Neon provider access to create it). Supply identifiers only in conversation;
credentials belong in a separate private untracked profile, not chat or evidence.
No production/candidate/development connection was opened for this task.

**Schema compatibility and record preservation on the production snapshot are
NOT TESTED.** Existing 37-migration development success and preserved development
records are supporting evidence only, not a substitute for this rehearsal.

## Exact rehearsal procedure once access is supplied

1. Verify provider metadata: snapshot ID/time, source project/branch and ownership.
   Create a fresh isolated copy without resetting any existing database or
   changing the saved snapshot. Confirm the new branch/endpoint is not bound to
   the production website; an existing similarly named branch is insufficient.
2. Verify both runtime and direct migration connections select that exact copy,
   distinct from live production, the local candidate, working development and
   the saved snapshot source. Initially inspect it read-only. Record non-secret
   identity, schema, migration names/checksums and unresolved failed entries.
   Require its ledger to match the approved baseline; stop and revise the exact
   bundle if it differs from the candidate's 24-migration assumption.
3. Capture counts and fingerprints for every pre-existing table, projecting the
   exact pre-existing columns. Hash aggregates server-side; never export private
   employee data or credentials into evidence. Keep schema/constraint/trigger
   metadata and the migration checksum manifest.
4. Recheck the identity and sole approved pending set immediately before running
   the existing guarded `prisma migrate deploy` workflow **on the isolated copy
   only**. Do not reset, seed, alter old SQL, resolve history manually or migrate
   the snapshot source. Record duration and failures; stop rather than loop.
5. Verify all 37 migration names/checksums and no failures/pending entries.
   Compare the database against the current Prisma model: tables, scalar columns,
   types/nullability, enums, unique/FK/CHECK constraints, indexes and enabled
   custom triggers. Include StaffSession's ownership/expiry/hash constraints and
   four revocation triggers. Schema syntax validation alone is insufficient.
6. Compare all original-column fingerprints and row counts with step 3. New
   nullable/default columns and new security tables must not cause false failures
   by hashing an expanded whole row. Existing employee, attendance, RFID (if
   present), payroll and document ownership records must remain intact. Reuse
   completed functional/security evidence; do not rerun broad or auth suites.
7. Retain the snapshot-to-copy identity and before/after evidence. A successful
   snapshot restoration into this isolated copy, with source-data validation,
   provides restore-test evidence; merely seeing a backup entry does not.

## Exact remaining action to confirm the live Vercel target

An authorized owner must identify the active Production deployment serving
`work-pulse-omega.vercel.app`, then verify that deployment's effective DATABASE_URL
binding against its existing Neon integration/resource metadata or a trusted
secret-owner provisioning record/already available runtime identity record.
Record only Vercel project/deployment ID and Neon project/branch/endpoint/database
identifiers. Current environment-variable metadata alone does not prove the
snapshot of variables attached to an older active deployment.

The candidate branch `br-hidden-violet-azjl3vam` and endpoint
`ep-weathered-mouse-azpx765h` are **not confirmed as live Production**. If no binding
or existing runtime evidence proves the mapping, keep it unverified; do not read
back a protected secret, overwrite it, or deploy a diagnostic without separate
authorization. Once confirmed, read that exact target's migration ledger and
compare it with the rehearsed baseline. A different pending set blocks release.

## Required backup/rollback checks and execution order

1. Complete the isolated rehearsal and target mapping above. Freeze the exact
   release commit including staff security; hold automatic production promotion
   before any merge/push that could deploy code prematurely.
2. Verify an accessible, current pre-release production recovery point for the
   **confirmed live branch**, its UTC time, retention/expiry through the rollback
   window, necessary provider permissions and demonstrated restore procedure.
   The older saved snapshot may support rehearsal but is not automatically an
   adequate fresh production rollback point. Confirm private Blob/document backup
   dependencies if database restoration would reference separately stored files.
3. Approve a maintenance/write-control window and the exact pending schema plan.
   Capture fresh protected-record fingerprints. Only then, under separate
   production authorization, apply the rehearsed pending migrations and verify
   schema/checksums/constraints and historical records before serving the new code.
4. After schema and required operational setup are ready, approve the reviewed
   merge into main and matching deployment. Expect existing staff cookies to
   require fresh sign-in; preserve existing signing/encryption keys. Perform only
   targeted deployment smoke checks, not another authentication audit.
5. On failure stop writes/promotion. Additive enum/trigger changes are not a
   blanket down-migration. Code rollback is allowed only if old-code compatibility
   was verified; data rollback uses the verified restore procedure with explicit
   approval and reconciliation of any writes since the recovery point. Do not use
   `migrate reset`, destructive cleanup or an unreviewed `migrate resolve` to force
   success.

Current release decision: **not ready to execute**. The isolated branch rehearsal
has now run. Remaining blockers are independently verified snapshot provenance,
the two pre-existing index-name differences, unconfirmed live target, and
unverified current production backup/rollback readiness. The
completed staff-security implementation and working localhost are preserved.
