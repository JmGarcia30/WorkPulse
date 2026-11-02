CREATE TYPE "AttendanceDisposition" AS ENUM ('NORMAL', 'APPROVED_LEAVE');
CREATE TYPE "LeaveCountingMode" AS ENUM ('SCHEDULED_WORK_DAYS', 'CALENDAR_DAYS');
CREATE TYPE "LeaveOccurrenceScope" AS ENUM ('CYCLE', 'LIFETIME');
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED');
CREATE TYPE "LeaveLedgerEntryType" AS ENUM ('GRANT', 'ACCRUAL', 'ADJUSTMENT', 'APPROVED_LEAVE', 'REVERSAL', 'CARRYOVER', 'EXPIRY');
CREATE TYPE "LeaveRequestAuditAction" AS ENUM ('SUBMITTED', 'DOCUMENT_ADDED', 'DOCUMENT_REMOVED', 'ELIGIBILITY_VERIFIED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED', 'ATTENDANCE_SYNC_SUCCEEDED', 'ATTENDANCE_SYNC_FAILED', 'ATTENDANCE_SYNC_RETRIED', 'NOTIFICATION_SENT', 'NOTIFICATION_FAILED');
CREATE TYPE "LeaveAttendanceSyncStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "LeaveType" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "isPaid" BOOLEAN NOT NULL DEFAULT true,
  "countingMode" "LeaveCountingMode" NOT NULL, "balanceTracked" BOOLEAN NOT NULL DEFAULT false,
  "defaultGrantUnits" DECIMAL(10,4), "requiredEmploymentStatus" "EmploymentStatus", "minimumServiceMonths" INTEGER,
  "maximumRequestUnits" DECIMAL(10,4), "maximumApprovedOccurrences" INTEGER, "occurrenceLimitScope" "LeaveOccurrenceScope",
  "allowsRetrospectiveFiling" BOOLEAN NOT NULL DEFAULT false, "requiresEligibilityVerification" BOOLEAN NOT NULL DEFAULT false,
  "requestCategoryOptions" JSONB NOT NULL DEFAULT '[]', "attestationRules" JSONB NOT NULL DEFAULT '[]', "documentRules" JSONB NOT NULL DEFAULT '[]',
  "policyReference" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "LeaveCycle" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "leaveTypeId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "startDate" DATE NOT NULL, "endDate" DATE NOT NULL, "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "LeaveRequest" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "leaveTypeId" TEXT NOT NULL, "leaveCycleId" TEXT,
  "requestedStartDate" DATE NOT NULL, "requestedEndDate" DATE NOT NULL, "requestedUnits" DECIMAL(10,4) NOT NULL,
  "requestCategoryCode" TEXT, "reason" TEXT NOT NULL, "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  "eligibilityAttestation" JSONB, "policySnapshot" JSONB NOT NULL, "leaveTypeCodeSnapshot" TEXT NOT NULL,
  "leaveTypeNameSnapshot" TEXT NOT NULL, "leavePaidSnapshot" BOOLEAN NOT NULL, "countingModeSnapshot" "LeaveCountingMode" NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3), "reviewedById" TEXT,
  "reviewerRemarks" TEXT, "eligibilityVerifiedAt" TIMESTAMP(3), "eligibilityVerifiedById" TEXT, "eligibilityVerification" JSONB,
  "attendanceSyncStatus" "LeaveAttendanceSyncStatus" NOT NULL DEFAULT 'NOT_REQUIRED', "attendanceSyncedAt" TIMESTAMP(3), "attendanceSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "LeaveRequestDay" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "leaveRequestId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "attendanceDate" DATE NOT NULL, "employmentRecordId" TEXT NOT NULL, "scheduleAssignmentId" TEXT,
  "isScheduledWorkday" BOOLEAN NOT NULL, "scheduledStartSecond" INTEGER, "scheduledEndSecond" INTEGER,
  "scheduledUnpaidBreakSeconds" INTEGER NOT NULL DEFAULT 0, "scheduledNetSeconds" INTEGER,
  "chargeUnits" DECIMAL(10,4) NOT NULL, "leaveSeconds" INTEGER, "employmentSnapshot" JSONB NOT NULL, "scheduleSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "LeaveLedgerEntry" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "leaveTypeId" TEXT NOT NULL,
  "leaveCycleId" TEXT, "leaveRequestId" TEXT, "entryType" "LeaveLedgerEntryType" NOT NULL, "amountUnits" DECIMAL(10,4) NOT NULL,
  "reason" TEXT NOT NULL, "actorUserId" TEXT NOT NULL, "reversesEntryId" TEXT, "grantSource" TEXT,
  "beforeBalance" DECIMAL(10,4), "afterBalance" DECIMAL(10,4), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "LeaveRequestAudit" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "leaveRequestId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "action" "LeaveRequestAuditAction" NOT NULL, "details" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "LeaveDocument" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "leaveRequestId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "kindCode" TEXT NOT NULL, "fileName" TEXT NOT NULL, "fileType" TEXT NOT NULL, "fileSize" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL, "uploadedById" TEXT NOT NULL, "removedAt" TIMESTAMP(3), "removedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "DailyAttendanceRecord" ADD COLUMN "approvedLeaveRequestDayId" TEXT,
  ADD COLUMN "approvedLeaveSeconds" INTEGER, ADD COLUMN "disposition" "AttendanceDisposition" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "hasLeaveAttendanceConflict" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "leavePaidSnapshot" BOOLEAN,
  ADD COLUMN "leaveTypeCodeSnapshot" TEXT, ADD COLUMN "leaveTypeNameSnapshot" TEXT;

