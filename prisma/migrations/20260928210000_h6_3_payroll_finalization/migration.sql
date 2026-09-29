ALTER TABLE "PayrollPeriod"
ADD COLUMN "finalizedById" TEXT,
ADD COLUMN "finalizedAt" TIMESTAMP(3);

CREATE INDEX "PayrollPeriod_finalizedById_idx" ON "PayrollPeriod"("finalizedById");
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_finalizedById_fkey"
FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "PayrollEntry_prevent_finalized_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'FINALIZED' THEN
    RAISE EXCEPTION 'Finalized PayrollEntry is immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PayrollEntry_finalized_immutable"
BEFORE UPDATE OR DELETE ON "PayrollEntry"
FOR EACH ROW EXECUTE FUNCTION "PayrollEntry_prevent_finalized_mutation"();

CREATE OR REPLACE FUNCTION "PayrollPeriod_prevent_finalized_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'FINALIZED' THEN
    RAISE EXCEPTION 'Finalized PayrollPeriod is immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PayrollPeriod_finalized_immutable"
BEFORE UPDATE OR DELETE ON "PayrollPeriod"
FOR EACH ROW EXECUTE FUNCTION "PayrollPeriod_prevent_finalized_mutation"();
