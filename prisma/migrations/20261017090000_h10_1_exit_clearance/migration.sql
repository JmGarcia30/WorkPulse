-- CreateEnum
CREATE TYPE "SeparationType" AS ENUM ('RESIGNATION', 'RETIREMENT', 'END_OF_CONTRACT', 'TERMINATION', 'OTHER');

-- CreateEnum
CREATE TYPE "SeparationCaseStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY_FOR_FINAL_REVIEW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SeparationNoticeCompliance" AS ENUM ('NOT_APPLICABLE', 'POLICY_REQUIRED', 'PENDING', 'COMPLIANT', 'EXCEPTION_REQUIRED', 'EXCEPTION_RECORDED');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('PENDING', 'CLEARED', 'BLOCKED', 'WAIVED');

-- CreateEnum
CREATE TYPE "SeparationAuditAction" AS ENUM ('CASE_CREATED', 'CASE_UPDATED', 'CASE_CANCELLED', 'NOTICE_RECORDED', 'NOTICE_EXCEPTION_RECORDED', 'CLEARANCE_ITEM_CREATED', 'CLEARANCE_UPDATED', 'CLEARANCE_WAIVED', 'REVIEW_RECORDED', 'READY_FOR_REVIEW');

-- CreateEnum
CREATE TYPE "SeparationReviewKind" AS ENUM ('NOTICE_SUPERIOR', 'NOTICE_HRMO', 'TERMINATION_ADMIN_REVIEW', 'TERMINATION_DOCUMENTATION', 'TERMINATION_DUE_PROCESS');

