-- HR notification read receipts; every row is scoped to the organization and HR user.
CREATE TABLE "HrNotificationRead" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notificationKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrNotificationRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrNotificationRead_organizationId_userId_notificationKey_key"
  ON "HrNotificationRead"("organizationId", "userId", "notificationKey");
CREATE INDEX "HrNotificationRead_organizationId_userId_readAt_idx"
  ON "HrNotificationRead"("organizationId", "userId", "readAt");
ALTER TABLE "HrNotificationRead" ADD CONSTRAINT "HrNotificationRead_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrNotificationRead" ADD CONSTRAINT "HrNotificationRead_userId_organizationId_fkey"
  FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