CREATE UNIQUE INDEX "LeaveType_organizationId_code_key" ON "LeaveType"("organizationId", "code");
CREATE INDEX "LeaveType_organizationId_isActive_idx" ON "LeaveType"("organizationId", "isActive");
CREATE UNIQUE INDEX "LeaveCycle_organizationId_leaveTypeId_code_key" ON "LeaveCycle"("organizationId", "leaveTypeId", "code");
CREATE INDEX "LeaveCycle_organizationId_leaveTypeId_startDate_endDate_idx" ON "LeaveCycle"("organizationId", "leaveTypeId", "startDate", "endDate");
CREATE INDEX "LeaveRequest_organizationId_status_submittedAt_idx" ON "LeaveRequest"("organizationId", "status", "submittedAt");
CREATE INDEX "LeaveRequest_organizationId_employeeId_requestedStartDate_idx" ON "LeaveRequest"("organizationId", "employeeId", "requestedStartDate");
CREATE INDEX "LeaveRequest_leaveTypeId_leaveCycleId_idx" ON "LeaveRequest"("leaveTypeId", "leaveCycleId");
CREATE UNIQUE INDEX "LeaveRequestDay_leaveRequestId_attendanceDate_key" ON "LeaveRequestDay"("leaveRequestId", "attendanceDate");
CREATE INDEX "LeaveRequestDay_organizationId_employeeId_attendanceDate_idx" ON "LeaveRequestDay"("organizationId", "employeeId", "attendanceDate");
CREATE UNIQUE INDEX "LeaveLedgerEntry_reversesEntryId_key" ON "LeaveLedgerEntry"("reversesEntryId");
CREATE UNIQUE INDEX "LeaveLedgerEntry_employeeId_leaveTypeId_leaveCycleId_grantS_key" ON "LeaveLedgerEntry"("employeeId", "leaveTypeId", "leaveCycleId", "grantSource");
CREATE INDEX "LeaveLedgerEntry_organizationId_employeeId_leaveTypeId_leav_idx" ON "LeaveLedgerEntry"("organizationId", "employeeId", "leaveTypeId", "leaveCycleId");
CREATE INDEX "LeaveLedgerEntry_leaveRequestId_entryType_idx" ON "LeaveLedgerEntry"("leaveRequestId", "entryType");
CREATE INDEX "LeaveRequestAudit_organizationId_createdAt_idx" ON "LeaveRequestAudit"("organizationId", "createdAt");
CREATE INDEX "LeaveRequestAudit_leaveRequestId_createdAt_idx" ON "LeaveRequestAudit"("leaveRequestId", "createdAt");
CREATE UNIQUE INDEX "LeaveDocument_storageKey_key" ON "LeaveDocument"("storageKey");
CREATE INDEX "LeaveDocument_organizationId_leaveRequestId_idx" ON "LeaveDocument"("organizationId", "leaveRequestId");
CREATE INDEX "LeaveDocument_employeeId_idx" ON "LeaveDocument"("employeeId");
CREATE UNIQUE INDEX "DailyAttendanceRecord_approvedLeaveRequestDayId_key" ON "DailyAttendanceRecord"("approvedLeaveRequestDayId");
CREATE INDEX "DailyAttendanceRecord_organizationId_attendanceDate_disposi_idx" ON "DailyAttendanceRecord"("organizationId", "attendanceDate", "disposition");

