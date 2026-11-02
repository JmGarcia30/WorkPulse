-- Nullable: existing organizations and historical case snapshots are unchanged.
ALTER TABLE "Organization" ADD COLUMN "resignationPolicy" JSONB;
