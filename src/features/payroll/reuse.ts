import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError } from './domain';
import { statutoryInputSchema, savePayrollStatutoryInput } from './statutory-inputs';
import { lockPayrollEmployee, lockPayrollPeriod, payrollTransaction, type PayrollDb } from './transactions';

/** Only finalized evidence for the very same compensation can seed another period. */
export async function reusablePayrollSetup(db: Prisma.TransactionClient, organizationId: string, employeeId: string, period: { id: string; periodStart: Date; periodEnd: Date; payDate: Date }) {
  const compensation = await db.employeeCompensation.findMany({ where: { organizationId, employeeId, status: 'ACTIVE', effectiveFrom: { lte: period.periodStart }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.periodEnd } }] } });
  if (compensation.length !== 1) return null;
  const source = await db.payrollStatutoryInput.findFirst({
    where: { organizationId, employeeId, period: { status: 'FINALIZED', payDate: { lt: period.payDate, gte: new Date(Date.UTC(period.payDate.getUTCFullYear(), 0, 1)) }, payrollEntries: { some: { organizationId, employeeId, employeeCompensationId: compensation[0].id, status: 'FINALIZED' } } } },
    include: { period: { select: { name: true, payDate: true } } }, orderBy: { period: { payDate: 'desc' } },
  });
  if (!source) return null;
  const parsed = statutoryInputSchema.safeParse(source.payload);
  if (!parsed.success) return null;
  const payload = parsed.data;
  if (!new Prisma.Decimal(payload.monthlyPhilHealthBasic).eq(compensation[0].baseRate)) return null;
  return { sourceId: source.id, periodName: source.period.name, payload, evidenceReference: source.evidenceReference };
}

export async function reusePayrollSetup(input: { organizationId: string; actorUserId: string; employeeId: string; payrollPeriodId: string; sourceId: string; confirmed: boolean }, db: PayrollDb = prisma) {
  if (!input.confirmed) throw new PayrollError('SETUP_REQUIRED', 'Review current earnings, coverage, tax classification and contribution history before reusing setup.');
  return payrollTransaction(db, async tx => {
    await lockPayrollPeriod(tx, input.organizationId, input.payrollPeriodId);
    await lockPayrollEmployee(tx, input.organizationId, input.employeeId);
    const period = await tx.payrollPeriod.findFirst({ where: { organizationId: input.organizationId, id: input.payrollPeriodId } });
    if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period unavailable.');
    const saved = await tx.payrollStatutoryInput.count({ where: { organizationId: input.organizationId, employeeId: input.employeeId, payrollPeriodId: period.id } });
    if (saved) throw new PayrollError('IMMUTABLE', 'This period already has reviewed setup. Review it in Advanced Payroll Setup.');
    const source = await reusablePayrollSetup(tx, input.organizationId, input.employeeId, period);
    if (!source || source.sourceId !== input.sourceId) throw new PayrollError('SETUP_REQUIRED', 'Verified setup or compensation changed. Review Advanced Payroll Setup before continuing.');
    return savePayrollStatutoryInput({ ...input, payload: source.payload, evidenceReference: `Reconfirmed from ${source.sourceId}: ${source.evidenceReference}` }, tx);
  });
}
