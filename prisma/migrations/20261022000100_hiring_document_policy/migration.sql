-- Additive, nullable configuration. Existing records and documents are preserved.
ALTER TABLE "Organization" ADD COLUMN "hiringDocumentRequirements" JSONB;
