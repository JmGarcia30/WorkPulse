CREATE TYPE "PayrollPolicyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "DailyPayBasis" AS ENUM ('SCHEDULED_PAYABLE_DAYS', 'ACTUAL_PRESENT_DAYS', 'PRESENT_PLUS_PAID_LEAVE');
CREATE TYPE "LateDeductionRule" AS ENUM ('NONE', 'PER_MINUTE', 'FIXED_PER_OCCURRENCE');
CREATE TYPE "AbsenceDeductionRule" AS ENUM ('NONE', 'DAILY_RATE_PER_ABSENT_DAY', 'FIXED_PER_ABSENCE');
CREATE TYPE "UndertimeDeductionRule" AS ENUM ('NONE', 'PER_MINUTE', 'FIXED_PER_OCCURRENCE');
CREATE TYPE "PayrollRoundingRule" AS ENUM ('STANDARD_2_DECIMAL');
CREATE TYPE "LeavePayrollTreatment" AS ENUM ('PAID', 'UNPAID', 'NO_PAYROLL_EFFECT');

CREATE TABLE "OrganizationPayrollPolicy" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "effectiveFrom" DATE NOT NULL, "effectiveTo" DATE,
  "status" "PayrollPolicyStatus" NOT NULL DEFAULT 'ACTIVE',
  "dailyPayBasis" "DailyPayBasis" NOT NULL DEFAULT 'SCHEDULED_PAYABLE_DAYS',
  "lateDeductionRule" "LateDeductionRule" NOT NULL DEFAULT 'NONE', "lateDeductionParameter" DECIMAL(12,4),
  "absenceDeductionRule" "AbsenceDeductionRule" NOT NULL DEFAULT 'NONE', "absenceDeductionParameter" DECIMAL(12,4),
  "undertimeDeductionRule" "UndertimeDeductionRule" NOT NULL DEFAULT 'NONE', "undertimeDeductionParameter" DECIMAL(12,4),
  "roundingRule" "PayrollRoundingRule" NOT NULL DEFAULT 'STANDARD_2_DECIMAL',
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationPayrollPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationPayrollPolicy_date_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom"),
  CONSTRAINT "OrganizationPayrollPolicy_late_parameter_check" CHECK ("lateDeductionParameter" IS NULL OR "lateDeductionParameter" > 0),
  CONSTRAINT "OrganizationPayrollPolicy_absence_parameter_check" CHECK ("absenceDeductionParameter" IS NULL OR "absenceDeductionParameter" > 0),
  CONSTRAINT "OrganizationPayrollPolicy_undertime_parameter_check" CHECK ("undertimeDeductionParameter" IS NULL OR "undertimeDeductionParameter" > 0)
);

CREATE TABLE "PayrollPolicyLeaveTreatment" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "payrollPolicyId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL, "treatment" "LeavePayrollTreatment" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollPolicyLeaveTreatment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationPayrollPolicy_organizationId_version_key" ON "OrganizationPayrollPolicy"("organizationId", "version");
CREATE INDEX "OrganizationPayrollPolicy_organizationId_status_effectiveFrom_effectiveTo_idx" ON "OrganizationPayrollPolicy"("organizationId", "status", "effectiveFrom", "effectiveTo");
CREATE INDEX "OrganizationPayrollPolicy_createdById_idx" ON "OrganizationPayrollPolicy"("createdById");
CREATE UNIQUE INDEX "PayrollPolicyLeaveTreatment_payrollPolicyId_leaveTypeId_key" ON "PayrollPolicyLeaveTreatment"("payrollPolicyId", "leaveTypeId");
CREATE INDEX "PayrollPolicyLeaveTreatment_organizationId_leaveTypeId_idx" ON "PayrollPolicyLeaveTreatment"("organizationId", "leaveTypeId");

ALTER TABLE "OrganizationPayrollPolicy" ADD CONSTRAINT "OrganizationPayrollPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationPayrollPolicy" ADD CONSTRAINT "OrganizationPayrollPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPolicyLeaveTreatment" ADD CONSTRAINT "PayrollPolicyLeaveTreatment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPolicyLeaveTreatment" ADD CONSTRAINT "PayrollPolicyLeaveTreatment_payrollPolicyId_fkey" FOREIGN KEY ("payrollPolicyId") REFERENCES "OrganizationPayrollPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPolicyLeaveTreatment" ADD CONSTRAINT "PayrollPolicyLeaveTreatment_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
