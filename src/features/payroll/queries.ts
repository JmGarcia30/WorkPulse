import { prisma } from '@/lib/db/prisma';
import { assessPayrollPeriod } from './review';

export async function getPayrollFoundation(organizationId: string, selectedPeriodId?: string) {
  const [employees, compensations, periods, policies, leaveTypes] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId, employeeStatus: 'ACTIVE' }, select: { id: true, employeeNumber: true, firstName: true, lastName: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    prisma.employeeCompensation.findMany({ where: { organizationId }, include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } } }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }] }),
    prisma.payrollPeriod.findMany({ where: { organizationId }, orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }] }),
    prisma.organizationPayrollPolicy.findMany({ where: { organizationId }, include: { createdBy: { select: { name: true } }, leaveTreatments: { include: { leaveType: { select: { code: true, name: true } } } } }, orderBy: { version: 'desc' } }),
    prisma.leaveType.findMany({ where: { organizationId, isActive: true }, select: { id: true, code: true, name: true, isPaid: true }, orderBy: { name: 'asc' } }),
  ]);
  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId) ?? periods[0] ?? null;
  const entries = selectedPeriod ? await prisma.payrollEntry.findMany({
    where: { organizationId, payrollPeriodId: selectedPeriod.id },
    include: {
      employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
      employeeCompensation: { select: { compensationType: true, baseRate: true, payFrequency: true, currency: true } },
    },
    orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
  }) : [];
  const review = selectedPeriod ? await assessPayrollPeriod(organizationId, selectedPeriod.id) : null;
  const today = new Date();
  const currentPolicy = policies.find(policy => policy.status === 'ACTIVE' && policy.effectiveFrom <= today && (!policy.effectiveTo || policy.effectiveTo >= today)) ?? null;
  return { employees, compensations, periods, selectedPeriod, entries, review, policies, currentPolicy, leaveTypes };
}
