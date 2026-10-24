BEGIN;
ALTER TABLE "Organization" ADD COLUMN "finalPayPolicy" JSONB;
CREATE TABLE "EmployeeFinalPay" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "caseId" TEXT NOT NULL UNIQUE,
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 0,
 "payload" JSONB NOT NULL, "caseSnapshot" JSONB NOT NULL, "sourceSnapshot" JSONB, "sourceHash" TEXT, "breakdown" JSONB,
 "grossAmount" DECIMAL(12,2), "deductionAmount" DECIMAL(12,2), "netAmount" DECIMAL(12,2),
 "deadlineDays" INTEGER NOT NULL, "deadlineBasis" TEXT NOT NULL, "separationDate" DATE NOT NULL,
 "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "finalizedById" TEXT, "finalizedAt" TIMESTAMP(3), "approvalRemarks" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "FinalPay_valid_state" CHECK ("status" IN ('DRAFT','REVIEWED','FINALIZED') AND "version">=0 AND "deadlineDays" BETWEEN 0 AND 30 AND length(btrim("deadlineBasis"))>0),
 CONSTRAINT "FinalPay_review_required" CHECK ("status"='DRAFT' OR ("reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "sourceHash" IS NOT NULL AND "sourceSnapshot" IS NOT NULL AND "breakdown" IS NOT NULL AND "grossAmount">=0 AND "deductionAmount">=0 AND "netAmount">=0 AND "grossAmount" IS NOT NULL AND "deductionAmount" IS NOT NULL AND "netAmount" IS NOT NULL AND "netAmount"="grossAmount"-"deductionAmount")),
 CONSTRAINT "FinalPay_approval_required" CHECK ("status"<>'FINALIZED' OR ("finalizedById" IS NOT NULL AND "finalizedAt" IS NOT NULL AND length(btrim("approvalRemarks"))>0 AND "approvalRemarks" IS NOT NULL)),
 FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("caseId","organizationId") REFERENCES "EmployeeSeparationCase"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("reviewedById","organizationId") REFERENCES "User"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("finalizedById","organizationId") REFERENCES "User"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 UNIQUE ("id","organizationId"), UNIQUE ("caseId","organizationId")
);
CREATE INDEX "EmployeeFinalPay_organizationId_status_idx" ON "EmployeeFinalPay"("organizationId","status");
CREATE TABLE "EmployeeFinalPayAudit" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "finalPayId" TEXT, "actorUserId" TEXT NOT NULL,
 "action" TEXT NOT NULL, "details" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("finalPayId","organizationId") REFERENCES "EmployeeFinalPay"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("actorUserId","organizationId") REFERENCES "User"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "EmployeeFinalPayAudit_organizationId_finalPayId_createdAt_idx" ON "EmployeeFinalPayAudit"("organizationId","finalPayId","createdAt");
CREATE TABLE "EmployeeFinalPayPayment" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "finalPayId" TEXT NOT NULL,
 "amount" DECIMAL(12,2) NOT NULL CHECK ("amount">0), "paidOn" DATE NOT NULL,
 "reference" TEXT NOT NULL CHECK (length(btrim("reference"))>0), "remarks" TEXT NOT NULL CHECK (length(btrim("remarks"))>0), "recordedById" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL, "requestFingerprint" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("finalPayId","organizationId") REFERENCES "EmployeeFinalPay"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("recordedById","organizationId") REFERENCES "User"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 UNIQUE ("organizationId","requestKey"), UNIQUE ("finalPayId","reference")
);
CREATE INDEX "EmployeeFinalPayPayment_organizationId_finalPayId_idx" ON "EmployeeFinalPayPayment"("organizationId","finalPayId");
CREATE FUNCTION "FinalPay_protect"() RETURNS TRIGGER AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Final pay history cannot be deleted'; END IF;
 IF OLD."status"='FINALIZED' THEN RAISE EXCEPTION 'Approved final pay is immutable'; END IF;
 IF NEW."organizationId"<>OLD."organizationId" OR NEW."caseId"<>OLD."caseId" THEN RAISE EXCEPTION 'Final pay identity is immutable'; END IF;
 IF NEW."deadlineDays">OLD."deadlineDays" THEN RAISE EXCEPTION 'Final pay deadline cannot be extended'; END IF;
 IF NEW."status"='FINALIZED' AND (OLD."status"<>'REVIEWED' OR NOT EXISTS (SELECT 1 FROM "EmployeeSeparationCase" c WHERE c."id"=NEW."caseId" AND c."organizationId"=NEW."organizationId" AND c."status"='COMPLETED')) THEN RAISE EXCEPTION 'Reviewed final pay and completed exit are required'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;
CREATE TRIGGER "FinalPay_protected" BEFORE UPDATE OR DELETE ON "EmployeeFinalPay" FOR EACH ROW EXECUTE FUNCTION "FinalPay_protect"();
CREATE FUNCTION "FinalPay_history_immutable"() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'Final pay audit and payment history is append-only'; END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;
CREATE TRIGGER "FinalPayAudit_immutable" BEFORE UPDATE OR DELETE ON "EmployeeFinalPayAudit" FOR EACH ROW EXECUTE FUNCTION "FinalPay_history_immutable"();
CREATE TRIGGER "FinalPayAudit_no_truncate" BEFORE TRUNCATE ON "EmployeeFinalPayAudit" FOR EACH STATEMENT EXECUTE FUNCTION "FinalPay_history_immutable"();
CREATE TRIGGER "FinalPayPayment_immutable" BEFORE UPDATE OR DELETE ON "EmployeeFinalPayPayment" FOR EACH ROW EXECUTE FUNCTION "FinalPay_history_immutable"();
CREATE TRIGGER "FinalPayPayment_no_truncate" BEFORE TRUNCATE ON "EmployeeFinalPayPayment" FOR EACH STATEMENT EXECUTE FUNCTION "FinalPay_history_immutable"();
CREATE TRIGGER "FinalPay_no_truncate" BEFORE TRUNCATE ON "EmployeeFinalPay" FOR EACH STATEMENT EXECUTE FUNCTION "FinalPay_history_immutable"();
CREATE FUNCTION "FinalPayPayment_validate"() RETURNS TRIGGER AS $$
DECLARE approved DECIMAL(12,2); recorded DECIMAL(12,2); state TEXT; boundary DATE;
BEGIN
 SELECT "netAmount","status","separationDate" INTO approved,state,boundary FROM "EmployeeFinalPay" WHERE "id"=NEW."finalPayId" AND "organizationId"=NEW."organizationId" FOR UPDATE;
 IF state IS DISTINCT FROM 'FINALIZED' OR NEW."paidOn"<boundary THEN RAISE EXCEPTION 'Only approved final pay accepts payment after separation'; END IF;
 SELECT COALESCE(sum("amount"),0) INTO recorded FROM "EmployeeFinalPayPayment" WHERE "finalPayId"=NEW."finalPayId" AND "organizationId"=NEW."organizationId";
 IF recorded+NEW."amount">approved THEN RAISE EXCEPTION 'Payment exceeds approved outstanding amount'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;
CREATE TRIGGER "FinalPayPayment_valid" BEFORE INSERT ON "EmployeeFinalPayPayment" FOR EACH ROW EXECUTE FUNCTION "FinalPayPayment_validate"();
COMMIT;
