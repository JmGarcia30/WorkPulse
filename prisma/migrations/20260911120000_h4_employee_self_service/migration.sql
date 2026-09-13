-- H4 Employee Self-Service Foundation
ALTER TYPE "Role" ADD VALUE 'EMPLOYEE';

CREATE TYPE "EmployeeAccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');
CREATE TYPE "EmployeeAccountAuditAction" AS ENUM (
  'ACCOUNT_CREATED',
  'EMPLOYEE_LINKED',
  'INVITATION_SENT',
  'INVITATION_RESENT',
  'INVITATION_SEND_FAILED',
  'ACTIVATED',
  'DISABLED',
  'ENABLED',
  'LINK_REJECTED'
);

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "EmployeeAccount" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "EmployeeAccountStatus" NOT NULL DEFAULT 'INVITED',
  "activationTokenHash" TEXT,
  "activationTokenExpiresAt" TIMESTAMP(3),
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "disabledReason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeAccountAudit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeAccountId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "action" "EmployeeAccountAuditAction" NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeAccountAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeAccount_userId_key" ON "EmployeeAccount"("userId");
CREATE UNIQUE INDEX "EmployeeAccount_employeeId_key" ON "EmployeeAccount"("employeeId");
CREATE UNIQUE INDEX "EmployeeAccount_activationTokenHash_key" ON "EmployeeAccount"("activationTokenHash");
CREATE INDEX "EmployeeAccount_organizationId_status_idx" ON "EmployeeAccount"("organizationId", "status");
CREATE INDEX "EmployeeAccount_createdById_idx" ON "EmployeeAccount"("createdById");
CREATE INDEX "EmployeeAccountAudit_organizationId_createdAt_idx" ON "EmployeeAccountAudit"("organizationId", "createdAt");
CREATE INDEX "EmployeeAccountAudit_employeeAccountId_createdAt_idx" ON "EmployeeAccountAudit"("employeeAccountId", "createdAt");
CREATE INDEX "EmployeeAccountAudit_actorUserId_idx" ON "EmployeeAccountAudit"("actorUserId");

ALTER TABLE "EmployeeAccount"
  ADD CONSTRAINT "EmployeeAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EmployeeAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EmployeeAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EmployeeAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EmployeeAccount_state_check" CHECK (
    ("status" = 'INVITED' AND "activationTokenHash" IS NOT NULL AND "activationTokenExpiresAt" IS NOT NULL AND "activatedAt" IS NULL AND "disabledAt" IS NULL)
    OR ("status" = 'ACTIVE' AND "activationTokenHash" IS NULL AND "activationTokenExpiresAt" IS NULL AND "activatedAt" IS NOT NULL AND "disabledAt" IS NULL)
    OR ("status" = 'DISABLED' AND "activationTokenHash" IS NULL AND "activationTokenExpiresAt" IS NULL AND "disabledAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "EmployeeAccount_disabled_reason_check" CHECK (
    "disabledReason" IS NULL OR (length(trim("disabledReason")) BETWEEN 1 AND 2000)
  );

ALTER TABLE "EmployeeAccountAudit"
  ADD CONSTRAINT "EmployeeAccountAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EmployeeAccountAudit_employeeAccountId_fkey" FOREIGN KEY ("employeeAccountId") REFERENCES "EmployeeAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EmployeeAccountAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "h4_assert_account_consistency"() RETURNS trigger AS $$
DECLARE
  related_org TEXT;
  linked_role "Role";
BEGIN
  SELECT "organizationId", "role" INTO related_org, linked_role FROM "User" WHERE "id" = NEW."userId";
  IF related_org IS DISTINCT FROM NEW."organizationId" OR linked_role IS DISTINCT FROM 'EMPLOYEE' THEN
    RAISE EXCEPTION 'Invalid employee account user or tenant';
  END IF;
  SELECT "organizationId" INTO related_org FROM "Employee" WHERE "id" = NEW."employeeId";
  IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant employee account link'; END IF;
  SELECT "organizationId" INTO related_org FROM "User" WHERE "id" = NEW."createdById" AND "role" IN ('ORGANIZATION_ADMIN', 'HR_ADMIN');
  IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Invalid employee account creator'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW."organizationId", NEW."userId", NEW."employeeId") IS DISTINCT FROM (OLD."organizationId", OLD."userId", OLD."employeeId") THEN
    RAISE EXCEPTION 'Employee account ownership is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EmployeeAccount_consistency_check"
BEFORE INSERT OR UPDATE ON "EmployeeAccount"
FOR EACH ROW EXECUTE FUNCTION "h4_assert_account_consistency"();

CREATE OR REPLACE FUNCTION "h4_assert_audit_consistency"() RETURNS trigger AS $$
DECLARE
  related_org TEXT;
BEGIN
  SELECT "organizationId" INTO related_org FROM "User" WHERE "id" = NEW."actorUserId";
  IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant employee account audit actor'; END IF;
  IF NEW."employeeAccountId" IS NOT NULL THEN
    SELECT "organizationId" INTO related_org FROM "EmployeeAccount" WHERE "id" = NEW."employeeAccountId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant employee account audit'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EmployeeAccountAudit_consistency_check"
BEFORE INSERT ON "EmployeeAccountAudit"
FOR EACH ROW EXECUTE FUNCTION "h4_assert_audit_consistency"();

CREATE OR REPLACE FUNCTION "h4_reject_audit_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'EmployeeAccountAudit is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EmployeeAccountAudit_immutable"
BEFORE UPDATE OR DELETE ON "EmployeeAccountAudit"
FOR EACH ROW EXECUTE FUNCTION "h4_reject_audit_change"();