ALTER TABLE "LeaveType" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveCycle" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveCycle" ADD FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD FOREIGN KEY ("leaveCycleId") REFERENCES "LeaveCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD FOREIGN KEY ("eligibilityVerifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestDay" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestDay" ADD FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestDay" ADD FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestDay" ADD FOREIGN KEY ("employmentRecordId") REFERENCES "EmploymentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestDay" ADD FOREIGN KEY ("scheduleAssignmentId") REFERENCES "EmployeeScheduleAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveLedgerEntry" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveLedgerEntry" ADD FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveLedgerEntry" ADD FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveLedgerEntry" ADD FOREIGN KEY ("leaveCycleId") REFERENCES "LeaveCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveLedgerEntry" ADD FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveLedgerEntry" ADD FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveLedgerEntry" ADD FOREIGN KEY ("reversesEntryId") REFERENCES "LeaveLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestAudit" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestAudit" ADD FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveRequestAudit" ADD FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveDocument" ADD FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveDocument" ADD FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveDocument" ADD FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveDocument" ADD FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyAttendanceRecord" ADD FOREIGN KEY ("approvedLeaveRequestDayId") REFERENCES "LeaveRequestDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeaveCycle" ADD CONSTRAINT "LeaveCycle_date_check" CHECK ("endDate" >= "startDate");
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_units_check" CHECK (("defaultGrantUnits" IS NULL OR "defaultGrantUnits" > 0) AND ("maximumRequestUnits" IS NULL OR "maximumRequestUnits" > 0) AND ("minimumServiceMonths" IS NULL OR "minimumServiceMonths" >= 0));
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_range_check" CHECK ("requestedEndDate" >= "requestedStartDate" AND "requestedUnits" > 0);
ALTER TABLE "LeaveRequestDay" ADD CONSTRAINT "LeaveRequestDay_units_check" CHECK ("chargeUnits" IN (0, 1) AND ("leaveSeconds" IS NULL OR "leaveSeconds" >= 0));
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_amount_check" CHECK ("amountUnits" <> 0 AND length(trim("reason")) > 0);

ALTER TABLE "LeaveCycle" ADD CONSTRAINT "LeaveCycle_no_overlap" EXCLUDE USING gist (
  "organizationId" WITH =, "leaveTypeId" WITH =, daterange("startDate", "endDate" + 1, '[)') WITH &&
);
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_no_active_overlap" EXCLUDE USING gist (
  "organizationId" WITH =, "employeeId" WITH =, daterange("requestedStartDate", "requestedEndDate" + 1, '[)') WITH &&
) WHERE ("status" IN ('PENDING', 'APPROVED'));

CREATE OR REPLACE FUNCTION "h5_reject_immutable_change"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION '% is immutable', TG_TABLE_NAME; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "LeaveLedgerEntry_immutable" BEFORE UPDATE OR DELETE ON "LeaveLedgerEntry" FOR EACH ROW EXECUTE FUNCTION "h5_reject_immutable_change"();
CREATE TRIGGER "LeaveRequestAudit_immutable" BEFORE UPDATE OR DELETE ON "LeaveRequestAudit" FOR EACH ROW EXECUTE FUNCTION "h5_reject_immutable_change"();
CREATE TRIGGER "LeaveRequestDay_immutable" BEFORE UPDATE OR DELETE ON "LeaveRequestDay" FOR EACH ROW EXECUTE FUNCTION "h5_reject_immutable_change"();

