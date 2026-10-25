# Final production release preparation

Reviewed locally on 2026-10-25; no database connection, rehearsal, push, merge,
deployment or Vercel configuration change was performed for this preparation.

The two rehearsal index differences are harmless names, not compatibility blockers:

| Table | Ordered index columns | Definition |
| --- | --- | --- |
| EmployeeCompensation | organizationId, employeeId, effectiveFrom | Non-unique B-tree; no expression, predicate or INCLUDE columns |
| OrganizationPayrollPolicy | organizationId, status, effectiveFrom, effectiveTo | Non-unique B-tree; no expression, predicate or INCLUDE columns |

Saved before/after index definitions are identical. Both match the corresponding
Prisma `@@index` columns and ordinary ascending/default B-tree semantics. Neither
index backs a PRIMARY KEY or UNIQUE constraint; the separate primary/unique
indexes and all constraints on both tables are unchanged and validated. The saved
Prisma diff proposes only renaming these two indexes. PostgreSQL truncated the
historical SQL names to 63 bytes; Prisma's generated names use different truncation.
No application code depends on these names. No rename or old-migration edit is
needed. Retain this explicit naming exception when assessing schema diff output.

StaffSession review: token hashes, tenant/user ownership, JWT/session expiry,
tenant-scoped revocation, persistent login budgets, credential recheck under User
row lock, and all four lifecycle revocation triggers are consistent with the
additive migration. Existing staff cookies require a fresh sign-in after rollout.
No source correction was necessary. Focused lint, TypeScript, and the eight
in-memory HR login/session assertions pass; the latter opened zero database
connections. Existing PostgreSQL security evidence was reviewed without rerunning
its database tests. The release source includes all 37 ordered migration SQL files.

Remaining production blockers/prerequisites:

1. Establish the active production deployment's actual Neon branch/endpoint and
   its runtime/direct connection mapping. The previously inspected candidate is
   not proven to serve the live website. On that verified target, check migration
   history/checksums, no unresolved failures, and the same 13 pending migrations.
2. Confirm an accessible current recovery point for that live branch, timestamp,
   retention and restore capability. The rehearsal branch's saved production
   snapshot provenance and restore procedure remain independently unverified.
3. Obtain explicit production-migration and later merge authorization, a controlled
   write window, and control over automatic production promotion. Retain signing
   and encryption keys. Capture protected-record fingerprints before migration;
   compare identical original columns afterward. Stop promotion on any failure.

Future commands only, after these prerequisites, in a clean release checkout of
the reviewed `employee-ui-design` commit, with dependencies already installed.
The operator must provision `DATABASE_URL` securely in that process with the
verified production **direct** connection; do not use the rehearsal/recovery
profile or load the ordinary local `.env` as the release target. Never print it.
Ensure `main` is up to date and its merge result will contain the same reviewed
migration bundle; resolve any divergence before the migration window.

```powershell
git switch employee-ui-design
git rev-parse HEAD
node node_modules/prisma/build/index.js migrate status --schema prisma/schema.prisma
# Only after target, ledger, recovery, write-window and authorization checks:
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { throw 'Migration failed; stop release' }
node node_modules/prisma/build/index.js migrate status --schema prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { throw 'Migration ledger verification failed' }
# Confirm all 37 applied checksums, schema/constraints/triggers and original data.
# Only after those checks pass and separate merge authorization is given:
git switch main
git merge --no-ff employee-ui-design
```

`migrate status` before deployment should report the expected pending bundle;
it does not replace identity/checksum/data validation. Do not automatically chain
these commands. Merge locally only after successful production schema/data
verification. Push and deployment remain separate later actions. No reset, seed,
history repair, automatic index rename or down-migration is part of this sequence.
