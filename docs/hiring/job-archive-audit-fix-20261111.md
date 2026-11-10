# Job archive failure — production root cause and release checklist

## Confirmed root cause (2026-11-11 Asia/Manila)

The Vercel production function logged PostgreSQL SQLSTATE **23514** when an HR user attempted to archive a CLOSED job:
`AccountSecurityEvent_action_check` rejected `JOB_ARCHIVED`.
The archived job status update and audit insert run in the same transaction via
`auditedJobMutation`, so the failure correctly rolls back the status change.

The original constraint was created in
`20261102000100_it_eval_account_security/migration.sql` and allows only the
original security/job events. PR #19 introduced `JOB_ARCHIVED`, `JOB_REUSED`,
and `JOB_REUSE_REQUEST`; PR #20 added `JOB_AUTO_CLOSED`.
Those event values must be permitted by the database as well as the TypeScript code.

## Change

- `20261111000100_job_lifecycle_audit_actions` replaces just the action check
  constraint and validates it, preserving the original 13 values.
- Four lifecycle action values are added: `JOB_ARCHIVED`,
  `JOB_REUSED`, `JOB_REUSE_REQUEST`, `JOB_AUTO_CLOSED`.
- Audit read-model labels are updated to render these events.
- No job, application, user, subscription, or historical audit data is changed.
- No tables or columns are dropped, and the immutable audit-event trigger remains.

## Production release gate (not performed by this PR)

1. Confirm the production Vercel → Neon database binding and review a recent
   backup/recovery point before any schema alteration.
2. Run `npx prisma migrate status` against the intended database using the
   usual approved migration environment. Check for earlier pending migrations.
3. Review the single SQL file and apply it using the project's reviewed
   `prisma migrate deploy` workflow. Do not run `prisma db push` or
   edit previously-applied migration files.
4. Verify `_prisma_migrations` records this migration successfully; then run:
   ```sql
   SELECT pg_get_constraintdef(c.oid)
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'AccountSecurityEvent'
      AND c.conname = 'AccountSecurityEvent_action_check';
   ```
   It must list all 17 action values. Verify the immutable audit trigger
   still exists.
5. In an authorized test tenant (or an isolated DB clone), test:
   - PUBLISHED → CLOSED → ARCHIVED, one success audit event per action.
   - The original job's application and employment links are unchanged.
   - Archived jobs disappear from the default jobs list and appear in Archived.
   - Archived jobs cannot be edited or republished.
   - Reuse Posting creates one new DRAFT with copied requirements but **zero**
     copied applicants; reusing the same request ID is idempotent.
   - A valid expired published posting is closed by the cron and records
     `JOB_AUTO_CLOSED`; do not run production cron manually as a smoke test.
   - Wrong organization / insufficient role are rejected; rate limits still work.
   - Existing security event actions still insert correctly.
6. Check Vercel function logs for no new SQLSTATE 23514 / transaction errors.
   Release/merge only after the migration and smoke tests are planned together.

**Important:** Deploying frontend/server code alone does not alter the DB
constraint. The initial fix requires an approved database migration.
