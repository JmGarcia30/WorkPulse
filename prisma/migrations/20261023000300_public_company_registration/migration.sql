CREATE TABLE "CompanyRegistration" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "administratorName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "browserHash" TEXT NOT NULL,
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastIssuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryStatus" "OrganizationInvitationDelivery" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyRegistration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyRegistration_email_key" ON "CompanyRegistration"("email");
CREATE UNIQUE INDEX "CompanyRegistration_tokenHash_key" ON "CompanyRegistration"("tokenHash");
CREATE UNIQUE INDEX "CompanyRegistration_organizationId_key" ON "CompanyRegistration"("organizationId");
CREATE INDEX "CompanyRegistration_expiresAt_idx" ON "CompanyRegistration"("expiresAt");
ALTER TABLE "CompanyRegistration" ADD CONSTRAINT "CompanyRegistration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
