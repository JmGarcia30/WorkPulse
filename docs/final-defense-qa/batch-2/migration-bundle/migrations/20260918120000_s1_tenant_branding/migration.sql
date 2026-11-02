CREATE TABLE "OrganizationBranding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "displayName" TEXT,
  "tagline" TEXT,
  "primaryColor" TEXT,
  "accentColor" TEXT,
  "logoStorageKey" TEXT,
  "loginImageStorageKey" TEXT,
  "address" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationBranding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationBrandingAudit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationBrandingAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationBranding_organizationId_key" ON "OrganizationBranding"("organizationId");
CREATE INDEX "OrganizationBrandingAudit_organizationId_createdAt_idx" ON "OrganizationBrandingAudit"("organizationId", "createdAt");
CREATE INDEX "OrganizationBrandingAudit_actorUserId_idx" ON "OrganizationBrandingAudit"("actorUserId");

ALTER TABLE "OrganizationBranding" ADD CONSTRAINT "OrganizationBranding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationBrandingAudit" ADD CONSTRAINT "OrganizationBrandingAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationBrandingAudit" ADD CONSTRAINT "OrganizationBrandingAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "OrganizationBrandingAudit_immutable"
BEFORE UPDATE OR DELETE ON "OrganizationBrandingAudit"
FOR EACH ROW EXECUTE FUNCTION "h5_reject_immutable_change"();
