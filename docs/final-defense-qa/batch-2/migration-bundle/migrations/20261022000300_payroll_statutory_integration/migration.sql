-- AlterEnum
ALTER TYPE "PayFrequency" ADD VALUE 'SEMI_MONTHLY';

-- CreateTable
CREATE TABLE "PayrollStatutoryInput" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "evidenceReference" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollStatutoryInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollTaxOpening" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "openingPayDate" DATE NOT NULL,
    "balances" JSONB NOT NULL,
    "evidenceReference" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollTaxOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollContributionMonth" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contributionMonth" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,

    CONSTRAINT "PayrollContributionMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollStatutoryPosting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollEntryId" TEXT NOT NULL,
    "payDate" DATE NOT NULL,
    "taxYear" TEXT NOT NULL,
    "benefitUsage" JSONB NOT NULL,
    "calculation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollStatutoryPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollContributionAllocation" (
    "id" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "allocation" JSONB NOT NULL,
    "monthlyLiability" JSONB NOT NULL,

    CONSTRAINT "PayrollContributionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollStatutoryInput_organizationId_employeeId_payrollPeri_key" ON "PayrollStatutoryInput"("organizationId", "employeeId", "payrollPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollTaxOpening_organizationId_employeeId_taxYear_key" ON "PayrollTaxOpening"("organizationId", "employeeId", "taxYear");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollContributionMonth_organizationId_employeeId_contribu_key" ON "PayrollContributionMonth"("organizationId", "employeeId", "contributionMonth");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollContributionMonth_id_frequency_key" ON "PayrollContributionMonth"("id", "frequency");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollStatutoryPosting_payrollEntryId_key" ON "PayrollStatutoryPosting"("payrollEntryId");

-- CreateIndex
CREATE INDEX "PayrollStatutoryPosting_organizationId_employeeId_taxYear_p_idx" ON "PayrollStatutoryPosting"("organizationId", "employeeId", "taxYear", "payDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollStatutoryPosting_payrollEntryId_organizationId_emplo_key" ON "PayrollStatutoryPosting"("payrollEntryId", "organizationId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollContributionAllocation_monthId_agency_slot_key" ON "PayrollContributionAllocation"("monthId", "agency", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollContributionAllocation_postingId_agency_key" ON "PayrollContributionAllocation"("postingId", "agency");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_id_organizationId_key" ON "PayrollPeriod"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_id_organizationId_employeeId_key" ON "PayrollEntry"("id", "organizationId", "employeeId");

-- AddForeignKey
ALTER TABLE "PayrollStatutoryInput" ADD CONSTRAINT "PayrollStatutoryInput_employeeId_organizationId_fkey" FOREIGN KEY ("employeeId", "organizationId") REFERENCES "Employee"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatutoryInput" ADD CONSTRAINT "PayrollStatutoryInput_payrollPeriodId_organizationId_fkey" FOREIGN KEY ("payrollPeriodId", "organizationId") REFERENCES "PayrollPeriod"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollTaxOpening" ADD CONSTRAINT "PayrollTaxOpening_employeeId_organizationId_fkey" FOREIGN KEY ("employeeId", "organizationId") REFERENCES "Employee"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollContributionMonth" ADD CONSTRAINT "PayrollContributionMonth_employeeId_organizationId_fkey" FOREIGN KEY ("employeeId", "organizationId") REFERENCES "Employee"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollStatutoryPosting" ADD CONSTRAINT "PayrollStatutoryPosting_payrollEntryId_organizationId_empl_fkey" FOREIGN KEY ("payrollEntryId", "organizationId", "employeeId") REFERENCES "PayrollEntry"("id", "organizationId", "employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollContributionAllocation" ADD CONSTRAINT "PayrollContributionAllocation_monthId_frequency_fkey" FOREIGN KEY ("monthId", "frequency") REFERENCES "PayrollContributionMonth"("id", "frequency") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollContributionAllocation" ADD CONSTRAINT "PayrollContributionAllocation_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "PayrollStatutoryPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

