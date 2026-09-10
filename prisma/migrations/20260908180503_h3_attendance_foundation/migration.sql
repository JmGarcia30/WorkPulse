-- CreateEnum
CREATE TYPE "AttendanceDirection" AS ENUM ('TIME_IN', 'TIME_OUT');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'IMPORT', 'RFID');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('OPEN', 'PRESENT', 'ABSENT', 'INCOMPLETE', 'REST_DAY', 'NO_SCHEDULE');

-- CreateEnum
CREATE TYPE "AttendanceDerivation" AS ENUM ('RAW_EVENTS', 'CORRECTED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "WorkScheduleGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkScheduleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleVersion" (
    "id" TEXT NOT NULL,
    "scheduleGroupId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "lateGraceSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleDay" (
    "id" TEXT NOT NULL,
    "scheduleVersionId" TEXT NOT NULL,
    "isoWeekday" INTEGER NOT NULL,
    "isWorkday" BOOLEAN NOT NULL DEFAULT true,
    "expectedStartSecond" INTEGER,
    "expectedEndSecond" INTEGER,

    CONSTRAINT "WorkScheduleDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleBreak" (
    "id" TEXT NOT NULL,
    "scheduleDayId" TEXT NOT NULL,
    "startSecond" INTEGER NOT NULL,
    "endSecond" INTEGER NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorkScheduleBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeScheduleAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "scheduleVersionId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeScheduleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "direction" "AttendanceDirection",
    "source" "AttendanceSource" NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAttendanceRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employmentRecordId" TEXT NOT NULL,
    "scheduleAssignmentId" TEXT,
    "attendanceDate" DATE NOT NULL,
    "timeZoneSnapshot" TEXT NOT NULL,
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "lateGraceSeconds" INTEGER NOT NULL DEFAULT 0,
    "scheduledUnpaidBreakSeconds" INTEGER NOT NULL DEFAULT 0,
    "firstTimeIn" TIMESTAMP(3),
    "lastTimeOut" TIMESTAMP(3),
    "workedSeconds" INTEGER,
    "lateSeconds" INTEGER,
    "undertimeSeconds" INTEGER,
    "overtimeSeconds" INTEGER,
    "attendanceStatus" "AttendanceStatus" NOT NULL,
    "derivation" "AttendanceDerivation" NOT NULL DEFAULT 'RAW_EVENTS',
    "hasUnclassifiedEvents" BOOLEAN NOT NULL DEFAULT false,
    "hasOutBeforeIn" BOOLEAN NOT NULL DEFAULT false,
    "correctionVersion" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dailyAttendanceRecordId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "correctedTimeIn" TIMESTAMP(3),
    "correctedTimeOut" TIMESTAMP(3),
    "correctedStatus" "AttendanceStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "previousState" JSONB NOT NULL,
    "correctedState" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkScheduleGroup_organizationId_isArchived_idx" ON "WorkScheduleGroup"("organizationId", "isArchived");

-- CreateIndex
CREATE INDEX "WorkScheduleGroup_createdById_idx" ON "WorkScheduleGroup"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleGroup_organizationId_scheduleKey_key" ON "WorkScheduleGroup"("organizationId", "scheduleKey");

-- CreateIndex
CREATE INDEX "WorkScheduleVersion_createdById_idx" ON "WorkScheduleVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleVersion_scheduleGroupId_version_key" ON "WorkScheduleVersion"("scheduleGroupId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleDay_scheduleVersionId_isoWeekday_key" ON "WorkScheduleDay"("scheduleVersionId", "isoWeekday");

-- CreateIndex
CREATE INDEX "WorkScheduleBreak_scheduleDayId_idx" ON "WorkScheduleBreak"("scheduleDayId");

-- CreateIndex
CREATE INDEX "EmployeeScheduleAssignment_organizationId_employeeId_effect_idx" ON "EmployeeScheduleAssignment"("organizationId", "employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeScheduleAssignment_scheduleVersionId_idx" ON "EmployeeScheduleAssignment"("scheduleVersionId");

-- CreateIndex
CREATE INDEX "EmployeeScheduleAssignment_createdById_idx" ON "EmployeeScheduleAssignment"("createdById");

-- CreateIndex
CREATE INDEX "AttendanceEvent_organizationId_employeeId_occurredAt_idx" ON "AttendanceEvent"("organizationId", "employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_createdById_idx" ON "AttendanceEvent"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_organizationId_source_sourceReference_key" ON "AttendanceEvent"("organizationId", "source", "sourceReference");

-- CreateIndex
CREATE INDEX "DailyAttendanceRecord_organizationId_attendanceDate_attenda_idx" ON "DailyAttendanceRecord"("organizationId", "attendanceDate", "attendanceStatus");

-- CreateIndex
CREATE INDEX "DailyAttendanceRecord_employeeId_attendanceDate_idx" ON "DailyAttendanceRecord"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "DailyAttendanceRecord_employmentRecordId_idx" ON "DailyAttendanceRecord"("employmentRecordId");

-- CreateIndex
CREATE INDEX "DailyAttendanceRecord_scheduleAssignmentId_idx" ON "DailyAttendanceRecord"("scheduleAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendanceRecord_organizationId_employeeId_attendanceD_key" ON "DailyAttendanceRecord"("organizationId", "employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_organizationId_createdAt_idx" ON "AttendanceCorrection"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_createdById_idx" ON "AttendanceCorrection"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCorrection_dailyAttendanceRecordId_revision_key" ON "AttendanceCorrection"("dailyAttendanceRecordId", "revision");

-- AddForeignKey
ALTER TABLE "WorkScheduleGroup" ADD CONSTRAINT "WorkScheduleGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleGroup" ADD CONSTRAINT "WorkScheduleGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleVersion" ADD CONSTRAINT "WorkScheduleVersion_scheduleGroupId_fkey" FOREIGN KEY ("scheduleGroupId") REFERENCES "WorkScheduleGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleVersion" ADD CONSTRAINT "WorkScheduleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleDay" ADD CONSTRAINT "WorkScheduleDay_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "WorkScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleBreak" ADD CONSTRAINT "WorkScheduleBreak_scheduleDayId_fkey" FOREIGN KEY ("scheduleDayId") REFERENCES "WorkScheduleDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeScheduleAssignment" ADD CONSTRAINT "EmployeeScheduleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeScheduleAssignment" ADD CONSTRAINT "EmployeeScheduleAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeScheduleAssignment" ADD CONSTRAINT "EmployeeScheduleAssignment_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "WorkScheduleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeScheduleAssignment" ADD CONSTRAINT "EmployeeScheduleAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendanceRecord" ADD CONSTRAINT "DailyAttendanceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendanceRecord" ADD CONSTRAINT "DailyAttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendanceRecord" ADD CONSTRAINT "DailyAttendanceRecord_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "EmploymentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendanceRecord" ADD CONSTRAINT "DailyAttendanceRecord_scheduleAssignmentId_fkey" FOREIGN KEY ("scheduleAssignmentId") REFERENCES "EmployeeScheduleAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_dailyAttendanceRecordId_fkey" FOREIGN KEY ("dailyAttendanceRecordId") REFERENCES "DailyAttendanceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- H3 invariants that Prisma cannot express.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "WorkScheduleVersion"
  ADD CONSTRAINT "WorkScheduleVersion_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "WorkScheduleVersion_grace_check" CHECK ("lateGraceSeconds" >= 0);

ALTER TABLE "WorkScheduleDay"
  ADD CONSTRAINT "WorkScheduleDay_weekday_check" CHECK ("isoWeekday" BETWEEN 1 AND 7),
  ADD CONSTRAINT "WorkScheduleDay_times_check" CHECK (
    ("isWorkday" = false AND "expectedStartSecond" IS NULL AND "expectedEndSecond" IS NULL)
    OR
    ("isWorkday" = true AND "expectedStartSecond" BETWEEN 0 AND 86399
      AND "expectedEndSecond" BETWEEN 1 AND 86400
      AND "expectedEndSecond" > "expectedStartSecond")
  );

ALTER TABLE "WorkScheduleBreak"
  ADD CONSTRAINT "WorkScheduleBreak_range_check" CHECK (
    "startSecond" BETWEEN 0 AND 86399
    AND "endSecond" BETWEEN 1 AND 86400
    AND "endSecond" > "startSecond"
  ),
  ADD CONSTRAINT "WorkScheduleBreak_no_overlap" EXCLUDE USING gist (
    "scheduleDayId" WITH =,
    int4range("startSecond", "endSecond", '[)') WITH &&
  );

ALTER TABLE "EmployeeScheduleAssignment"
  ADD CONSTRAINT "EmployeeScheduleAssignment_period_check" CHECK (
    "effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"
  ),
  ADD CONSTRAINT "EmployeeScheduleAssignment_no_overlap" EXCLUDE USING gist (
    "employeeId" WITH =,
    daterange("effectiveFrom", "effectiveTo", '[)') WITH &&
  );

ALTER TABLE "AttendanceEvent"
  ADD CONSTRAINT "AttendanceEvent_source_reference_check" CHECK (length(trim("sourceReference")) > 0),
  ADD CONSTRAINT "AttendanceEvent_metadata_size_check" CHECK (
    "metadata" IS NULL OR octet_length("metadata"::text) <= 4096
  ),
  ADD CONSTRAINT "AttendanceEvent_manual_check" CHECK (
    "source" <> 'MANUAL' OR ("createdById" IS NOT NULL AND "direction" IS NOT NULL)
  );

ALTER TABLE "DailyAttendanceRecord"
  ADD CONSTRAINT "DailyAttendanceRecord_nonnegative_check" CHECK (
    "lateGraceSeconds" >= 0
    AND "scheduledUnpaidBreakSeconds" >= 0
    AND ("workedSeconds" IS NULL OR "workedSeconds" >= 0)
    AND ("lateSeconds" IS NULL OR "lateSeconds" >= 0)
    AND ("undertimeSeconds" IS NULL OR "undertimeSeconds" >= 0)
    AND ("overtimeSeconds" IS NULL OR "overtimeSeconds" >= 0)
    AND "correctionVersion" >= 0
  ),
  ADD CONSTRAINT "DailyAttendanceRecord_schedule_range_check" CHECK (
    ("scheduledStartAt" IS NULL AND "scheduledEndAt" IS NULL)
    OR ("scheduledStartAt" IS NOT NULL AND "scheduledEndAt" > "scheduledStartAt")
  ),
  ADD CONSTRAINT "DailyAttendanceRecord_attendance_range_check" CHECK (
    "firstTimeIn" IS NULL OR "lastTimeOut" IS NULL OR "lastTimeOut" > "firstTimeIn"
  );

ALTER TABLE "AttendanceCorrection"
  ADD CONSTRAINT "AttendanceCorrection_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "AttendanceCorrection_reason_check" CHECK (
    length(trim("reason")) > 0 AND length("reason") <= 2000
  ),
  ADD CONSTRAINT "AttendanceCorrection_time_range_check" CHECK (
    "correctedTimeIn" IS NULL OR "correctedTimeOut" IS NULL OR "correctedTimeOut" > "correctedTimeIn"
  );

CREATE OR REPLACE FUNCTION "h3_assert_tenant_consistency"() RETURNS trigger AS $$
DECLARE
  related_org TEXT;
BEGIN
  IF TG_TABLE_NAME = 'EmployeeScheduleAssignment' THEN
    SELECT "organizationId" INTO related_org FROM "Employee" WHERE "id" = NEW."employeeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant employee schedule assignment'; END IF;
    SELECT g."organizationId" INTO related_org FROM "WorkScheduleVersion" v JOIN "WorkScheduleGroup" g ON g."id" = v."scheduleGroupId" WHERE v."id" = NEW."scheduleVersionId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant schedule version assignment'; END IF;
  ELSIF TG_TABLE_NAME = 'AttendanceEvent' THEN
    SELECT "organizationId" INTO related_org FROM "Employee" WHERE "id" = NEW."employeeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant attendance event'; END IF;
  ELSIF TG_TABLE_NAME = 'DailyAttendanceRecord' THEN
    SELECT "organizationId" INTO related_org FROM "Employee" WHERE "id" = NEW."employeeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant daily attendance record'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "EmploymentRecord" WHERE "id" = NEW."employmentRecordId" AND "employeeId" = NEW."employeeId") THEN RAISE EXCEPTION 'Attendance employment record mismatch'; END IF;
    IF NEW."scheduleAssignmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "EmployeeScheduleAssignment" WHERE "id" = NEW."scheduleAssignmentId" AND "employeeId" = NEW."employeeId" AND "organizationId" = NEW."organizationId") THEN RAISE EXCEPTION 'Attendance schedule assignment mismatch'; END IF;
  ELSIF TG_TABLE_NAME = 'AttendanceCorrection' THEN
    SELECT "organizationId" INTO related_org FROM "DailyAttendanceRecord" WHERE "id" = NEW."dailyAttendanceRecordId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant attendance correction'; END IF;
  END IF;
  IF TG_TABLE_NAME <> 'DailyAttendanceRecord' THEN
    IF NEW."createdById" IS NOT NULL THEN
      SELECT "organizationId" INTO related_org FROM "User" WHERE "id" = NEW."createdById";
      IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant attendance actor'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EmployeeScheduleAssignment_tenant_check" BEFORE INSERT OR UPDATE ON "EmployeeScheduleAssignment" FOR EACH ROW EXECUTE FUNCTION "h3_assert_tenant_consistency"();
CREATE TRIGGER "AttendanceEvent_tenant_check" BEFORE INSERT ON "AttendanceEvent" FOR EACH ROW EXECUTE FUNCTION "h3_assert_tenant_consistency"();
CREATE TRIGGER "DailyAttendanceRecord_tenant_check" BEFORE INSERT OR UPDATE ON "DailyAttendanceRecord" FOR EACH ROW EXECUTE FUNCTION "h3_assert_tenant_consistency"();
CREATE TRIGGER "AttendanceCorrection_tenant_check" BEFORE INSERT ON "AttendanceCorrection" FOR EACH ROW EXECUTE FUNCTION "h3_assert_tenant_consistency"();

CREATE OR REPLACE FUNCTION "h3_reject_immutable_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AttendanceEvent_immutable" BEFORE UPDATE OR DELETE ON "AttendanceEvent" FOR EACH ROW EXECUTE FUNCTION "h3_reject_immutable_change"();
CREATE TRIGGER "AttendanceCorrection_immutable" BEFORE UPDATE OR DELETE ON "AttendanceCorrection" FOR EACH ROW EXECUTE FUNCTION "h3_reject_immutable_change"();
CREATE TRIGGER "WorkScheduleVersion_immutable" BEFORE UPDATE OR DELETE ON "WorkScheduleVersion" FOR EACH ROW EXECUTE FUNCTION "h3_reject_immutable_change"();
CREATE TRIGGER "WorkScheduleDay_immutable" BEFORE UPDATE OR DELETE ON "WorkScheduleDay" FOR EACH ROW EXECUTE FUNCTION "h3_reject_immutable_change"();
CREATE TRIGGER "WorkScheduleBreak_immutable" BEFORE UPDATE OR DELETE ON "WorkScheduleBreak" FOR EACH ROW EXECUTE FUNCTION "h3_reject_immutable_change"();
