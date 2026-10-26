# Stage document requests — reviewed execution and rollback plan

**Prepared only. No migration is authorized or applied by this document.**

## Exact scope

- Project: `late-block-61364102`.
- Only permitted target after explicit approval: `workpulse-ess-design`, branch `br-damp-fog-azmmxhga`, endpoint `ep-wild-mud-az8yzifu`, `neondb/public`.
- Excluded: default `production` branch `br-hidden-violet-azjl3vam` and its endpoint `ep-weathered-mouse-azpx765h`.
- Migration: `prisma/migrations/20261026000000_stage_document_requests/migration.sql`.
- Reviewed SHA-256: `98cfa9b3c729926e970aa8a4f721c271f255adae33fdd050499500e0ce169961`.

Unchanged SQL:

```sql
ALTER TABLE "RecruitmentDocument" ADD COLUMN "requestedAt" TIMESTAMP(3);
```

## Verified preconditions

Live Neon control-plane metadata confirms the test branch is ready, non-default, non-primary, and separate from production. SQL confirms the project, branch, endpoint, database/schema and a read-only metadata connection. PostgreSQL version is 18.6. The recovery helper independently rejects any URL that resolves to the protected `.env` endpoint.

Current catalog/history inspection found:

- 37 finished, non-rolled-back migrations; no unfinished migrations.
- All applied migration checksums match repository files (including permitted line-ending equivalents).
- Exactly one pending local migration: the reviewed migration above.
- All generated Prisma models/enums checked; the sole missing column is `RecruitmentDocument.requestedAt`.
- The Prisma requestedAt read fails with P2022, confirming the actual runtime incompatibility.
- 171 existing recruitment-document records. Their original-column aggregate fingerprint is `938faea6afe3cb021b715611ca6eafd7`; the exact selected columns are stored in `database-preflight.json`.
- No table locks were present at capture time. This must be checked again immediately before execution.

These findings are snapshots, not permission to execute later without repeating identity and history checks.

## Dependencies, effects, and safety

The statement requires the existing public RecruitmentDocument table and PostgreSQL's built-in timestamp type. It adds no index, constraint, extension, foreign key, trigger, default, or data transformation. No additional migration dependency is currently pending.

Existing rows will read NULL in the new nullable column. Existing document IDs, status, verification metadata, storage keys, notes, and all other old fields remain unchanged. There is no reconstruction of historical request dates. PostgreSQL documents that this addition does not require a table rewrite, while ALTER TABLE ordinarily needs an ACCESS EXCLUSIVE lock; lock contention must therefore be bounded even for a small change. [PostgreSQL 18 ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html).

Application behavior matters: the already-present stage-document request code treats a PENDING document with a null requestedAt as not yet requested by HR. After migration, such items may require an explicit HR request before candidate upload. Existing submitted/verified files and states are not reset. No blanket historical backfill is planned.

## Execution plan — only after explicit authorization

1. Obtain approval explicitly naming this migration and this non-production branch. The approval must not be interpreted as permission to migrate production or apply other pending migrations.
2. Pause local test/server activity against the branch. Confirm a suitable retained recovery reference or reviewed logical/schema snapshot is available. Do not reset this branch or create/restore a checkpoint as an inferred part of approval.
3. Rerun the read-only verifier, with output directed to a new evidence directory:

   ```powershell
   $env:WP_VERIFICATION_DIRECTORY = 'docs/hiring-blocker-resolution-2026-10-27/pre-migration'
   node scripts/verify-hiring-postfix.cjs database
   ```

4. Reconfirm live control-plane/default-branch identity. Require the exact branch/endpoint above, distinct from the protected original. Require the checksum above, exactly this one pending migration, zero checksum mismatches, zero unfinished migrations, and the expected missing column. Abort if any condition changes. Re-capture row count/original-column fingerprint immediately before application.
5. Use only the direct recovery URL from `scripts/batch0-recovery-environment.cjs` in process memory. Do not print it or write any environment file. Set connection options `lock_timeout=5000` and `statement_timeout=30000` for the migration connection. Fail promptly on contention; investigate before retrying.
6. Invoke the existing Prisma migration engine with arguments `migrate deploy --schema prisma/schema.prisma` and the explicitly overridden, verified direct DATABASE_URL. Never invoke it with the repository's default environment. `migrate deploy` is acceptable only because step 4 proves its entire pending scope is this single reviewed migration. Do not use db push, migrate dev, reset, seed, or manual migration-history edits.
7. Record exit status and rerun read-only verification. Require the new column to be nullable `timestamp without time zone` at millisecond precision, with no default; require the migration to be finished with the reviewed checksum and no unfinished migration. There should then be 38 finished migrations and no missing Prisma columns/enums.
8. Compare the **original-column** fingerprint/count with the immediate pre-migration values; including requestedAt in that comparison would create a false difference. With branch activity paused, require all new requestedAt values initially NULL. Recheck unchanged old constraints/indexes and environment hashes.
9. Only after those checks pass, run the focused PostgreSQL onboarding, transition, conversion, duplicate/concurrency, audit-integrity and browser suites using synthetic records. Do not rerun old suites that target named seed applicants. Use rollback fixtures where possible; any real concurrent-commit fixtures need marker-scoped ownership, cleanup, and before/after preservation checks.

No write-capable executor was run or added. The read-only verifier records `automaticApplyAllowed: false`.

## Rollback / failure plan

- **Before execution:** abort without changes if identity, checksum, pending scope, or preservation checks fail.
- **Statement/lock timeout:** the single ALTER TABLE statement must not be assumed successful. Inspect the column and Prisma migration row read-only. A failed history entry requires explicit review/reconciliation before any retry; never hide it with a reset or unconditional migration-history edit.
- **After a successful migration but failed application tests:** stop the local application/tests and retain the nullable column plus the truthful successful migration record. This additive schema can remain while code is corrected or a compatible earlier application is selected. Keeping the column preserves any later request timestamps.
- **If physical removal is required:** first retain/export any new request metadata and review dependent application code. Prepare a separately authorized corrective migration. Dropping the column would discard request history, so it is not an automatic rollback. Do not edit the applied migration, delete successful `_prisma_migrations` entries, reset the branch, or restore production.

The historical OFFER/HIRED mismatch and earlier onboarding-completion timestamps are outside this migration's scope. This migration neither repairs them nor initializes missing onboarding tasks.