-- CreateTable
CREATE TABLE "EmployeeSeparationCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "separationType" "SeparationType" NOT NULL,
    "reason" TEXT NOT NULL,
    "noticeDate" DATE,
    "proposedLastWorkingDay" DATE,
    "proposedEffectiveDate" DATE,
    "noticeCompliance" "SeparationNoticeCompliance" NOT NULL DEFAULT 'PENDING',
    "noticeExceptionReason" TEXT,
    "noticeExceptionById" TEXT,
    "noticeExceptionAt" TIMESTAMP(3),
    "noticeRemarks" TEXT,
    "policySnapshot" JSONB NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SeparationCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "administrativeRemarks" TEXT,
    "inactiveEmployeeJustification" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "versionOfDetails" INTEGER NOT NULL DEFAULT 0,
    "requestKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSeparationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeClearanceItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" "ClearanceStatus" NOT NULL DEFAULT 'PENDING',
    "responsibleUnit" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "requestKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeClearanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSeparationReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "SeparationReviewKind" NOT NULL,
    "evidence" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caseVersion" INTEGER NOT NULL,

    CONSTRAINT "EmployeeSeparationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSeparationAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "SeparationAuditAction" NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSeparationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeSeparationCase_organizationId_status_createdAt_id_idx" ON "EmployeeSeparationCase"("organizationId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeSeparationCase_organizationId_employeeId_createdAt_idx" ON "EmployeeSeparationCase"("organizationId", "employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeeSeparationCase_organizationId_proposedEffectiveDate_idx" ON "EmployeeSeparationCase"("organizationId", "proposedEffectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSeparationCase_id_organizationId_key" ON "EmployeeSeparationCase"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSeparationCase_organizationId_requestKey_key" ON "EmployeeSeparationCase"("organizationId", "requestKey");

-- CreateIndex
CREATE INDEX "EmployeeClearanceItem_organizationId_caseId_status_idx" ON "EmployeeClearanceItem"("organizationId", "caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeClearanceItem_caseId_requestKey_key" ON "EmployeeClearanceItem"("caseId", "requestKey");

-- CreateIndex
CREATE INDEX "EmployeeSeparationReview_organizationId_caseId_kind_recorde_idx" ON "EmployeeSeparationReview"("organizationId", "caseId", "kind", "recordedAt");

-- CreateIndex
CREATE INDEX "EmployeeSeparationAudit_organizationId_caseId_createdAt_id_idx" ON "EmployeeSeparationAudit"("organizationId", "caseId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeSeparationAudit_organizationId_actorUserId_createdA_idx" ON "EmployeeSeparationAudit"("organizationId", "actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_organizationId_key" ON "User"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_id_organizationId_key" ON "Employee"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "EmployeeSeparationCase" ADD CONSTRAINT "EmployeeSeparationCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationCase" ADD CONSTRAINT "EmployeeSeparationCase_employeeId_organizationId_fkey" FOREIGN KEY ("employeeId", "organizationId") REFERENCES "Employee"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationCase" ADD CONSTRAINT "EmployeeSeparationCase_initiatedById_organizationId_fkey" FOREIGN KEY ("initiatedById", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationCase" ADD CONSTRAINT "EmployeeSeparationCase_cancelledById_organizationId_fkey" FOREIGN KEY ("cancelledById", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationCase" ADD CONSTRAINT "EmployeeSeparationCase_noticeExceptionById_organizationId_fkey" FOREIGN KEY ("noticeExceptionById", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeClearanceItem" ADD CONSTRAINT "EmployeeClearanceItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeClearanceItem" ADD CONSTRAINT "EmployeeClearanceItem_caseId_organizationId_fkey" FOREIGN KEY ("caseId", "organizationId") REFERENCES "EmployeeSeparationCase"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeClearanceItem" ADD CONSTRAINT "EmployeeClearanceItem_reviewedById_organizationId_fkey" FOREIGN KEY ("reviewedById", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationReview" ADD CONSTRAINT "EmployeeSeparationReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationReview" ADD CONSTRAINT "EmployeeSeparationReview_caseId_organizationId_fkey" FOREIGN KEY ("caseId", "organizationId") REFERENCES "EmployeeSeparationCase"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationReview" ADD CONSTRAINT "EmployeeSeparationReview_recordedById_organizationId_fkey" FOREIGN KEY ("recordedById", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationAudit" ADD CONSTRAINT "EmployeeSeparationAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationAudit" ADD CONSTRAINT "EmployeeSeparationAudit_caseId_organizationId_fkey" FOREIGN KEY ("caseId", "organizationId") REFERENCES "EmployeeSeparationCase"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSeparationAudit" ADD CONSTRAINT "EmployeeSeparationAudit_actorUserId_organizationId_fkey" FOREIGN KEY ("actorUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma 6 cannot represent a partial unique index. CANCELLED is the only
-- terminal state in H10.1; READY_FOR_FINAL_REVIEW remains an active case.
CREATE UNIQUE INDEX "EmployeeSeparationCase_one_active_employee"
ON "EmployeeSeparationCase" ("organizationId", "employeeId")
WHERE "status" <> 'CANCELLED';

ALTER TABLE "EmployeeSeparationCase"
  ADD CONSTRAINT "SeparationCase_versions_valid" CHECK ("version" >= 0 AND "versionOfDetails" >= 0),
  ADD CONSTRAINT "SeparationCase_date_order" CHECK (
    ("proposedLastWorkingDay" IS NULL OR "proposedEffectiveDate" IS NULL OR "proposedLastWorkingDay" <= "proposedEffectiveDate") AND
    ("noticeDate" IS NULL OR "proposedEffectiveDate" IS NULL OR "noticeDate" <= "proposedEffectiveDate")
  ),
  ADD CONSTRAINT "SeparationCase_exception_documented" CHECK (
    "noticeCompliance" <> 'EXCEPTION_RECORDED' OR
    ("separationType" = 'RESIGNATION' AND "noticeDate" IS NOT NULL AND "proposedEffectiveDate" IS NOT NULL AND
     "noticeExceptionById" IS NOT NULL AND "noticeExceptionAt" IS NOT NULL AND
     "noticeExceptionReason" IS NOT NULL AND length(btrim("noticeExceptionReason")) > 0)
  ),
  ADD CONSTRAINT "SeparationCase_cancellation_documented" CHECK (
    "status" <> 'CANCELLED' OR
    ("cancelledById" IS NOT NULL AND "cancelledAt" IS NOT NULL AND
     "cancellationReason" IS NOT NULL AND length(btrim("cancellationReason")) > 0)
  );

ALTER TABLE "EmployeeClearanceItem"
  ADD CONSTRAINT "ClearanceItem_verified_decision" CHECK (
    ("status" = 'PENDING' AND "reviewedById" IS NULL AND "reviewedAt" IS NULL) OR
    ("status" <> 'PENDING' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "ClearanceItem_reason_required" CHECK (
    "status" NOT IN ('WAIVED', 'BLOCKED') OR ("remarks" IS NOT NULL AND length(btrim("remarks")) > 0)
  );

ALTER TABLE "EmployeeSeparationReview"
  ADD CONSTRAINT "SeparationReview_evidence_required" CHECK (length(btrim("evidence")) > 0 AND "caseVersion" >= 0);

CREATE FUNCTION "SeparationHistory_prevent_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Separation history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SeparationAudit_immutable"
BEFORE UPDATE OR DELETE ON "EmployeeSeparationAudit"
FOR EACH ROW EXECUTE FUNCTION "SeparationHistory_prevent_mutation"();
CREATE TRIGGER "SeparationAudit_no_truncate"
BEFORE TRUNCATE ON "EmployeeSeparationAudit"
FOR EACH STATEMENT EXECUTE FUNCTION "SeparationHistory_prevent_mutation"();
CREATE TRIGGER "SeparationReview_immutable"
BEFORE UPDATE OR DELETE ON "EmployeeSeparationReview"
FOR EACH ROW EXECUTE FUNCTION "SeparationHistory_prevent_mutation"();
CREATE TRIGGER "SeparationReview_no_truncate"
BEFORE TRUNCATE ON "EmployeeSeparationReview"
FOR EACH STATEMENT EXECUTE FUNCTION "SeparationHistory_prevent_mutation"();

-- Enforce trusted database time even for an accidental explicit timestamp insert.
CREATE FUNCTION "SeparationAudit_server_time"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."createdAt" := clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SeparationAudit_timestamp"
BEFORE INSERT ON "EmployeeSeparationAudit"
FOR EACH ROW EXECUTE FUNCTION "SeparationAudit_server_time"();

