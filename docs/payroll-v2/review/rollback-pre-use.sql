-- Review artifact only. Production execution is NOT authorized.
-- Pre-use rollback: refuse to discard a single notification or audit record.
-- After use, roll back application code and RETAIN these additive tables/history.
BEGIN;
LOCK TABLE "PayrollNotification", "PayrollInputRevision" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PayrollNotification") OR EXISTS (SELECT 1 FROM "PayrollInputRevision") THEN
    RAISE EXCEPTION 'Payroll V2 rollback refused: retain notification and revision history';
  END IF;
END $$;
DROP TABLE "PayrollNotification";
DROP TABLE "PayrollInputRevision";
DROP FUNCTION "payroll_v2_validate_insert"();
DROP FUNCTION "payroll_v2_immutable"();
-- Migration history must be reconciled through an approved Prisma recovery plan.
-- This script deliberately never edits _prisma_migrations.
-- If removal is approved after a successful deploy, package these statements in a NEW
-- forward rollback migration so Prisma records both transitions. Do not mark a successful
-- migration as failed or edit its recorded checksum. Normal app rollback retains these tables.
COMMIT;
