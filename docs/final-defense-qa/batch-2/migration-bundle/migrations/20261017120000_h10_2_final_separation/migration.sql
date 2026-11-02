BEGIN;
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SeparationCaseStatus" ADD VALUE 'APPROVED_PENDING_EFFECTIVE';
ALTER TYPE "SeparationCaseStatus" ADD VALUE 'COMPLETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SeparationAuditAction" ADD VALUE 'CASE_APPROVED';
ALTER TYPE "SeparationAuditAction" ADD VALUE 'EMPLOYMENT_CLOSED';
ALTER TYPE "SeparationAuditAction" ADD VALUE 'PROBATION_CLOSED';
ALTER TYPE "SeparationAuditAction" ADD VALUE 'SEPARATION_COMPLETED';

-- PostgreSQL must commit enum additions before new values are used below.
COMMIT;
BEGIN;

-- AlterTable
ALTER TABLE "EmployeeSeparationCase" ADD COLUMN     "approvalDecision" TEXT,
ADD COLUMN     "approvalRemarks" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "approvedDetailsVersion" INTEGER,
ADD COLUMN     "backdatedJustification" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "completionSnapshot" JSONB,
ADD COLUMN     "executionRemarks" TEXT;

-- AlterTable
ALTER TABLE "ProbationRecord" ADD COLUMN     "closedBySeparationCaseId" TEXT;

-- CreateIndex
CREATE INDEX "ProbationRecord_closedBySeparationCaseId_idx" ON "ProbationRecord"("closedBySeparationCaseId");

-- AddForeignKey
ALTER TABLE "EmployeeSeparationCase" ADD CONSTRAINT "EmployeeSeparationCase_approvedById_organizationId_fkey" FOREIGN KEY ("approvedById", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationCase" ADD CONSTRAINT "EmployeeSeparationCase_completedById_organizationId_fkey" FOREIGN KEY ("completedById", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProbationRecord" ADD CONSTRAINT "ProbationRecord_closedBySeparationCaseId_fkey" FOREIGN KEY ("closedBySeparationCaseId") REFERENCES "EmployeeSeparationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "EmployeeSeparationCase_one_active_employee";
CREATE UNIQUE INDEX "EmployeeSeparationCase_one_active_employee"
ON "EmployeeSeparationCase" ("organizationId", "employeeId")
WHERE "status" IN ('DRAFT', 'IN_PROGRESS', 'READY_FOR_FINAL_REVIEW', 'APPROVED_PENDING_EFFECTIVE');

ALTER TABLE "EmployeeSeparationCase"
ADD CONSTRAINT "SeparationCase_final_approval_required" CHECK (
  "status" NOT IN ('APPROVED_PENDING_EFFECTIVE', 'COMPLETED') OR
  ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL AND "approvalDecision" IS NOT NULL AND "approvalDecision" = 'APPROVE_SEPARATION' AND
   "approvalRemarks" IS NOT NULL AND length(btrim("approvalRemarks")) > 0 AND
   "approvedDetailsVersion" IS NOT NULL AND "approvedDetailsVersion" = "versionOfDetails" AND "proposedEffectiveDate" IS NOT NULL AND "proposedLastWorkingDay" IS NOT NULL AND
   "proposedLastWorkingDay" < "proposedEffectiveDate")
),
ADD CONSTRAINT "SeparationCase_completion_required" CHECK (
  "status" <> 'COMPLETED' OR
  ("completedById" IS NOT NULL AND "completedAt" IS NOT NULL AND "completionSnapshot" IS NOT NULL AND
   "executionRemarks" IS NOT NULL AND length(btrim("executionRemarks")) > 0)
);

