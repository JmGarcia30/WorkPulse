# Payroll V2 migration review and rehearsal

Result: **PASS on an isolated, fingerprint-verified copy of production**, with the coverage limits below. Production migration/deployment remains unauthorized.

## Copy provenance and safety

- Source: WorkPulse production, project `late-block-61364102`, branch `br-hidden-violet-azjl3vam`, endpoint `ep-weathered-mouse-azpx765h`, database `neondb`.
- Source access enforced `default_transaction_read_only=on`. A repeatable-read transaction exported a snapshot shared by the table fingerprints and PostgreSQL 18.1 `pg_dump`. No production SQL data or schema mutation was issued.
- Snapshot recorded at `2026-11-04T15:58:41.422Z`. It contained **75 application tables and 819 rows**, excluding Prisma history from the application-row count. Migration history contained 40 successful migrations plus one rolled-back historical record, with no unresolved migration.
- New copy: project `purple-tree-62095489`, branch `br-lingering-dawn-azrdk13o`, endpoint `ep-blue-tooth-azyimqbj`, database `workpulse_preview`. It was empty before restore. It is isolated from the test project's default branch and from the earlier V2 synthetic branch. No app environment was switched to serve this production copy.
- The main project's branch quota prevented a direct child branch. Instead, the authorized production snapshot was exported read-only and restored into this new separate-project branch. Do not infer synthetic-only contents from the test project's historical display name: **this rehearsal branch contains a production copy**. Source rows are not included in the review package. The dump is retained only under ignored `storage/payroll-v2-review/production.dump`; credentials remain in ignored local profiles.
- Restore used no ownership/ACL transfer and one transaction with stop-on-error. The isolated role owns the copied objects; production grants/role deployment were not rehearsed.

Evidence: [source snapshot metadata/hashes](production-copy-source.json), [restored-copy verification](production-copy-verified.json), [extension dependency](production-copy-extensions.json), [final preservation check](final-preservation.json). These artifacts contain structure, counts and fingerprints, not employee records or salary values.

## Restore findings

The first restore rolled back atomically because a schema-filtered dump did not install the `btree_gist` extension needed by an existing schedule exclusion constraint. The source's `btree_gist` 1.8 prerequisite was then installed **on the empty isolated target only**, and the verified dump was restored again.

PostgreSQL regrouped parentheses in `WorkScheduleBreak_range_check`. Original and restored definitions differ only by associative AND grouping. The verifier permits only this named difference, requires the remaining expression text to match, and evaluates all 49 combinations of boundary/null inputs. All results matched. All other original constraints, functions, triggers, indexes and enums compared unchanged. The stored evidence distinguishes raw text identity from semantic compatibility rather than silently ignoring a difference.

## Migration corrections

The uncommitted, unreleased `20261104000100_payroll_simplification_v2` migration was strengthened before production use:

- Explicit BEGIN/COMMIT: a late failure cannot leave a partial set of tables/functions/triggers.
- Six tenant-scoped foreign keys: notification entry, actor and recipient; revision employee, period and actor. Original referenced records are not rewritten.
- Notification insertion additionally validates the period's organization and active employee, matching service-level eligibility.
- Blank notification/audit reasons and non-object before/after audit JSON are rejected.
- Both new tables reject UPDATE, DELETE and TRUNCATE, preserving notification and audit history.

The earlier `br-green-king-azcpyvmo` synthetic branch applied the initial draft of this unshipped migration. Its old checksum is **not** the evidence for the revised migration; do not use that branch as a release-migration baseline. The new production copy applied and verified the current checksum. No production-applied historical migration was edited.

The read-only Prisma schema comparison then found three new V2 indexes whose hand-written names had been truncated differently by PostgreSQL than Prisma expects. A second migration, `20261105000100_payroll_v2_index_names`, renames **only those three new indexes**, in one transaction. It changes no rows, historical indexes, contribution rules or policies. Both final migration checksums match exactly one successful record in the isolated copy.

## Focused rehearsal results

[Main migration results](migration-rehearsal.json), [first deployment](migrate-deploy-1.log), [second deployment](migrate-deploy-2.log), [index correction results](index-rehearsal.json), [index deploy](index-deploy-1.log), [index retry](index-deploy-2.log).

1. Injected an error immediately before COMMIT. The base migration failed as intended; both new tables disappeared and original constraints remained unchanged.
2. Applied with Prisma `migrate deploy`; repeated deployment reported no pending migration. The current checksum appeared exactly once.
3. Raw SQL replay deliberately failed on an existing object and rolled back. The SQL is intentionally **not** an `IF NOT EXISTS` repair script; Prisma's migration ledger provides repeat-deployment idempotency without masking incompatible objects.
4. Rehearsed the guarded pre-use reverse DDL in a transaction. Both new tables/functions were absent within that transaction; ROLLBACK restored the migrated copy. [Rollback probe log](rollback-probe.log).
5. Injected a failure after the index renames; all renames rolled back. Successful apply and second no-op deployment then passed.
6. Verified six validated foreign keys and six enabled insertion/history/truncate triggers. Focused tests exercised unauthorized recipients, inactive employees, actor deletion, malformed audit JSON, blank reasons, immutable writes and TRUNCATE denial. [Security results](security-tests.json), [raw test log](security-tests.log).
7. After rollback-only synthetic payroll/security fixtures completed, **all 75 original-table counts and full-row fingerprints, original migration history, original constraints, original trigger functions/triggers and historical indexes still matched**. No actual copied employee was selected for payroll generation. [Final verification](final-preservation.json).

A test-harness string replacement initially collapsed PostgreSQL dollar quotes in the rollback probe. The probe generator was corrected; the final rollback SQL and final rehearsal passed. This was not treated as a successful check until it was rerun.

## Remaining inherited drift

[The final Prisma diff](schema-diff.sql) contains only two pre-existing historical index-name differences on `EmployeeCompensation` and `OrganizationPayrollPolicy`. The source-copy comparison proves those index names were inherited. They were **not applied or renamed** during this work. There is no remaining V2-table drift. Do not execute the schema-diff artifact as a migration; it is diagnostic evidence.

## Rollback readiness

The normal release rollback is to restore the previous application version **while retaining the additive tables and their migration history**. After any V2 use, deleting tables would discard audit/notification records and is refused.

[Pre-use reverse DDL](rollback-pre-use.sql) acquires exclusive locks and refuses removal if either new table contains a row. It was rehearsed and rolled back on the isolated copy. A separate test confirmed refusal with recorded notification/audit history. No CASCADE or automatic history deletion is used.

The SQL is a review artifact, not authorization to run it against production. If physical removal is approved before use, package it in a **new forward rollback migration** so Prisma records both transitions. Do not edit an already successful production migration's checksum or pretend it failed. A subsequent re-release would require a new forward migration to recreate the objects.

## Historical-data coverage limits

The actual production snapshot has seven payroll periods, one compensation record and one statutory input, but **zero PayrollEntry rows and zero finalized payslips**. Its existing records and policies were preserved; this rehearsal cannot demonstrate preservation of real finalized payslips that do not exist in that snapshot. Controlled finalized/legacy fixtures and snapshot immutability/access tests supply that separate evidence. Production role grants, external email, live deployment and production payroll generation were not tested or changed.
