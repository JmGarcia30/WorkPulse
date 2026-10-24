BEGIN;
ALTER TABLE "EmployeeSeparationCase"
 ADD COLUMN "submissionSource" TEXT NOT NULL DEFAULT 'HR',
 ADD COLUMN "employeeNoticeSnapshot" JSONB,
 ADD COLUMN "acknowledgedById" TEXT,
 ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
 ADD COLUMN "acknowledgmentRemarks" TEXT;
ALTER TABLE "EmployeeSeparationCase"
 ADD CONSTRAINT "EmployeeSeparationCase_acknowledgedById_organizationId_fkey" FOREIGN KEY ("acknowledgedById","organizationId") REFERENCES "User"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "SeparationCase_notice_source" CHECK (
  ("submissionSource"='HR' AND "employeeNoticeSnapshot" IS NULL AND "acknowledgedById" IS NULL AND "acknowledgedAt" IS NULL AND "acknowledgmentRemarks" IS NULL)
  OR ("submissionSource"='ESS' AND "separationType"='RESIGNATION' AND "employeeNoticeSnapshot" IS NOT NULL AND jsonb_typeof("employeeNoticeSnapshot")='object'
   AND "noticeDate" IS NOT NULL AND "proposedLastWorkingDay" IS NOT NULL AND "proposedEffectiveDate" IS NOT NULL
   AND "proposedLastWorkingDay"<"proposedEffectiveDate"
   AND "employeeNoticeSnapshot"->>'reason' IS NOT DISTINCT FROM "reason"
   AND "employeeNoticeSnapshot"->>'noticeDate' IS NOT DISTINCT FROM to_char("noticeDate",'YYYY-MM-DD')
   AND "employeeNoticeSnapshot"->>'proposedLastWorkingDay' IS NOT DISTINCT FROM to_char("proposedLastWorkingDay",'YYYY-MM-DD')
   AND "employeeNoticeSnapshot"->>'proposedEffectiveDate' IS NOT DISTINCT FROM to_char("proposedEffectiveDate",'YYYY-MM-DD'))
 ),
 ADD CONSTRAINT "SeparationCase_acknowledgment_documented" CHECK (
  ("acknowledgedById" IS NULL AND "acknowledgedAt" IS NULL AND "acknowledgmentRemarks" IS NULL)
  OR ("acknowledgedById" IS NOT NULL AND "acknowledgedAt" IS NOT NULL AND "acknowledgmentRemarks" IS NOT NULL AND length(btrim("acknowledgmentRemarks"))>0)
 );
CREATE INDEX "EmployeeSeparationCase_org_source_ack_status_idx" ON "EmployeeSeparationCase"("organizationId","submissionSource","acknowledgedAt","status");
CREATE FUNCTION "SeparationCase_preserve_employee_notice"() RETURNS TRIGGER AS $$
DECLARE employee_state "EmployeeStatus";
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW."submissionSource"='ESS' THEN
   SELECT "employeeStatus" INTO employee_state FROM "Employee" WHERE "id"=NEW."employeeId" AND "organizationId"=NEW."organizationId" FOR UPDATE;
   IF employee_state IS DISTINCT FROM 'ACTIVE' OR NOT EXISTS (
    SELECT 1 FROM "EmployeeAccount" a JOIN "User" u ON u."id"=a."userId"
    WHERE a."employeeId"=NEW."employeeId" AND a."organizationId"=NEW."organizationId" AND a."status"='ACTIVE'
      AND u."id"=NEW."initiatedById" AND u."organizationId"=NEW."organizationId" AND u."role"='EMPLOYEE'
   ) THEN RAISE EXCEPTION 'Current active employee identity is required for an ESS notice'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF NEW."submissionSource" IS DISTINCT FROM OLD."submissionSource" OR NEW."employeeNoticeSnapshot" IS DISTINCT FROM OLD."employeeNoticeSnapshot" THEN RAISE EXCEPTION 'Original employee notice provenance is immutable'; END IF;
 IF OLD."submissionSource"='ESS' AND ROW(NEW."separationType",NEW."reason",NEW."noticeDate",NEW."proposedLastWorkingDay",NEW."proposedEffectiveDate") IS DISTINCT FROM ROW(OLD."separationType",OLD."reason",OLD."noticeDate",OLD."proposedLastWorkingDay",OLD."proposedEffectiveDate") THEN RAISE EXCEPTION 'Employee submitted reason and dates cannot be rewritten'; END IF;
 IF OLD."acknowledgedAt" IS NOT NULL AND ROW(NEW."acknowledgedById",NEW."acknowledgedAt",NEW."acknowledgmentRemarks") IS DISTINCT FROM ROW(OLD."acknowledgedById",OLD."acknowledgedAt",OLD."acknowledgmentRemarks") THEN RAISE EXCEPTION 'Recorded receipt acknowledgment is immutable'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;
CREATE TRIGGER "SeparationCase_employee_notice" BEFORE INSERT OR UPDATE ON "EmployeeSeparationCase" FOR EACH ROW EXECUTE FUNCTION "SeparationCase_preserve_employee_notice"();
COMMIT;
