-- Additive: preserve all pending legacy links and existing organizations.
ALTER TABLE "CompanyRegistration"
  ADD COLUMN "otpHash" TEXT,
  ADD COLUMN "otpNonce" TEXT,
  ADD COLUMN "otpAttempts" INTEGER NOT NULL DEFAULT 0;
