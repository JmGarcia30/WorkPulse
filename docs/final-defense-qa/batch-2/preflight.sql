-- READ ONLY. Execute only against the independently confirmed runtime database.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT current_database() AS database,
       current_schema() AS schema,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('neon.branch_id', true) AS branch_id,
       current_setting('neon.endpoint_id', true) AS endpoint_id;
SELECT migration_name, checksum,
       finished_at IS NOT NULL AS finished,
       rolled_back_at IS NOT NULL AS rolled_back
FROM public."_prisma_migrations"
ORDER BY migration_name, started_at;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'CompanyRegistration'
ORDER BY ordinal_position;
SELECT l.pid, l.mode, l.granted
FROM pg_locks l
WHERE l.relation = to_regclass('public."CompanyRegistration"');
ROLLBACK;
