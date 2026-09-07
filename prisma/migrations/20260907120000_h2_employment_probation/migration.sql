-- H2 Employment & Probation Management.
-- This migration is additive to H1 and preserves its effective-dating indexes.

ALTER TABLE "ProbationRecord"
  ADD COLUMN "previousProbationRecordId" TEXT;

CREATE TABLE "EmploymentDecisionHistory" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "probationRecordId" TEXT NOT NULL,
  "previousEmploymentRecordId" TEXT NOT NULL,
  "resultingEmploymentRecordId" TEXT,
  "decision" "ProbationDecision" NOT NULL,
  "decisionAt" TIMESTAMP(3) NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "changedById" TEXT NOT NULL,
  "remarks" TEXT,
  "previousState" JSONB NOT NULL,
  "newState" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmploymentDecisionHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProbationRecord_previousProbationRecordId_key"
  ON "ProbationRecord"("previousProbationRecordId");
CREATE UNIQUE INDEX "ProbationRecord_one_active_per_employee_key"
  ON "ProbationRecord"("employeeId") WHERE "probationStatus" = 'ACTIVE';

CREATE UNIQUE INDEX "EmploymentDecisionHistory_probationRecordId_key"
  ON "EmploymentDecisionHistory"("probationRecordId");
CREATE INDEX "EmploymentDecisionHistory_employeeId_decisionAt_idx"
  ON "EmploymentDecisionHistory"("employeeId", "decisionAt");
CREATE INDEX "EmploymentDecisionHistory_changedById_idx"
  ON "EmploymentDecisionHistory"("changedById");
CREATE INDEX "EmploymentDecisionHistory_previousEmploymentRecordId_idx"
  ON "EmploymentDecisionHistory"("previousEmploymentRecordId");
CREATE INDEX "EmploymentDecisionHistory_resultingEmploymentRecordId_idx"
  ON "EmploymentDecisionHistory"("resultingEmploymentRecordId");

ALTER TABLE "ProbationRecord"
  ADD CONSTRAINT "ProbationRecord_previousProbationRecordId_fkey"
  FOREIGN KEY ("previousProbationRecordId") REFERENCES "ProbationRecord"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmploymentDecisionHistory"
  ADD CONSTRAINT "EmploymentDecisionHistory_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EmploymentDecisionHistory_probationRecordId_fkey"
  FOREIGN KEY ("probationRecordId") REFERENCES "ProbationRecord"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EmploymentDecisionHistory_previousEmploymentRecordId_fkey"
  FOREIGN KEY ("previousEmploymentRecordId") REFERENCES "EmploymentRecord"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EmploymentDecisionHistory_resultingEmploymentRecordId_fkey"
  FOREIGN KEY ("resultingEmploymentRecordId") REFERENCES "EmploymentRecord"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EmploymentDecisionHistory_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProbationRecord"
  DROP CONSTRAINT "ProbationRecord_decisionById_fkey",
  ADD CONSTRAINT "ProbationRecord_decisionById_fkey"
  FOREIGN KEY ("decisionById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProbationRecord"
  ADD CONSTRAINT "ProbationRecord_renewal_counts_check"
    CHECK ("renewalCount" >= 0 AND "maxRenewals" >= 0 AND "renewalCount" <= "maxRenewals"),
  ADD CONSTRAINT "ProbationRecord_period_check"
    CHECK ("expectedEndAt" > "startedAt"),
  ADD CONSTRAINT "ProbationRecord_lifecycle_state_check"
    CHECK (
      (
        "probationStatus" = 'ACTIVE'
        AND "decision" = 'PENDING'
        AND "completedAt" IS NULL
        AND "decisionAt" IS NULL
        AND "decisionById" IS NULL
      )
      OR
      (
        "probationStatus" = 'CLOSED'
        AND "decision" <> 'PENDING'
        AND "completedAt" IS NOT NULL
        AND "decisionAt" IS NOT NULL
        AND "decisionById" IS NOT NULL
      )
    );

ALTER TABLE "EmploymentDecisionHistory"
  ADD CONSTRAINT "EmploymentDecisionHistory_final_decision_check"
    CHECK ("decision" <> 'PENDING');
