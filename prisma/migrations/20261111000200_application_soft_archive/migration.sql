-- Soft archive only; historical applicant records and status are preserved.
ALTER TABLE "Application" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Application_archivedAt_idx" ON "Application"("archivedAt");

CREATE TABLE "ApplicationArchiveEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationArchiveEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationArchiveEvent_action_check" CHECK ("action" IN ('ARCHIVED', 'RESTORED'))
);
CREATE INDEX "ApplicationArchiveEvent_organizationId_createdAt_idx" ON "ApplicationArchiveEvent"("organizationId", "createdAt");
CREATE INDEX "ApplicationArchiveEvent_applicationId_createdAt_idx" ON "ApplicationArchiveEvent"("applicationId", "createdAt");
ALTER TABLE "ApplicationArchiveEvent" ADD CONSTRAINT "ApplicationArchiveEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationArchiveEvent" ADD CONSTRAINT "ApplicationArchiveEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationArchiveEvent" ADD CONSTRAINT "ApplicationArchiveEvent_actorUserId_organizationId_fkey" FOREIGN KEY ("actorUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Audit history is append-only, including restores.
CREATE TRIGGER "ApplicationArchiveEvent_immutable"
  BEFORE UPDATE OR DELETE ON "ApplicationArchiveEvent"
  FOR EACH ROW EXECUTE FUNCTION "it_eval_immutable_security_event"();
