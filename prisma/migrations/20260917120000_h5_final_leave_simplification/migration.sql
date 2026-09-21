-- Final H5 simplification: scheduled-work-day requests may remain uncalculated
-- until HR approval resolves authoritative effective-dated schedules.
ALTER TABLE "LeaveRequest"
  ALTER COLUMN "requestedUnits" DROP NOT NULL,
  ADD COLUMN "calculationFinalizedAt" TIMESTAMP(3);

-- Existing requests were calculated by the pre-simplification workflow.
UPDATE "LeaveRequest"
SET "calculationFinalizedAt" = COALESCE("reviewedAt", "submittedAt")
WHERE "requestedUnits" IS NOT NULL;
