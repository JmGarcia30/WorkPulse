-- Additive only. No existing rows, columns, triggers, or enums are changed.
BEGIN;

-- CreateTable
CREATE TABLE "RfidCard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cardDigest" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "RfidCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfidKioskSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorizedById" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RfidKioskSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfidAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "employeeId" TEXT,
    "action" TEXT NOT NULL,
    "requestKey" TEXT,
    "requestFingerprint" CHAR(64),
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfidAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfidRequestBudget" (
    "key" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RfidRequestBudget_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RfidCard_organizationId_cardDigest_idx" ON "RfidCard"("organizationId", "cardDigest");

-- CreateIndex
CREATE INDEX "RfidCard_organizationId_employeeId_idx" ON "RfidCard"("organizationId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RfidKioskSession_tokenHash_key" ON "RfidKioskSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RfidKioskSession_organizationId_authorizedById_idx" ON "RfidKioskSession"("organizationId", "authorizedById");

-- CreateIndex
CREATE INDEX "RfidAudit_organizationId_createdAt_idx" ON "RfidAudit"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RfidAudit_organizationId_requestKey_key" ON "RfidAudit"("organizationId", "requestKey");

-- AddForeignKey
ALTER TABLE "RfidCard" ADD CONSTRAINT "RfidCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidCard" ADD CONSTRAINT "RfidCard_employeeId_organizationId_fkey" FOREIGN KEY ("employeeId", "organizationId") REFERENCES "Employee"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidKioskSession" ADD CONSTRAINT "RfidKioskSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidKioskSession" ADD CONSTRAINT "RfidKioskSession_authorizedById_organizationId_fkey" FOREIGN KEY ("authorizedById", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidAudit" ADD CONSTRAINT "RfidAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidAudit" ADD CONSTRAINT "RfidAudit_actorUserId_organizationId_fkey" FOREIGN KEY ("actorUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidAudit" ADD CONSTRAINT "RfidAudit_employeeId_organizationId_fkey" FOREIGN KEY ("employeeId", "organizationId") REFERENCES "Employee"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidRequestBudget" ADD CONSTRAINT "RfidRequestBudget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce one active card per employee, and one active employee per card in a tenant.
CREATE UNIQUE INDEX "RfidCard_active_card_key" ON "RfidCard"("organizationId", "cardDigest") WHERE "deactivatedAt" IS NULL;
CREATE UNIQUE INDEX "RfidCard_active_employee_key" ON "RfidCard"("organizationId", "employeeId") WHERE "deactivatedAt" IS NULL;
ALTER TABLE "RfidCard" ADD CONSTRAINT "RfidCard_digest_check" CHECK ("cardDigest" ~ '^[a-f0-9]{64}$');
ALTER TABLE "RfidCard" ADD CONSTRAINT "RfidCard_deactivation_check" CHECK ("deactivatedAt" IS NULL OR "deactivatedAt" >= "createdAt");
ALTER TABLE "RfidKioskSession" ADD CONSTRAINT "RfidKioskSession_token_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "RfidKioskSession" ADD CONSTRAINT "RfidKioskSession_expiry_check" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "RfidRequestBudget" ADD CONSTRAINT "RfidRequestBudget_attempts_check" CHECK (attempts > 0);
ALTER TABLE "RfidAudit" ADD CONSTRAINT "RfidAudit_request_check" CHECK (("requestKey" IS NULL AND "requestFingerprint" IS NULL) OR ("requestKey" IS NOT NULL AND "requestFingerprint" ~ '^[a-f0-9]{64}$'));

CREATE FUNCTION "reject_rfid_audit_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'RFID audit records are immutable';
END;
$$;
CREATE TRIGGER "RfidAudit_immutable" BEFORE UPDATE OR DELETE ON "RfidAudit" FOR EACH ROW EXECUTE FUNCTION "reject_rfid_audit_mutation"();
CREATE TRIGGER "RfidAudit_no_truncate" BEFORE TRUNCATE ON "RfidAudit" FOR EACH STATEMENT EXECUTE FUNCTION "reject_rfid_audit_mutation"();

COMMIT;