-- Separation is a distinct administrative closure, not an invented H2 decision.
ALTER TABLE "ProbationRecord" DROP CONSTRAINT "ProbationRecord_lifecycle_state_check";
ALTER TABLE "ProbationRecord" ADD CONSTRAINT "ProbationRecord_lifecycle_state_check" CHECK (
  ("probationStatus" = 'ACTIVE' AND "decision" = 'PENDING' AND "completedAt" IS NULL AND
   "decisionAt" IS NULL AND "decisionById" IS NULL AND "closedBySeparationCaseId" IS NULL)
  OR
  ("probationStatus" = 'CLOSED' AND "decision" <> 'PENDING' AND "completedAt" IS NOT NULL AND
   "decisionAt" IS NOT NULL AND "decisionById" IS NOT NULL AND "closedBySeparationCaseId" IS NULL)
  OR
  ("probationStatus" = 'CLOSED' AND "decision" = 'PENDING' AND "completedAt" IS NOT NULL AND
   "decisionAt" IS NULL AND "decisionById" IS NULL AND "closedBySeparationCaseId" IS NOT NULL)
);

CREATE FUNCTION "SeparationCase_protect_final_state"() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'COMPLETED' THEN RAISE EXCEPTION 'Completed separation is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF OLD."status" = 'CANCELLED' THEN RAISE EXCEPTION 'Cancelled separation is terminal'; END IF;
  IF OLD."status" = 'APPROVED_PENDING_EFFECTIVE' AND
     (to_jsonb(OLD) - ARRAY['status','version','updatedAt','completedById','completedAt','executionRemarks','completionSnapshot','cancelledById','cancelledAt','cancellationReason']) IS DISTINCT FROM
     (to_jsonb(NEW) - ARRAY['status','version','updatedAt','completedById','completedAt','executionRemarks','completionSnapshot','cancelledById','cancelledAt','cancellationReason'])
  THEN RAISE EXCEPTION 'Approved separation details are frozen'; END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('IN_PROGRESS','CANCELLED')) OR
    (OLD."status" = 'IN_PROGRESS' AND NEW."status" IN ('READY_FOR_FINAL_REVIEW','CANCELLED')) OR
    (OLD."status" = 'READY_FOR_FINAL_REVIEW' AND NEW."status" IN ('APPROVED_PENDING_EFFECTIVE','CANCELLED')) OR
    (OLD."status" = 'APPROVED_PENDING_EFFECTIVE' AND NEW."status" IN ('COMPLETED','CANCELLED'))
  ) THEN RAISE EXCEPTION 'Invalid separation status transition'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;
CREATE TRIGGER "SeparationCase_final_state" BEFORE UPDATE OR DELETE ON "EmployeeSeparationCase"
FOR EACH ROW EXECUTE FUNCTION "SeparationCase_protect_final_state"();

CREATE FUNCTION "ProbationRecord_assert_separation_scope"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."closedBySeparationCaseId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "EmployeeSeparationCase" c JOIN "Employee" e ON e."id" = NEW."employeeId"
    WHERE c."id" = NEW."closedBySeparationCaseId" AND c."employeeId" = e."id" AND c."organizationId" = e."organizationId"
  ) THEN RAISE EXCEPTION 'Invalid probation separation scope'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;
CREATE TRIGGER "ProbationRecord_separation_scope" BEFORE INSERT OR UPDATE ON "ProbationRecord"
FOR EACH ROW EXECUTE FUNCTION "ProbationRecord_assert_separation_scope"();

