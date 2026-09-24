import { prisma } from '@/lib/db/prisma';

export async function getPayrollFoundation(organizationId: string) {
  const [employees, compensations, periods] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId, employeeStatus: 'ACTIVE' }, select: { id: true, employeeNumber: true, firstName: true, lastName: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    prisma.employeeCompensation.findMany({ where: { organizationId }, include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } } }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }] }),
    prisma.payrollPeriod.findMany({ where: { organizationId }, orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }] }),
  ]);
  return { employees, compensations, periods };
}
