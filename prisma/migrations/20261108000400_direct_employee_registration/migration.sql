-- Preserve existing recruitment links; direct registrations need neither record.
ALTER TABLE "Employee" ALTER COLUMN "sourceApplicationId" DROP NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "applicantId" DROP NOT NULL;
ALTER TABLE "Employee" ADD COLUMN "registrationKey" TEXT;
CREATE UNIQUE INDEX "Employee_registrationKey_key" ON "Employee"("registrationKey");
CREATE UNIQUE INDEX "Employee_direct_email_key" ON "Employee"("organizationId", lower(trim("email"))) WHERE "sourceApplicationId" IS NULL;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_recruitment_source_pair" CHECK (("sourceApplicationId" IS NULL) = ("applicantId" IS NULL));

CREATE OR REPLACE FUNCTION "h4_assert_account_consistency"() RETURNS trigger AS $$
DECLARE related_org TEXT; linked_role "Role";
BEGIN
 SELECT "organizationId", "role" INTO related_org, linked_role FROM "User" WHERE "id" = NEW."userId";
 IF related_org IS DISTINCT FROM NEW."organizationId" OR linked_role NOT IN ('EMPLOYEE','HR_ADMIN','FINANCE_OFFICER','ORGANIZATION_HEAD') THEN
  RAISE EXCEPTION 'Invalid employee account user or tenant';
 END IF;
 SELECT "organizationId" INTO related_org FROM "Employee" WHERE "id" = NEW."employeeId";
 IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Cross-tenant employee account link'; END IF;
 SELECT "organizationId" INTO related_org FROM "User" WHERE "id" = NEW."createdById" AND (TG_OP = 'UPDATE' OR "role" IN ('ORGANIZATION_ADMIN','HR_ADMIN'));
 IF related_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Invalid employee account creator'; END IF;
 IF TG_OP = 'UPDATE' AND (NEW."organizationId",NEW."userId",NEW."employeeId",NEW."createdById") IS DISTINCT FROM (OLD."organizationId",OLD."userId",OLD."employeeId",OLD."createdById") THEN
  RAISE EXCEPTION 'Employee account ownership is immutable';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "employee_link_user_guard"() RETURNS trigger AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "EmployeeAccount" a WHERE a."userId" = NEW."id" AND
   (a."organizationId" IS DISTINCT FROM NEW."organizationId" OR NEW."role" NOT IN ('EMPLOYEE','HR_ADMIN','FINANCE_OFFICER','ORGANIZATION_HEAD'))) THEN
  RAISE EXCEPTION 'Linked employee account user role and tenant must remain eligible';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;
CREATE TRIGGER "employee_link_user_guard" BEFORE UPDATE OF "role","organizationId" ON "User" FOR EACH ROW EXECUTE FUNCTION "employee_link_user_guard"();
