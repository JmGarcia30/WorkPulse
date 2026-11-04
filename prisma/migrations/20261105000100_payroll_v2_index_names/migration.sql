-- Normalize only the new V2 indexes to Prisma's 63-byte identifier convention.
-- Historical table indexes and all payroll rows are unchanged.
BEGIN;
ALTER INDEX "PayrollInputRevision_organizationId_payrollPeriodId_employeeId_"
  RENAME TO "PayrollInputRevision_organizationId_payrollPeriodId_employe_idx";
ALTER INDEX "PayrollNotification_organizationId_recipientUserId_createdAt_id"
  RENAME TO "PayrollNotification_organizationId_recipientUserId_createdA_idx";
ALTER INDEX "PayrollNotification_payrollEntryId_organizationId_employeeId_ke"
  RENAME TO "PayrollNotification_payrollEntryId_organizationId_employeeI_key";
COMMIT;
