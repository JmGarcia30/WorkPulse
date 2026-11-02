-- READ ONLY. Run after separately approved migration execution.
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
WHERE migration_name = '20261027000100_company_registration_otp';
SELECT count(*) AS completed_migrations
FROM public."_prisma_migrations"
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'CompanyRegistration'
  AND column_name IN ('otpHash', 'otpNonce', 'otpAttempts')
ORDER BY ordinal_position;
ROLLBACK;
