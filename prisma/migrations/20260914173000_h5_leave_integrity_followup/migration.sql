-- H5 integrity follow-up: make approved-leave debit idempotency database-enforced.
CREATE UNIQUE INDEX IF NOT EXISTS "LeaveLedgerEntry_one_approved_debit_per_request"
ON "LeaveLedgerEntry"("leaveRequestId")
WHERE "entryType" = 'APPROVED_LEAVE';

-- Correct table-specific tenant validation without rewriting the original applied migration.
CREATE OR REPLACE FUNCTION "h5_assert_tenant_consistency"() RETURNS trigger AS $$
DECLARE related_org TEXT; related_type TEXT; related_employee TEXT;
BEGIN
  IF TG_TABLE_NAME = 'LeaveCycle' THEN
    SELECT "organizationId" INTO related_org FROM "LeaveType" WHERE "id" = NEW."leaveTypeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave cycle'; END IF;
  ELSIF TG_TABLE_NAME = 'LeaveRequest' THEN
    SELECT "organizationId" INTO related_org FROM "Employee" WHERE "id" = NEW."employeeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave employee'; END IF;
    SELECT "organizationId" INTO related_org FROM "LeaveType" WHERE "id" = NEW."leaveTypeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave type'; END IF;
    IF NEW."leaveCycleId" IS NOT NULL THEN
      SELECT "organizationId", "leaveTypeId" INTO related_org, related_type FROM "LeaveCycle" WHERE "id"=NEW."leaveCycleId";
      IF related_org IS DISTINCT FROM NEW."organizationId" OR related_type IS DISTINCT FROM NEW."leaveTypeId" THEN RAISE EXCEPTION 'Invalid leave cycle'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'LeaveRequestDay' THEN
    SELECT "organizationId", "employeeId" INTO related_org, related_employee FROM "LeaveRequest" WHERE "id"=NEW."leaveRequestId";
    IF related_org IS DISTINCT FROM NEW."organizationId" OR related_employee IS DISTINCT FROM NEW."employeeId" THEN RAISE EXCEPTION 'Invalid leave request day ownership'; END IF;
    SELECT "employeeId" INTO related_employee FROM "EmploymentRecord" WHERE "id"=NEW."employmentRecordId";
    IF related_employee IS DISTINCT FROM NEW."employeeId" THEN RAISE EXCEPTION 'Invalid leave employment record'; END IF;
  ELSIF TG_TABLE_NAME = 'LeaveLedgerEntry' THEN
    SELECT "organizationId" INTO related_org FROM "Employee" WHERE "id"=NEW."employeeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave ledger'; END IF;
    SELECT "organizationId" INTO related_org FROM "LeaveType" WHERE "id"=NEW."leaveTypeId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave ledger type'; END IF;
  ELSIF TG_TABLE_NAME IN ('LeaveRequestAudit','LeaveDocument') THEN
    SELECT "organizationId", "employeeId" INTO related_org, related_employee FROM "LeaveRequest" WHERE "id"=NEW."leaveRequestId";
    IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant leave child'; END IF;
    IF TG_TABLE_NAME='LeaveDocument' THEN
      IF related_employee IS DISTINCT FROM NEW."employeeId" THEN RAISE EXCEPTION 'Invalid leave document employee'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
