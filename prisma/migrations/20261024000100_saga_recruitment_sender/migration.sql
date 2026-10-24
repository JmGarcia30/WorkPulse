ALTER TABLE "OrganizationEmailIntegration"
ADD COLUMN "testedAt" TIMESTAMP(3),
ADD COLUMN "recruitmentGmailActive" BOOLEAN NOT NULL DEFAULT false;
