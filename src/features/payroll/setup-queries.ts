import { Role, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError } from './domain';
import { openingSchema, statutoryInputSchema } from './statutory-inputs';

export async function getPayrollStatutorySetup(input: { organizationId: string; actorUserId: string; payrollPeriodId: string }, db: Prisma.TransactionClient = prisma) {
  const actor = await db.user.findFirst({ where: { id: input.actorUserId, organizationId: input.organizationId, role: { in: [Role.HR_ADMIN, Role.ORGANIZATION_ADMIN] } }, select: { id: true } });
  if (!actor) throw new PayrollError('FORBIDDEN', 'Unauthorized to review statutory setup.');
  const period = await db.payrollPeriod.findFirst({ where: { id: input.payrollPeriodId, organizationId: input.organizationId } });
  if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period unavailable in this organization.');
  const taxYear = period.payDate.toISOString().slice(0, 4);
  const [employees, inputs, openings, entries, usedOpenings] = await Promise.all([
    db.employee.findMany({ where: { organizationId: input.organizationId, employeeStatus: 'ACTIVE' }, select: { id: true, employeeNumber: true, firstName: true, lastName: true }, orderBy: [{ lastName: 'asc' }, { id: 'asc' }] }),
    db.payrollStatutoryInput.findMany({ where: { organizationId: input.organizationId, payrollPeriodId: period.id } }),
    db.payrollTaxOpening.findMany({ where: { organizationId: input.organizationId, taxYear } }),
    db.payrollEntry.findMany({ where: { organizationId: input.organizationId, payrollPeriodId: period.id }, select: { employeeId: true } }),
    db.payrollStatutoryPosting.findMany({ where: { organizationId: input.organizationId, taxYear }, distinct: ['employeeId'], select: { employeeId: true } }),
  ]);
  return employees.map(employee => {
    const saved = inputs.find(item => item.employeeId === employee.id), opening = openings.find(item => item.employeeId === employee.id);
    const payload = statutoryInputSchema.safeParse(saved?.payload), balances = openingSchema.safeParse(opening?.balances);
    return {
      ...employee, input: payload.success ? payload.data : null, inputEvidence: saved?.evidenceReference ?? '',
      opening: opening && balances.success ? { payDate: opening.openingPayDate.toISOString().slice(0, 10), balances: balances.data, evidence: opening.evidenceReference } : null,
      inputLocked: period.status === 'FINALIZED' || entries.some(item => item.employeeId === employee.id),
      openingLocked: period.status === 'FINALIZED' || usedOpenings.some(item => item.employeeId === employee.id),
      inputReviewedBy: saved?.reviewedById ?? null, openingReviewedBy: opening?.reviewedById ?? null,
    };
  });
}
export type PayrollStatutorySetupRow = Awaited<ReturnType<typeof getPayrollStatutorySetup>>[number];
