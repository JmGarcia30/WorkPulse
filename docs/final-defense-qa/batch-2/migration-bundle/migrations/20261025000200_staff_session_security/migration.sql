-- Additive security state only. Existing staff JWTs intentionally require login again.
-- No password, employee, attendance, payroll, or existing migration data is rewritten.
BEGIN;
CREATE TABLE "StaffSession" (
  "tokenHash" CHAR(64) NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffSession_token_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "StaffSession_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "StaffSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StaffSession_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StaffSession_organizationId_userId_idx" ON "StaffSession"("organizationId", "userId");
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");

-- Revocation occurs in the same transaction as every existing password/role change,
-- including activation, administrator changes, and updates outside Server Actions.
CREATE FUNCTION "revoke_staff_sessions_for_user_change"() RETURNS trigger AS $$
BEGIN
  DELETE FROM "StaffSession" WHERE "userId" = OLD."id";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;
CREATE TRIGGER "User_revoke_staff_sessions" AFTER UPDATE OF "passwordHash", "role", "organizationId" ON "User"
FOR EACH ROW WHEN (OLD."passwordHash" IS DISTINCT FROM NEW."passwordHash" OR OLD."role" IS DISTINCT FROM NEW."role" OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId")
EXECUTE FUNCTION "revoke_staff_sessions_for_user_change"();

CREATE FUNCTION "revoke_staff_sessions_for_account_change"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM "StaffSession" WHERE "userId" = OLD."userId";
    RETURN OLD;
  END IF;
  DELETE FROM "StaffSession" WHERE "userId" IN (OLD."userId", NEW."userId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;
CREATE TRIGGER "EmployeeAccount_revoke_staff_sessions" AFTER UPDATE OF "status", "userId", "employeeId", "organizationId" ON "EmployeeAccount"
FOR EACH ROW WHEN (OLD."status" IS DISTINCT FROM NEW."status" OR OLD."userId" IS DISTINCT FROM NEW."userId" OR OLD."employeeId" IS DISTINCT FROM NEW."employeeId" OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId")
EXECUTE FUNCTION "revoke_staff_sessions_for_account_change"();
CREATE TRIGGER "EmployeeAccount_delete_staff_sessions" AFTER DELETE ON "EmployeeAccount"
FOR EACH ROW EXECUTE FUNCTION "revoke_staff_sessions_for_account_change"();

CREATE FUNCTION "revoke_staff_sessions_for_employee_change"() RETURNS trigger AS $$
BEGIN
  DELETE FROM "StaffSession" WHERE "userId" IN (SELECT "userId" FROM "EmployeeAccount" WHERE "employeeId" = OLD."id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;
CREATE TRIGGER "Employee_revoke_staff_sessions" AFTER UPDATE OF "employeeStatus" ON "Employee"
FOR EACH ROW WHEN (OLD."employeeStatus" IS DISTINCT FROM NEW."employeeStatus")
EXECUTE FUNCTION "revoke_staff_sessions_for_employee_change"();
COMMIT;
