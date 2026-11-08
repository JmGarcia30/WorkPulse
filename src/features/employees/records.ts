import { Prisma } from '@prisma/client';

// Shared by recruitment conversion and direct registration. No invented
// application, applicant, offer, payroll setup or probation decision is created.
export async function createEmployeeWithEmployment(tx: Prisma.TransactionClient, input: {
  employee: Prisma.EmployeeUncheckedCreateInput;
  employment: Omit<Prisma.EmploymentRecordUncheckedCreateInput, 'employeeId'>;
}) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-registration:${input.employee.organizationId}`},0))::text`;
  const duplicate = await tx.employee.findFirst({ where: {
    organizationId: input.employee.organizationId, email: { equals: input.employee.email, mode: 'insensitive' },
    ...(input.employee.sourceApplicationId ? { sourceApplicationId: null } : {}),
  }, select: { id: true } });
  if (duplicate) throw new Error('EMPLOYEE_EMAIL_EXISTS');
  const employee = await tx.employee.create({ data: input.employee });
  const employmentRecord = await tx.employmentRecord.create({ data: { ...input.employment, employeeId: employee.id } });
  return { employee, employmentRecord };
}
