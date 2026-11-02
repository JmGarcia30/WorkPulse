CREATE TABLE "AccountSecurityEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "actorIdentifier" TEXT,
  "subjectIdentifier" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "operationKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountSecurityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AccountSecurityEvent_action_check" CHECK ("action" IN ('PROFILE_UPDATED','PASSWORD_CHANGED','LOGIN_LOCKOUT','PASSWORD_RESET_REQUESTED','PASSWORD_RESET_COMPLETED','SECURITY_ALERT_CLAIMED','SECURITY_ALERT_ACCEPTED','SECURITY_ALERT_FAILED','DRAFT_JOB_DELETED','JOB_CREATED','JOB_UPDATED','JOB_PUBLISHED','JOB_CLOSED'))
);
CREATE UNIQUE INDEX "AccountSecurityEvent_operationKey_key" ON "AccountSecurityEvent"("operationKey");
CREATE INDEX "AccountSecurityEvent_organizationId_createdAt_id_idx" ON "AccountSecurityEvent"("organizationId","createdAt","id");
CREATE INDEX "AccountSecurityEvent_createdAt_id_idx" ON "AccountSecurityEvent"("createdAt","id");

CREATE FUNCTION "it_eval_immutable_security_event"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Account security events are immutable';
END;
$$;
CREATE TRIGGER "AccountSecurityEvent_immutable" BEFORE UPDATE OR DELETE ON "AccountSecurityEvent" FOR EACH ROW EXECUTE FUNCTION "it_eval_immutable_security_event"();

CREATE TABLE "StaffPasswordReset" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffPasswordReset_userId_organizationId_fkey" FOREIGN KEY ("userId","organizationId") REFERENCES "User"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StaffPasswordReset_userId_createdAt_idx" ON "StaffPasswordReset"("userId","createdAt");
CREATE INDEX "StaffPasswordReset_expiresAt_idx" ON "StaffPasswordReset"("expiresAt");
