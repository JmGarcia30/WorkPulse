-- READ ONLY. Review-only production runbook artifact; not executed against production here.
-- Operator must independently bind these IDs to the active deployment before approving writes.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT current_database() AS database, current_schema() AS schema,
       current_setting('transaction_read_only') AS read_only,
       current_setting('neon.branch_id',true) AS branch_id,
       current_setting('neon.endpoint_id',true) AS endpoint_id;
SELECT migration_name, checksum,
       finished_at IS NOT NULL AS finished,
       rolled_back_at IS NOT NULL AS rolled_back
FROM public."_prisma_migrations" ORDER BY migration_name,started_at;
SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND
      (table_name IN ('AccountSecurityEvent','StaffPasswordReset') OR
       table_name='CompanyRegistration' AND column_name IN ('otpHash','otpNonce','otpAttempts'))
ORDER BY table_name,ordinal_position;
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='it_eval_immutable_security_event';
SELECT l.mode,l.granted FROM pg_locks l
WHERE l.relation=to_regclass('public."CompanyRegistration"');
ROLLBACK;