CREATE OR REPLACE FUNCTION "h5_assert_tenant_consistency"() RETURNS trigger AS $$
DECLARE related_org TEXT; related_type TEXT; related_employee TEXT;
BEGIN
  IF TG_TABLE_NAME = 'LeaveCycle' THEN
    SELECT "organizationId" INTO related_org FROM "LeaveType" WHERE "id" = NEW."leaveTypeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave cycle'; END IF;
  ELSIF TG_TABLE_NAME = 'LeaveRequest' THEN
    SELECT "organizationId" INTO related_org FROM "Employee" WHERE "id" = NEW."employeeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave employee'; END IF;
    SELECT "organizationId" INTO related_org FROM "LeaveType" WHERE "id" = NEW."leaveTypeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave type'; END IF;
    IF NEW."leaveCycleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "LeaveCycle" WHERE "id"=NEW."leaveCycleId" AND "organizationId"=NEW."organizationId" AND "leaveTypeId"=NEW."leaveTypeId") THEN RAISE EXCEPTION 'Invalid leave cycle'; END IF;
  ELSIF TG_TABLE_NAME = 'LeaveRequestDay' THEN
    SELECT "organizationId", "employeeId" INTO related_org, related_employee FROM "LeaveRequest" WHERE "id"=NEW."leaveRequestId";
    IF related_org IS DISTINCT FROM NEW."organizationId" OR related_employee IS DISTINCT FROM NEW."employeeId" THEN RAISE EXCEPTION 'Invalid leave request day ownership'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "EmploymentRecord" WHERE "id"=NEW."employmentRecordId" AND "employeeId"=NEW."employeeId") THEN RAISE EXCEPTION 'Invalid leave employment record'; END IF;
  ELSIF TG_TABLE_NAME = 'LeaveLedgerEntry' THEN
    SELECT "organizationId" INTO related_org FROM "Employee" WHERE "id"=NEW."employeeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave ledger'; END IF;
    SELECT "organizationId" INTO related_org FROM "LeaveType" WHERE "id"=NEW."leaveTypeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave ledger type'; END IF;
  ELSIF TG_TABLE_NAME IN ('LeaveRequestAudit','LeaveDocument') THEN
    SELECT "organizationId", "employeeId" INTO related_org, related_employee FROM "LeaveRequest" WHERE "id"=NEW."leaveRequestId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave child'; END IF;
    IF TG_TABLE_NAME='LeaveDocument' AND related_employee IS DISTINCT FROM NEW."employeeId" THEN RAISE EXCEPTION 'Invalid leave document employee'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "LeaveCycle_tenant_check" BEFORE INSERT OR UPDATE ON "LeaveCycle" FOR EACH ROW EXECUTE FUNCTION "h5_assert_tenant_consistency"();
CREATE TRIGGER "LeaveRequest_tenant_check" BEFORE INSERT OR UPDATE ON "LeaveRequest" FOR EACH ROW EXECUTE FUNCTION "h5_assert_tenant_consistency"();
CREATE TRIGGER "LeaveRequestDay_tenant_check" BEFORE INSERT ON "LeaveRequestDay" FOR EACH ROW EXECUTE FUNCTION "h5_assert_tenant_consistency"();
CREATE TRIGGER "LeaveLedgerEntry_tenant_check" BEFORE INSERT ON "LeaveLedgerEntry" FOR EACH ROW EXECUTE FUNCTION "h5_assert_tenant_consistency"();
CREATE TRIGGER "LeaveRequestAudit_tenant_check" BEFORE INSERT ON "LeaveRequestAudit" FOR EACH ROW EXECUTE FUNCTION "h5_assert_tenant_consistency"();
CREATE TRIGGER "LeaveDocument_tenant_check" BEFORE INSERT OR UPDATE ON "LeaveDocument" FOR EACH ROW EXECUTE FUNCTION "h5_assert_tenant_consistency"();
