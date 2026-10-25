# Isolated migration rehearsal

Executed on 2026-10-25. Migration deployment and historical-record preservation
passed. The strict Prisma schema comparison remains flagged for two pre-existing
index-name differences. This is not production release approval.

The connection came only from `REHEARSAL_DATABASE_URL` in the private project-root
`workpulse-rehearsal.env`. Read-only SQL verified Neon branch
`br-nameless-sea-azximn2k`, endpoint `ep-wispy-field-azwr6g4o`, database/schema
`neondb/public` before any writes. The normalized endpoint was checked against
the protected local production-candidate and recovery profile endpoints.
No production, development, checkpoint or Vercel connection was opened.

The baseline had 24 applied migrations and one rolled-back historical entry,
with no unresolved failures. Names and checksums matched the reviewed bundle;
exactly 13 migrations were pending. Deployment completed successfully in about
10 seconds. All 37 local migration files now have matching applied ledger entries.

Before deployment, all 51 existing tables were fingerprinted server-side in a
repeatable-read, read-only transaction. After deployment, fingerprints used the
same original columns. All row counts and fingerprints match. Employee records
and other private row contents were not exported.

Post-deployment checks verified 14 enabled reviewed custom triggers, 62 validated
named constraints, exact reviewed trigger-function bodies, and valid/ready
indexes. These include StaffSession ownership, expiry and token checks plus its
four revocation triggers. The Prisma model comparison reports only:

| Table | Existing index | Prisma expected index |
| --- | --- | --- |
| EmployeeCompensation | EmployeeCompensation_organizationId_employeeId_effectiveFrom_id | EmployeeCompensation_organizationId_employeeId_effectiveFro_idx |
| OrganizationPayrollPolicy | OrganizationPayrollPolicy_organizationId_status_effectiveFrom_e | OrganizationPayrollPolicy_organizationId_status_effectiveFr_idx |

Both existing index definitions are identical in the before/after metadata.
No index renaming or other corrective schema change was performed. The verification
command intentionally exits unsuccessfully while the strict schema gate differs;
this does not indicate migration deployment failure.

Production, development and recovery configuration hashes remained unchanged.
The rehearsal profile itself was unchanged. An exact Git ignore entry was added
because the existing `.env*` rule did not cover `workpulse-rehearsal.env`.
No reset, seed, migration-history repair, broad test suite, authentication suite,
merge, push or deployment was run.

The supplied branch identity is verified; its saved production snapshot origin,
timestamp and restore provenance were not independently established. Current live
production mapping and backup/rollback readiness remain unverified.

Evidence: `preflight.json`, `before.json`, `deploy.json`, `after.json`,
`schema-diff.json`, and `result.json`. `failure.json` records the expected strict
schema-gate failure. Metadata and aggregate fingerprints contain no connection
credentials or exported employee rows. The script supports read-only `verify`
against the retained baseline; do not rerun `deploy` on this already migrated copy.
