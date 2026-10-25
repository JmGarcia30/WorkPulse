# Development recovery migration review — 2026-10-25

Status: **eleven reviewed migrations applied to development**. The checkpoint
was verified before migration, and all original records were preserved.
The migration review and earlier blocking conditions below are retained as
historical context. Current evidence is in `development-checkpoint-verification.json`,
`development-migration-completion.json`, `development-protected-data-after.json`,
and `schema-and-history-verification.json`.

The user authorized verified safe migrations only on `workpulse-ess-design` and
required stopping if isolation cannot be verified. The supported read-only
connection inspection reports branch `br-damp-fog-azmmxhga` and endpoint
`ep-wild-mud-az8yzifu` for both pooled and direct connections, with identical
24-migration histories and `neondb/public`. Both connections enforce read-only
transactions. The endpoint differs from the protected original `.env` endpoint;
the original file was unchanged during these checks.

The branch name comes from the user and local profile. Live SQL confirms branch
and endpoint IDs, but does not establish the Console name, parent, default or
production status, creation time, deployment usage, or checkpoint mapping.
There is no connected Neon management tool, installed Neon CLI, or configured
Neon API credential exposed to this session. No checkpoint ID or checkpoint
connection is configured. Isolation and recreation gates therefore remain open.
Do not infer production status solely from a different endpoint.

## All pending migrations reviewed

All eleven SQL files were read in full. No standalone DELETE, UPDATE, INSERT,
TRUNCATE, DROP, destructive type conversion, or historical-row rewrite was
found. References to DELETE/TRUNCATE in trigger definitions prohibit operations
on new history tables; foreign-key ON DELETE actions do not execute deletions
during migration. This static review does not authorize execution without the
identity, checkpoint, checksum and data-preservation gates.

| Migration | Changes and compatibility considerations |
| --- | --- |
| `20261022000200_organization_probation_policy` | Adds nullable JSONB policy and offer snapshot columns. Existing values remain unchanged; ALTER TABLE takes locks. |
| `20261022000300_payroll_statutory_integration` | Adds SEMI_MONTHLY enum value, five payroll tables, indexes and restrictive foreign keys. Builds two unique indexes on existing payroll tables; their tuples include primary-key IDs. Check prerequisite composite keys, object collisions and applied checksums. Enum additions require care if manually wrapping migrations in transactions; use the supported Prisma migration execution. |
| `20261023000100_platform_administration` | Adds three separate platform authentication tables and indexes. Session cascade applies to new platform records; no existing tenant records are modified. |
| `20261023000200_organization_onboarding` | Adds nullable contactEmail, two enums, invitation/audit tables, unique indexes and foreign keys. Requires platform administration and existing User composite key. |
| `20261023000300_public_company_registration` | Adds registration table, indexes and restrictive organization foreign key. Depends on onboarding enum. |
| `20261023000400_organization_gmail_integration` | Adds integration/OAuth tables, indexes and restrictive foreign keys. Database migration sends no email; copied credentials must remain disabled in the recovery process. |
| `20261024000100_saga_recruitment_sender` | Adds nullable testedAt and recruitmentGmailActive default false to the preceding integration table. Does not activate Gmail or send mail. |
| `20261024000200_hr_email_delivery` | Adds delivery table, bounded status/attempt checks, unique event key and restrictive foreign keys. Database migration sends no email. |
| `20261024000300_organization_resignation_policy` | Adds nullable JSONB resignation policy; no historical snapshot rewrite. |
| `20261024000400_employee_final_pay` | Transactionally adds nullable policy, three final-pay tables, checks, indexes, foreign keys and seven triggers. Triggers enforce immutable history, finalized-state rules and payment limits on new tables. Requires existing separation/User composite keys and expected enum/schema. |
| `20261024000500_ess_resignation_notice` | Transactionally adds HR-default submissionSource and nullable notice/acknowledgment fields, constraints, index, function and trigger. Existing cases satisfy the HR/null branch of the check. Existing column values are preserved, but the new provenance and acknowledgment rules constrain future case writes. ALTER TABLE/index/constraint validation can lock or scan existing cases. |

## Recovery evidence and next gates

Commands executed:

```powershell
node scripts/batch0-recovery-environment.cjs
node scripts/execute-batch0-recovery.cjs verify-startup
npm.cmd run dev
```

Connection verification passed. Schema verification failed as expected:
11 pending migrations, 180 missing model columns, seven missing enum values.
H10 checksums, all 16 expected H10 triggers, critical indexes and inspected
constraints passed. The saved connection and schema/history JSON evidence was
regenerated. Historical protected-data baselines and migration authorization
records were not overwritten.

The startup command exits 1 with `UNVERIFIED_RECOVERY_TARGET`; the startup gate
was not bypassed. SAGA workspace discovery and normal login were not verified
because a compatible, verified development server could not be started.

Before continuing, obtain verified Console/API branch-parent and endpoint
mapping, production/default status and deployment separation. Establish a new
checkpoint from this development branch **before these eleven migrations**,
separate from the production backup, and verify its identity, accessibility and
matching pre-recovery schema/history read-only. H10 is already applied on this
branch; the original guide's pre-H10 checkpoint pertains to the earlier recovery.
Capture a fresh branch-scoped protected-data fingerprint without overwriting the
old branch's baseline, validate applied migration checksums and prerequisites,
then deploy only the reviewed pending migrations using the direct child URL as
DATABASE_URL. The historical runner's `migrate` mode expects exactly two H10
migrations and must not be used for this eleven-migration recovery unchanged.
After deployment, compare existing records on their original columns, regenerate
schema evidence, start development, and verify normal SAGA discovery and login.

No production or backup connection, reset, data overwrite, migration resolution,
push, deployment, or unrelated application change was performed.
