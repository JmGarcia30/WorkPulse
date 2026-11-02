CREATE TABLE "OrganizationEmailIntegration" (
  "organizationId" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT,
  "googleSubject" TEXT,
  "credentials" TEXT,
  "accessExpiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "generation" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "retryAt" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationEmailIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrganizationEmailIntegration_googleSubject_key" ON "OrganizationEmailIntegration"("googleSubject");
CREATE TABLE "OrganizationEmailOAuthAttempt" (
  "stateHash" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "tenantProofHash" TEXT NOT NULL,
  "publicProofHash" TEXT,
  "verifierCipher" TEXT NOT NULL,
  "pendingCipher" TEXT,
  "generation" INTEGER NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'CREATED',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationEmailOAuthAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrganizationEmailOAuthAttempt_actorId_organizationId_fkey" FOREIGN KEY ("actorId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OrganizationEmailOAuthAttempt_organizationId_idx" ON "OrganizationEmailOAuthAttempt"("organizationId");
CREATE INDEX "OrganizationEmailOAuthAttempt_expiresAt_idx" ON "OrganizationEmailOAuthAttempt"("expiresAt");
