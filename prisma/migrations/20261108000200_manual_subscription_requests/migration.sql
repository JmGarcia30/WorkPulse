-- Additive continuation of the unshipped foundation; do not edit its checksum.
ALTER TYPE "SubscriptionSource" ADD VALUE 'MANUAL';
ALTER TABLE "OrganizationSubscription" ADD COLUMN "legacyAccess" BOOLEAN NOT NULL DEFAULT false;
UPDATE "OrganizationSubscription" SET "legacyAccess" = true WHERE "source" = 'LEGACY';

CREATE TYPE "SubscriptionRequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TABLE "SubscriptionRequest" (
 "id" TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "planTier" "SubscriptionTier" NOT NULL REFERENCES "SubscriptionPlan"("tier") ON DELETE RESTRICT ON UPDATE CASCADE,
 "status" "SubscriptionRequestStatus" NOT NULL DEFAULT 'PENDING',
 "requestedByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "reviewedByAdministratorId" TEXT REFERENCES "PlatformAdministrator"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "reviewNote" TEXT,
 "durationMonths" INTEGER,
 "startsAt" TIMESTAMP(3),
 "endsAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "reviewedAt" TIMESTAMP(3),
 CONSTRAINT "SubscriptionRequest_duration" CHECK ("durationMonths" IS NULL OR "durationMonths" BETWEEN 1 AND 120),
 CONSTRAINT "SubscriptionRequest_review" CHECK (
   ("status" = 'PENDING' AND "reviewedAt" IS NULL AND "reviewedByAdministratorId" IS NULL AND "durationMonths" IS NULL AND "startsAt" IS NULL AND "endsAt" IS NULL) OR
   ("status" = 'REJECTED' AND "reviewedAt" IS NOT NULL AND "reviewedByAdministratorId" IS NOT NULL AND "reviewNote" IS NOT NULL AND length(trim("reviewNote")) > 0 AND "durationMonths" IS NULL AND "startsAt" IS NULL AND "endsAt" IS NULL) OR
   ("status" = 'APPROVED' AND "reviewedAt" IS NOT NULL AND "reviewedByAdministratorId" IS NOT NULL AND "durationMonths" IS NOT NULL AND "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" > "startsAt")
 )
);
-- Enforce one pending request per immutable tenant ID even outside the application.
CREATE UNIQUE INDEX "SubscriptionRequest_one_pending_per_org" ON "SubscriptionRequest"("organizationId") WHERE "status" = 'PENDING';
CREATE INDEX "SubscriptionRequest_organizationId_createdAt_idx" ON "SubscriptionRequest"("organizationId","createdAt");
CREATE INDEX "SubscriptionRequest_status_createdAt_idx" ON "SubscriptionRequest"("status","createdAt");
ALTER TABLE "SubscriptionEvent" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "SubscriptionEvent" ADD COLUMN "requestId" TEXT REFERENCES "SubscriptionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEvent" ADD COLUMN "actorUserId" TEXT;
ALTER TABLE "SubscriptionEvent" ADD COLUMN "details" JSONB;

CREATE FUNCTION reject_subscription_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'SUBSCRIPTION_AUDIT_IMMUTABLE';
END;
$$;
CREATE TRIGGER subscription_event_append_only BEFORE UPDATE OR DELETE ON "SubscriptionEvent"
FOR EACH ROW EXECUTE FUNCTION reject_subscription_event_mutation();

-- Requests can be evaluated before commercial definitions arrive. No prices,
-- employee limits, or premium inclusions are invented. Legacy access bypasses
-- these optional-feature flags independently of future plan changes.
UPDATE "SubscriptionPlan" SET "active" = true, "aiResumeParsing" = false,
 "advancedAnalytics" = false, "gmailIntegration" = false, "customBranding" = false,
 "description" = 'Core workforce management. Final pricing, optional features and employee limits awaiting approval.'
WHERE "monthlyPriceMinor" IS NULL AND "yearlyPriceMinor" IS NULL AND "active" = false;
