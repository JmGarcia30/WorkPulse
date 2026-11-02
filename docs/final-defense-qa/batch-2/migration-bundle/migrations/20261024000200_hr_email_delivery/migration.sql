CREATE TABLE "HrEmailDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrEmailDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrEmailDelivery_status_check" CHECK ("status" IN ('DRAFT','SENDING','SUBMITTED','FAILED','UNKNOWN')),
  CONSTRAINT "HrEmailDelivery_attemptCount_check" CHECK ("attemptCount" BETWEEN 0 AND 5),
  CONSTRAINT "HrEmailDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HrEmailDelivery_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HrEmailDelivery_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HrEmailDelivery_organizationId_eventKey_key" ON "HrEmailDelivery"("organizationId", "eventKey");
CREATE INDEX "HrEmailDelivery_organizationId_applicationId_createdAt_idx" ON "HrEmailDelivery"("organizationId", "applicationId", "createdAt");
