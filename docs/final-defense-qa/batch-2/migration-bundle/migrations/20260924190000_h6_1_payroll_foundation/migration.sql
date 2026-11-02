CREATE TYPE "CompensationType" AS ENUM ('MONTHLY', 'DAILY');
CREATE TYPE "CompensationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'REVIEW', 'FINALIZED');
CREATE TYPE "PayrollEntryStatus" AS ENUM ('DRAFT', 'REVIEW', 'FINALIZED');

CREATE TABLE "EmployeeCompensation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "compensationType" "CompensationType" NOT NULL,
  "baseRate" DECIMAL(12,2) NOT NULL,
  "payFrequency" "PayFrequency" NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'PHP',
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "status" "CompensationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeCompensation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeCompensation_date_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"),
  CONSTRAINT "EmployeeCompensation_positive_rate_check" CHECK ("baseRate" > 0)
);

CREATE TABLE "PayrollPeriod" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "payDate" DATE NOT NULL,
  "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollPeriod_date_range_check" CHECK ("periodEnd" >= "periodStart"),
  CONSTRAINT "PayrollPeriod_pay_date_check" CHECK ("payDate" >= "periodStart")
);

CREATE TABLE "PayrollEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "payrollPeriodId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeCompensationId" TEXT NOT NULL,
  "baseAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grossAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" "PayrollEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeCompensation_organizationId_employeeId_effectiveFrom_idx" ON "EmployeeCompensation"("organizationId", "employeeId", "effectiveFrom");
CREATE INDEX "EmployeeCompensation_organizationId_status_idx" ON "EmployeeCompensation"("organizationId", "status");
CREATE UNIQUE INDEX "PayrollPeriod_organizationId_name_key" ON "PayrollPeriod"("organizationId", "name");
CREATE INDEX "PayrollPeriod_organizationId_periodStart_periodEnd_idx" ON "PayrollPeriod"("organizationId", "periodStart", "periodEnd");
CREATE INDEX "PayrollPeriod_organizationId_status_idx" ON "PayrollPeriod"("organizationId", "status");
CREATE UNIQUE INDEX "PayrollEntry_organizationId_payrollPeriodId_employeeId_key" ON "PayrollEntry"("organizationId", "payrollPeriodId", "employeeId");
CREATE INDEX "PayrollEntry_organizationId_payrollPeriodId_status_idx" ON "PayrollEntry"("organizationId", "payrollPeriodId", "status");
CREATE INDEX "PayrollEntry_organizationId_employeeId_idx" ON "PayrollEntry"("organizationId", "employeeId");
CREATE INDEX "PayrollEntry_employeeCompensationId_idx" ON "PayrollEntry"("employeeCompensationId");

ALTER TABLE "EmployeeCompensation" ADD CONSTRAINT "EmployeeCompensation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeCompensation" ADD CONSTRAINT "EmployeeCompensation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeCompensationId_fkey" FOREIGN KEY ("employeeCompensationId") REFERENCES "EmployeeCompensation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
