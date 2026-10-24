-- Additive policy configuration and agreed-offer snapshot. No historical rewrites.
ALTER TABLE "Organization" ADD COLUMN "probationPolicy" JSONB;
ALTER TABLE "Offer" ADD COLUMN "probationPolicySnapshot" JSONB;
