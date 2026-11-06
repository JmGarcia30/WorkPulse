-- Preserve previously issued workspace URLs without transferring tenant identity.
CREATE TABLE "OrganizationSlugAlias" (
  "slug" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationSlugAlias_pkey" PRIMARY KEY ("slug")
);
CREATE INDEX "OrganizationSlugAlias_organizationId_idx" ON "OrganizationSlugAlias"("organizationId");
ALTER TABLE "OrganizationSlugAlias"
  ADD CONSTRAINT "OrganizationSlugAlias_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
