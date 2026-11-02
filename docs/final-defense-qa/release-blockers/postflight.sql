-- READ ONLY. Execute only after the separately approved migration, on the SAME verified endpoint.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT current_database() AS database,current_setting('transaction_read_only') AS read_only,
       current_setting('neon.branch_id',true) AS branch_id,
       current_setting('neon.endpoint_id',true) AS endpoint_id;
SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,
       rolled_back_at IS NOT NULL AS rolled_back
FROM public."_prisma_migrations" ORDER BY migration_name,started_at;
SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND
      (table_name IN ('AccountSecurityEvent','StaffPasswordReset') OR
       table_name='CompanyRegistration' AND column_name IN ('otpHash','otpNonce','otpAttempts'))
ORDER BY table_name,ordinal_position;
SELECT c.relname AS table_name,k.conname,pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('AccountSecurityEvent','StaffPasswordReset')
ORDER BY c.relname,k.conname;
SELECT t.tgname,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='AccountSecurityEvent' AND NOT t.tgisinternal;
ROLLBACK;
