-- Add auditable, tenant-scoped payroll configuration records.
ALTER TABLE "OrganizationPayrollPolicy"
  ADD COLUMN "notifyEmployeesOnFinalization" BOOLEAN NOT NULL DEFAULT false;

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
