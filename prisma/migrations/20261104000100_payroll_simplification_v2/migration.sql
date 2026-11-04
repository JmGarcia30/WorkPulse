-- Additive only: existing payroll, compensation, policy and finalized snapshots are untouched.
-- Pre-release revision: all objects are installed atomically. Production has not applied this migration.
BEGIN;
CREATE TABLE "PayrollNotification" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
 "payrollEntryId" TEXT NOT NULL UNIQUE, "recipientUserId" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL, "message" TEXT NOT NULL CHECK (length(btrim("message")) > 0), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("payrollEntryId", "organizationId", "employeeId") REFERENCES "PayrollEntry"("id", "organizationId", "employeeId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("actorUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("recipientUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PayrollNotification_organizationId_recipientUserId_createdAt_idx" ON "PayrollNotification"("organizationId", "recipientUserId", "createdAt");
CREATE UNIQUE INDEX "PayrollNotification_payrollEntryId_organizationId_employeeId_key" ON "PayrollNotification"("payrollEntryId", "organizationId", "employeeId");
CREATE TABLE "PayrollInputRevision" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
 "payrollPeriodId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL, "reason" TEXT NOT NULL CHECK (length(btrim("reason")) > 0),
 "before" JSONB NOT NULL CHECK (jsonb_typeof("before") = 'object'), "after" JSONB NOT NULL CHECK (jsonb_typeof("after") = 'object'), "previousEntry" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("employeeId", "organizationId") REFERENCES "Employee"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("payrollPeriodId", "organizationId") REFERENCES "PayrollPeriod"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("actorUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PayrollInputRevision_organizationId_payrollPeriodId_employeeId_idx" ON "PayrollInputRevision"("organizationId", "payrollPeriodId", "employeeId");
CREATE FUNCTION "payroll_v2_validate_insert"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=NEW."actorUserId" AND "organizationId"=NEW."organizationId" AND role IN ('HR_ADMIN','ORGANIZATION_ADMIN')) THEN
  RAISE EXCEPTION 'Payroll actor is outside authorized tenant';
 END IF;
 IF TG_TABLE_NAME='PayrollNotification' THEN
  IF NOT EXISTS (SELECT 1 FROM "PayrollEntry" e JOIN "PayrollPeriod" p ON p.id=e."payrollPeriodId" AND p."organizationId"=e."organizationId"
    JOIN "Employee" employee ON employee.id=e."employeeId" AND employee."organizationId"=e."organizationId" AND employee."employeeStatus"='ACTIVE'
    JOIN "EmployeeAccount" a ON a."employeeId"=e."employeeId" AND a."organizationId"=e."organizationId"
    JOIN "User" u ON u.id=a."userId" AND u."organizationId"=e."organizationId"
    WHERE e.id=NEW."payrollEntryId" AND e.status='FINALIZED' AND p.status='FINALIZED' AND p."finalizedAt" IS NOT NULL
      AND a."userId"=NEW."recipientUserId" AND a.status='ACTIVE' AND u.role='EMPLOYEE') THEN
   RAISE EXCEPTION 'Notification requires an owned finalized payslip';
  END IF;
 ELSE
  IF NOT EXISTS (SELECT 1 FROM "Employee" WHERE id=NEW."employeeId" AND "organizationId"=NEW."organizationId")
    OR NOT EXISTS (SELECT 1 FROM "PayrollPeriod" WHERE id=NEW."payrollPeriodId" AND "organizationId"=NEW."organizationId" AND status<>'FINALIZED') THEN
   RAISE EXCEPTION 'Revision requires an unfinished period in the same tenant';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "PayrollNotification_validate" BEFORE INSERT ON "PayrollNotification" FOR EACH ROW EXECUTE FUNCTION "payroll_v2_validate_insert"();
CREATE TRIGGER "PayrollInputRevision_validate" BEFORE INSERT ON "PayrollInputRevision" FOR EACH ROW EXECUTE FUNCTION "payroll_v2_validate_insert"();
CREATE FUNCTION "payroll_v2_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Payroll audit and notification records are immutable'; END $$;
CREATE TRIGGER "PayrollInputRevision_immutable" BEFORE UPDATE OR DELETE ON "PayrollInputRevision" FOR EACH ROW EXECUTE FUNCTION "payroll_v2_immutable"();
CREATE TRIGGER "PayrollNotification_immutable" BEFORE UPDATE OR DELETE ON "PayrollNotification" FOR EACH ROW EXECUTE FUNCTION "payroll_v2_immutable"();
CREATE TRIGGER "PayrollInputRevision_no_truncate" BEFORE TRUNCATE ON "PayrollInputRevision" FOR EACH STATEMENT EXECUTE FUNCTION "payroll_v2_immutable"();
CREATE TRIGGER "PayrollNotification_no_truncate" BEFORE TRUNCATE ON "PayrollNotification" FOR EACH STATEMENT EXECUTE FUNCTION "payroll_v2_immutable"();
COMMIT;
