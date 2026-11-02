-- Additive onboarding only; existing tenants remain unclassified and unchanged.
ALTER TABLE "Organization" ADD COLUMN "contactEmail" TEXT;
CREATE TYPE "OrganizationInvitationStatus" AS ENUM ('PENDING', 'ACTIVATED', 'REVOKED');
CREATE TYPE "OrganizationInvitationDelivery" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "OrganizationAdministratorInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "creationKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" "OrganizationInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryStatus" "OrganizationInvitationDelivery" NOT NULL DEFAULT 'PENDING',
  "tokenHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastIssuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  "activatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationAdministratorInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationAdministratorInvitation_organizationId_key" ON "OrganizationAdministratorInvitation"("organizationId");
CREATE UNIQUE INDEX "OrganizationAdministratorInvitation_userId_key" ON "OrganizationAdministratorInvitation"("userId");
CREATE UNIQUE INDEX "OrganizationAdministratorInvitation_creationKey_key" ON "OrganizationAdministratorInvitation"("creationKey");
CREATE UNIQUE INDEX "OrganizationAdministratorInvitation_tokenHash_key" ON "OrganizationAdministratorInvitation"("tokenHash");
CREATE UNIQUE INDEX "OrganizationAdministratorInvitation_userId_organizationId_key" ON "OrganizationAdministratorInvitation"("userId", "organizationId");
ALTER TABLE "OrganizationAdministratorInvitation" ADD CONSTRAINT "OrganizationAdministratorInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationAdministratorInvitation" ADD CONSTRAINT "OrganizationAdministratorInvitation_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationAdministratorInvitation" ADD CONSTRAINT "OrganizationAdministratorInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "PlatformAdministrator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PlatformOrganizationAudit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorAdministratorId" TEXT,
  "action" TEXT NOT NULL,
  "operationKey" TEXT,
  "invitationVersion" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformOrganizationAudit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformOrganizationAudit_operationKey_key" ON "PlatformOrganizationAudit"("operationKey");
CREATE INDEX "PlatformOrganizationAudit_organizationId_createdAt_idx" ON "PlatformOrganizationAudit"("organizationId", "createdAt");
ALTER TABLE "PlatformOrganizationAudit" ADD CONSTRAINT "PlatformOrganizationAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformOrganizationAudit" ADD CONSTRAINT "PlatformOrganizationAudit_actorAdministratorId_fkey" FOREIGN KEY ("actorAdministratorId") REFERENCES "PlatformAdministrator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
