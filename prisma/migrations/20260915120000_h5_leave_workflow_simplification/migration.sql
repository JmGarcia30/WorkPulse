-- H5 workflow simplification: stable institutional leave-form context.
ALTER TABLE "LeaveRequest"
  ADD COLUMN "employeeNameSnapshot" TEXT,
  ADD COLUMN "organizationNameSnapshot" TEXT,
  ADD COLUMN "organizationTimeZoneSnapshot" TEXT,
  ADD COLUMN "expectedReturnDateSnapshot" DATE,
  ADD COLUMN "reviewerNameSnapshot" TEXT;

UPDATE "LeaveRequest" request
SET
  "employeeNameSnapshot" = trim(employee."firstName" || ' ' || employee."lastName"),
  "organizationNameSnapshot" = organization."name",
  "organizationTimeZoneSnapshot" = organization."timeZone",
  "reviewerNameSnapshot" = (SELECT reviewer."name" FROM "User" reviewer WHERE reviewer."id" = request."reviewedById")
FROM "Employee" employee
JOIN "Organization" organization ON organization."id" = employee."organizationId"
WHERE employee."id" = request."employeeId";
