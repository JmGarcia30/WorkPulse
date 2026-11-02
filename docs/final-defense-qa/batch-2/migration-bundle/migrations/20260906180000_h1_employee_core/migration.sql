-- Reconcile additive SAGA Hiring schema that predates its checked-in migration.
-- Every statement is guarded so this migration is safe for both the existing
-- drifted development database and a clean database built from migration history.
DO $$ BEGIN
  CREATE TYPE "EmploymentCategory" AS ENUM ('TEACHING', 'NON_TEACHING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecruitmentDocumentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'NOT_APPLICABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecruitmentDocumentType" AS ENUM ('RESUME_APPLICATION_LETTER', 'TRANSCRIPT_OF_RECORDS', 'DIPLOMA', 'LET_BASIC_EDUCATION', 'PROFESSIONAL_LICENSE', 'PREVIOUS_EMPLOYMENT_CERT', 'RECOMMENDATION_LETTER_1', 'RECOMMENDATION_LETTER_2', 'RECOMMENDATION_LETTER_3', 'NBI_CLEARANCE', 'MARRIAGE_CONTRACT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "AssessmentType" ADD VALUE IF NOT EXISTS 'WRITTEN_EXAMINATION';
ALTER TYPE "InterviewType" ADD VALUE IF NOT EXISTS 'TEACHING_DEMONSTRATION';
ALTER TYPE "InterviewType" ADD VALUE IF NOT EXISTS 'HEAD_OF_DEPARTMENT';
ALTER TYPE "InterviewType" ADD VALUE IF NOT EXISTS 'PRESIDENT_FINAL';

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "category" "EmploymentCategory" NOT NULL DEFAULT 'NON_TEACHING';
CREATE INDEX IF NOT EXISTS "Job_category_idx" ON "Job"("category");

ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "contractExecutedAt" TIMESTAMP(3);
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "contractSignedByEmployee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "contractSignedByPresident" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "probationPeriodMonths" INTEGER;
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "probationaryTerms" TEXT;

CREATE TABLE IF NOT EXISTS "RecruitmentDocument" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "type" "RecruitmentDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "status" "RecruitmentDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isConditional" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "fileName" TEXT,
  "fileType" TEXT,
  "fileSize" INTEGER,
  "storageKey" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RecruitmentDocument_applicationId_type_key" ON "RecruitmentDocument"("applicationId", "type");
CREATE INDEX IF NOT EXISTS "RecruitmentDocument_applicationId_idx" ON "RecruitmentDocument"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentDocument_status_idx" ON "RecruitmentDocument"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentDocument_verifiedById_idx" ON "RecruitmentDocument"("verifiedById");
DO $$ BEGIN
  ALTER TABLE "RecruitmentDocument" ADD CONSTRAINT "RecruitmentDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "RecruitmentDocument" ADD CONSTRAINT "RecruitmentDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- H1 Employee Core.
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SEPARATED');
CREATE TYPE "EmploymentStatus" AS ENUM ('PROBATIONARY', 'REGULAR');
CREATE TYPE "ProbationStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "ProbationDecision" AS ENUM ('PENDING', 'REGULARIZED', 'RENEWED', 'NOT_RENEWED');

ALTER TABLE "Organization" ADD COLUMN "employeeNumberPrefix" TEXT;

CREATE TABLE "EmployeeNumberSequence" (
  "organizationId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeNumberSequence_pkey" PRIMARY KEY ("organizationId", "year")
);

CREATE TABLE "Employee" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceApplicationId" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "employeeNumber" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "employeeStatus" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmploymentRecord" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "jobId" TEXT,
  "acceptedOfferId" TEXT,
  "jobTitle" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "employmentCategory" "EmploymentCategory" NOT NULL,
  "employmentType" TEXT NOT NULL,
  "hireDate" TIMESTAMP(3) NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "salary" DECIMAL(12,2) NOT NULL,
  "payFrequency" "PayFrequency" NOT NULL,
  "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'PROBATIONARY',
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmploymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProbationRecord" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employmentRecordId" TEXT NOT NULL,
  "category" "EmploymentCategory" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "expectedEndAt" TIMESTAMP(3) NOT NULL,
  "probationStatus" "ProbationStatus" NOT NULL DEFAULT 'ACTIVE',
  "renewalCount" INTEGER NOT NULL DEFAULT 0,
  "maxRenewals" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "decision" "ProbationDecision" NOT NULL DEFAULT 'PENDING',
  "decisionAt" TIMESTAMP(3),
  "decisionById" TEXT,
  "policySnapshot" TEXT NOT NULL,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProbationRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeStatusHistory" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "fromStatus" "EmployeeStatus",
  "toStatus" "EmployeeStatus" NOT NULL,
  "changedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Employee_sourceApplicationId_key" ON "Employee"("sourceApplicationId");
CREATE INDEX "Employee_organizationId_employeeStatus_idx" ON "Employee"("organizationId", "employeeStatus");
CREATE INDEX "Employee_applicantId_idx" ON "Employee"("applicantId");
CREATE UNIQUE INDEX "Employee_organizationId_employeeNumber_key" ON "Employee"("organizationId", "employeeNumber");
CREATE UNIQUE INDEX "Employee_organizationId_applicantId_key" ON "Employee"("organizationId", "applicantId");
CREATE UNIQUE INDEX "EmploymentRecord_acceptedOfferId_key" ON "EmploymentRecord"("acceptedOfferId");
CREATE INDEX "EmploymentRecord_employeeId_idx" ON "EmploymentRecord"("employeeId");
CREATE INDEX "EmploymentRecord_jobId_idx" ON "EmploymentRecord"("jobId");
CREATE INDEX "EmploymentRecord_employmentStatus_idx" ON "EmploymentRecord"("employmentStatus");
CREATE INDEX "EmploymentRecord_effectiveFrom_effectiveTo_idx" ON "EmploymentRecord"("effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "EmploymentRecord_one_current_per_employee_key" ON "EmploymentRecord"("employeeId") WHERE "effectiveTo" IS NULL;
CREATE UNIQUE INDEX "ProbationRecord_employmentRecordId_key" ON "ProbationRecord"("employmentRecordId");
CREATE INDEX "ProbationRecord_employeeId_idx" ON "ProbationRecord"("employeeId");
CREATE INDEX "ProbationRecord_probationStatus_expectedEndAt_idx" ON "ProbationRecord"("probationStatus", "expectedEndAt");
CREATE INDEX "ProbationRecord_decisionById_idx" ON "ProbationRecord"("decisionById");
CREATE INDEX "EmployeeStatusHistory_employeeId_createdAt_idx" ON "EmployeeStatusHistory"("employeeId", "createdAt");
CREATE INDEX "EmployeeStatusHistory_changedById_idx" ON "EmployeeStatusHistory"("changedById");

ALTER TABLE "EmployeeNumberSequence" ADD CONSTRAINT "EmployeeNumberSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_sourceApplicationId_fkey" FOREIGN KEY ("sourceApplicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmploymentRecord" ADD CONSTRAINT "EmploymentRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmploymentRecord" ADD CONSTRAINT "EmploymentRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmploymentRecord" ADD CONSTRAINT "EmploymentRecord_acceptedOfferId_fkey" FOREIGN KEY ("acceptedOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmploymentRecord" ADD CONSTRAINT "EmploymentRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProbationRecord" ADD CONSTRAINT "ProbationRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProbationRecord" ADD CONSTRAINT "ProbationRecord_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "EmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProbationRecord" ADD CONSTRAINT "ProbationRecord_decisionById_fkey" FOREIGN KEY ("decisionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
