import { Prisma } from '@prisma/client';

type EmployeeAlert = {
  kind: 'compensation' | 'setup';
  id: string;
  firstName: string;
  lastName: string;
  department: string | null;
};

// Each category keeps its existing ten-row bound and eligibility predicate.
// Department is a scalar projection, not an Employee -> EmploymentRecord graph.
// Match Prisma's implicit ID ordering before LIMIT as well as preview order.
export async function readDashboardEmployeeAlerts(
  db: Prisma.TransactionClient,
  organizationId: string,
  payrollAccess: boolean,
  hrAccess: boolean,
) {
  if (!payrollAccess && !hrAccess) return [] as EmployeeAlert[];
  return db.$queryRaw<EmployeeAlert[]>(Prisma.sql`
    WITH missing_compensation AS (
      SELECT e."id", e."firstName", e."lastName"
      FROM "Employee" e
      WHERE ${payrollAccess} AND e."organizationId" = ${organizationId}
        AND e."employeeStatus" = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM "EmployeeCompensation" c
          WHERE c."employeeId" = e."id" AND c."status" = 'ACTIVE')
      ORDER BY e."id" ASC LIMIT 10
    ), incomplete_setup AS (
      SELECT e."id", e."firstName", e."lastName"
      FROM "Employee" e
      WHERE ${hrAccess} AND e."organizationId" = ${organizationId}
        AND e."employeeStatus" = 'ACTIVE'
        AND (NOT EXISTS (SELECT 1 FROM "EmploymentRecord" r WHERE r."employeeId" = e."id")
          OR NOT EXISTS (SELECT 1 FROM "EmployeeAccount" a WHERE a."employeeId" = e."id"))
      ORDER BY e."id" ASC LIMIT 10
    )
    SELECT e.*, latest."department"
    FROM (
      SELECT 'compensation' AS kind, * FROM missing_compensation
      UNION ALL
      SELECT 'setup' AS kind, * FROM incomplete_setup
    ) e
    LEFT JOIN LATERAL (
      SELECT r."department" FROM "EmploymentRecord" r
      WHERE r."employeeId" = e."id"
      ORDER BY r."effectiveFrom" DESC LIMIT 1
    ) latest ON TRUE
    ORDER BY e.kind ASC, e."id" ASC
  `);
}
