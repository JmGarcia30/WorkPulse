# Actual Production target: UNVERIFIED

Read-only access check only. No database connections or migration queries were
repeated for an unconfirmed target in this step.

Confirmed locally:

- No `vercel` executable on PATH or installed project CLI package.
- No `.vercel/project.json` link for the existing project.
- No Vercel token in the process/local configuration, or stored CLI authorization
  at the standard user configuration locations checked.
- No Neon provider API credentials or connected Vercel/Neon tools.
- No credentials were printed, pulled to files, committed or sent to an external
  service. Environment/recovery files and Vercel settings were not changed.

Consequently authorized CLI access, the active deployment's effective protected
DATABASE_URL, its Neon project/branch binding and its backup status are inaccessible.
Installing a CLI alone would not authorize access or make a sensitive secret readable.
Vercel Secret/sensitive variables cannot be read back after creation. Do not rely
on `env pull` to recover that protected value or use it to overwrite local files.
[Vercel Secret variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

## Known candidate, NOT confirmed as Vercel Production

Prior read-only SQL identified local `.env`'s endpoint as:

- Neon project ID: unknown.
- Branch ID: `br-hidden-violet-azjl3vam`.
- Endpoint ID: `ep-weathered-mouse-azpx765h`.
- Database/schema: `neondb/public`.
- 24 applied migrations, 12 pending versus committed SQL; applied checksums match.

These facts must not be relabeled as the actual Vercel target without the mapping
below. The recovered development branch's 36/36 result is also not Production proof.

## Exact operator verification steps — no settings changes

1. Sign into the authorized Vercel team. Open the existing project owning
   `work-pulse-omega.vercel.app`; confirm its project ID/name and identify the
   deployment currently serving that domain, its Production target, deployment ID
   and commit. Do not assume the project name from the public hostname.
2. Inspect Production environment-variable metadata for DATABASE_URL, including
   shared/integration scope and overrides. Current project settings alone do not
   prove the values attached to an older active deployment. Do not reveal, copy
   into chat, pull to `.env`, replace or downgrade the protected secret.
3. Open the project's existing Neon integration/storage-resource association, if
   present. Record only its Neon project ID, Production branch ID, endpoint ID and
   database name. Verify the active deployment used that binding. If the variable
   was manually entered without a verifiable binding, use an existing authorized
   secret-owner provisioning record or already available runtime identity evidence.
   If neither proves the effective target, **stop as UNVERIFIED**. A new runtime
   diagnostic deployment or secret change needs separate authorization and is not
   permitted by this task.
4. In Neon Console, select that exact project/branch and confirm its compute
   endpoint ID and database. Compare the non-secret identifiers with the candidate
   above. A matching project name or database name alone is insufficient.
5. Only after confirming the mapping, use Neon SQL Editor/an authorized existing
   connection to run this single read-only transaction. Return metadata only:

```sql
BEGIN READ ONLY;
SELECT current_database() AS database, current_schema() AS schema,
       current_setting('transaction_read_only') AS read_only,
       current_setting('neon.branch_id', true) AS branch_id,
       current_setting('neon.endpoint_id', true) AS endpoint_id;
SELECT migration_name, checksum,
       finished_at IS NOT NULL AS finished,
       rolled_back_at IS NOT NULL AS rolled_back
FROM public._prisma_migrations
ORDER BY started_at, migration_name;
ROLLBACK;
```

6. For that same branch, open **Postgres database → Backup & Restore** and inspect
   existing history/restore options without clicking Restore or creating a branch.
   Record the actual configured history window, earliest/latest recoverable UTC
   timestamps, any existing snapshot/export ID and time, accessibility/status,
   required owner/restore permissions, and root/child or protected-branch restore
   constraints. Require a recoverable point before the proposed migration window;
   do not infer it from a plan's advertised maximum or a development checkpoint.
7. Obtain an existing successful restore-test record identifying the source
   project/branch, recovery timestamp, separate restored target, validation and
   date. Without it, restoration is **not demonstrated**. Do not perform a restore,
   export, reset or new-branch rehearsal during this step.

Neon supports historical restoration within the configured history window, but
the actual branch's availability, retention, restore permissions and prior test
remain unverified here. [Neon restore requirements](https://neon.com/docs/postgres/backup-restore/branch-restore).

## Decision

Actual Production applied/pending migrations: **unknown** until the mapping is
verified. Usable backup: **not confirmed**, not evidence that none exists.
Restoration readiness/testing: **unverified**. Next action: an authorized project
owner supplies the non-secret mapping, confirmed-target migration metadata and
backup/restore evidence above. Keep the production release **NO-GO** meanwhile.
