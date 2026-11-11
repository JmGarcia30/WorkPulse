-- Add auditable, tenant-scoped payroll configuration records.
ALTER TABLE "OrganizationPayrollPolicy"
  ADD COLUMN "notifyEmployeesOnFinalization" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PayrollOvertimeApproval" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "payrollPeriodId" TEXT NOT NULL,
  "approvedHours" DECIMAL(8,2) NOT NULL,
  "hourlyRate" DECIMAL(12,2) NOT NULL,
  "approvalReference" VARCHAR(300) NOT NULL,
  "approvedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollOvertimeApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollOvertimeApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayrollOvertimeApproval_employeeId_organizationId_fkey" FOREIGN KEY ("employeeId", "organizationId") REFERENCES "Employee"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayrollOvertimeApproval_payrollPeriodId_organizationId_fkey" FOREIGN KEY ("payrollPeriodId", "organizationId") REFERENCES "PayrollPeriod"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayrollOvertimeApproval_approvedById_organizationId_fkey" FOREIGN KEY ("approvedById", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayrollOvertimeApproval_hours_check" CHECK ("approvedHours" > 0 AND "approvedHours" <= 744),
  CONSTRAINT "PayrollOvertimeApproval_rate_check" CHECK ("hourlyRate" > 0)
);
CREATE UNIQUE INDEX "PayrollOvertimeApproval_organizationId_employeeId_payrollPeriodId_key" ON "PayrollOvertimeApproval"("organizationId","employeeId","payrollPeriodId");
CREATE INDEX "PayrollOvertimeApproval_organizationId_payrollPeriodId_idx" ON "PayrollOvertimeApproval"("organizationId","payrollPeriodId");
CREATE INDEX "PayrollOvertimeApproval_approvedById_organizationId_idx" ON "PayrollOvertimeApproval"("approvedById","organizationId");

CREATE TABLE "PayrollCompensationRevision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "previousState" JSONB NOT NULL,
  "newState" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollCompensationRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollCompensationRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayrollCompensationRevision_employeeId_organizationId_fkey" FOREIGN KEY ("employeeId","organizationId") REFERENCES "Employee"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayrollCompensationRevision_actorUserId_organizationId_fkey" FOREIGN KEY ("actorUserId","organizationId") REFERENCES "User"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PayrollCompensationRevision_organizationId_employeeId_createdAt_idx" ON "PayrollCompensationRevision"("organizationId","employeeId","createdAt");
CREATE INDEX "PayrollCompensationRevision_actorUserId_organizationId_idx" ON "PayrollCompensationRevision"("actorUserId","organizationId");
