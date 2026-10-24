-- Separate platform credentials; no tenant tables or existing records are changed.
CREATE TABLE "PlatformAdministrator" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformAdministrator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformAdministrator_email_key" ON "PlatformAdministrator"("email");

CREATE TABLE "PlatformAdministratorSession" (
    "tokenHash" TEXT NOT NULL,
    "administratorId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAdministratorSession_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "PlatformAdministratorSession_administratorId_idx" ON "PlatformAdministratorSession"("administratorId");
CREATE INDEX "PlatformAdministratorSession_expiresAt_idx" ON "PlatformAdministratorSession"("expiresAt");
ALTER TABLE "PlatformAdministratorSession" ADD CONSTRAINT "PlatformAdministratorSession_administratorId_fkey" FOREIGN KEY ("administratorId") REFERENCES "PlatformAdministrator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PlatformAuthenticationAttempt" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformAuthenticationAttempt_pkey" PRIMARY KEY ("key")
);