-- Guard new active-employee work even when an older service or in-flight request
-- passed its eligibility check before separation committed. Historical financial
-- settlement and historical attendance maintenance remain possible.
CREATE FUNCTION "Employee_guard_post_separation_work"() RETURNS TRIGGER AS $$
DECLARE employee_state "EmployeeStatus"; effective DATE; institution_zone TEXT; work_date DATE;
BEGIN
  SELECT e."employeeStatus", o."timeZone" INTO employee_state, institution_zone
  FROM "Employee" e JOIN "Organization" o ON o."id" = e."organizationId"
  WHERE e."id" = NEW."employeeId" FOR UPDATE OF e;
  IF employee_state IS DISTINCT FROM 'SEPARATED' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME IN ('EmploymentRecord','EmployeeScheduleAssignment','LeaveDocument') THEN
    RAISE EXCEPTION 'New active-employee work is unavailable after separation';
  ELSIF TG_TABLE_NAME = 'EmployeeAccount' THEN
    IF NEW."status" <> 'DISABLED' THEN RAISE EXCEPTION 'Separated employee account cannot be activated'; END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'EmployeeCompensation' THEN
    IF NEW."status" = 'ACTIVE' THEN RAISE EXCEPTION 'Separated employee cannot receive active compensation'; END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'LeaveRequest' THEN
    IF TG_OP = 'INSERT' OR (NEW."status" = 'APPROVED' AND OLD."status" <> 'APPROVED') THEN
      RAISE EXCEPTION 'Separated employee cannot receive new active leave';
    END IF;
    RETURN NEW;
  END IF;
  SELECT c."proposedEffectiveDate" INTO effective FROM "EmployeeSeparationCase" c
  WHERE c."employeeId" = NEW."employeeId" AND c."status" = 'COMPLETED' ORDER BY c."completedAt" DESC LIMIT 1;
  IF TG_TABLE_NAME = 'AttendanceEvent' THEN
    work_date := ((NEW."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE institution_zone)::date;
  ELSIF TG_TABLE_NAME = 'DailyAttendanceRecord' THEN work_date := NEW."attendanceDate";
  ELSIF TG_TABLE_NAME = 'PayrollEntry' THEN
    SELECT p."periodStart" INTO work_date FROM "PayrollPeriod" p WHERE p."id" = NEW."payrollPeriodId";
  END IF;
  IF effective IS NULL OR work_date >= effective THEN RAISE EXCEPTION 'Transaction date is outside completed employment'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;

CREATE TRIGGER "EmploymentRecord_post_separation" BEFORE INSERT ON "EmploymentRecord" FOR EACH ROW EXECUTE FUNCTION "Employee_guard_post_separation_work"();
CREATE TRIGGER "ScheduleAssignment_post_separation" BEFORE INSERT ON "EmployeeScheduleAssignment" FOR EACH ROW EXECUTE FUNCTION "Employee_guard_post_separation_work"();
CREATE TRIGGER "LeaveDocument_post_separation" BEFORE INSERT ON "LeaveDocument" FOR EACH ROW EXECUTE FUNCTION "Employee_guard_post_separation_work"();
CREATE TRIGGER "EmployeeAccount_post_separation" BEFORE INSERT OR UPDATE ON "EmployeeAccount" FOR EACH ROW EXECUTE FUNCTION "Employee_guard_post_separation_work"();
CREATE TRIGGER "Compensation_post_separation" BEFORE INSERT OR UPDATE ON "EmployeeCompensation" FOR EACH ROW EXECUTE FUNCTION "Employee_guard_post_separation_work"();
CREATE TRIGGER "LeaveRequest_post_separation" BEFORE INSERT OR UPDATE ON "LeaveRequest" FOR EACH ROW EXECUTE FUNCTION "Employee_guard_post_separation_work"();
CREATE TRIGGER "AttendanceEvent_post_separation" BEFORE INSERT ON "AttendanceEvent" FOR EACH ROW EXECUTE FUNCTION "Employee_guard_post_separation_work"();
CREATE TRIGGER "DailyAttendance_post_separation" BEFORE INSERT OR UPDATE ON "DailyAttendanceRecord" FOR EACH ROW EXECUTE FUNCTION "Employee_guard_post_separation_work"();
CREATE TRIGGER "PayrollEntry_post_separation" BEFORE INSERT OR UPDATE ON "PayrollEntry" FOR EACH ROW EXECUTE FUNCTION "Employee_guard_post_separation_work"();
COMMIT;

