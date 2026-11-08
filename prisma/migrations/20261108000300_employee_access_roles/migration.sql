-- Commit enum additions before functions/application code use them.
ALTER TYPE "Role" ADD VALUE 'FINANCE_OFFICER';
ALTER TYPE "Role" ADD VALUE 'ORGANIZATION_HEAD';
ALTER TYPE "EmployeeAccountAuditAction" ADD VALUE 'ROLE_CHANGED';
