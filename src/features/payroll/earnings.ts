import { createHash } from 'node:crypto';
import { Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { PayrollError } from './domain';
import { parseStatutoryInput, statutoryInputSchema, categoryKinds } from './statutory-inputs';
import { lockPayrollEmployee, lockPayrollPeriod, payrollTransaction, type PayrollDb } from './transactions';
import { jsonValue } from './statutory-integration';

export const earningsVersion = (payload: unknown) => createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const earningSchema = statutoryInputSchema.shape.additionalEarnings.element.extend({
  description: z.string().trim().min(1).max(200),
  category: z.enum(['OVERTIME', 'BONUS', 'COMMISSION', 'ALLOWANCE', 'THIRTEENTH_MONTH', 'OTHER']),
  supportingReference: z.string().trim().min(1).max(300),
  qualificationReference: z.string().trim().min(1).max(500),
});
export type EarningInput = z.input<typeof earningSchema>;
export function validateCustomEarning(value: unknown) {
  const parsed = earningSchema.safeParse(value);
  if (!parsed.success) throw new PayrollError('INVALID_EARNING', 'Enter a description, positive PHP amount, supporting reference and approved payroll classification evidence.');
  const row = parsed.data;
  if (row.id === 'BASIC_SALARY' || !new Prisma.Decimal(row.amount).gt(0)) throw new PayrollError('INVALID_EARNING', 'An earning requires a unique reference and an amount greater than zero.');
  if (!categoryKinds[row.category].includes(row.kind)) throw new PayrollError('UNSUPPORTED_CLASSIFICATION', 'The approved classification does not match this earning type. Reimbursements and unclassified payments require separate review.');
  return row;
}

type ChangeInput = { organizationId: string; actorUserId: string; employeeId: string; payrollPeriodId: string; expectedVersion: string; reason: string; confirmRecalculation: boolean };
/** Explicitly release only this unfinished entry's reservations, retaining its entire old snapshot. */
async function invalidateDraft(tx: Prisma.TransactionClient, input: ChangeInput, payDate: Date) {
  const entry = await tx.payrollEntry.findFirst({ where: { organizationId: input.organizationId, payrollPeriodId: input.payrollPeriodId, employeeId: input.employeeId }, include: { statutoryPosting: true } });
  if (!entry) return null;
  if (entry.status === 'FINALIZED') throw new PayrollError('IMMUTABLE', 'Finalized earnings cannot be changed.');
  if (!input.confirmRecalculation) throw new PayrollError('CONFIRMATION_REQUIRED', 'Confirm that this unfinished calculation must be generated and reviewed again.');
  if (!entry.statutoryPosting) throw new PayrollError('UNSUPPORTED_HISTORY', 'This historical entry has no verified ledger. Use the existing adjustment review process.');
  if (await tx.payrollStatutoryPosting.count({ where: { organizationId: input.organizationId, employeeId: input.employeeId, payrollEntryId: { not: entry.id }, payDate: { gte: payDate } } })) throw new PayrollError('DEPENDENT_PAYROLL', 'A later payroll depends on this calculation. Resolve it before recalculating this period.');
  await tx.payrollContributionAllocation.deleteMany({ where: { postingId: entry.statutoryPosting.id } });
  await tx.payrollStatutoryPosting.delete({ where: { id: entry.statutoryPosting.id } });
  await tx.payrollEntry.delete({ where: { id: entry.id } });
  return jsonValue(entry);
}

export async function changePayrollEarning(input: ChangeInput & { operation: 'SAVE' | 'REMOVE' | 'RECALCULATE'; earning?: unknown; earningId?: string; agencyReview?: { monthlySssRemuneration: string; monthlyPagIbigFundSalary: string; agencyBasisReference: string } }, db: PayrollDb = prisma) {
  if (!input.reason.trim()) throw new PayrollError('REFERENCE_REQUIRED', 'A reason or supporting reference is required.');
  const earning = input.operation === 'SAVE' ? validateCustomEarning(input.earning) : null;
  return payrollTransaction(db, async tx => {
    if (!await tx.user.findFirst({ where: { id: input.actorUserId, organizationId: input.organizationId, role: { in: [Role.HR_ADMIN, Role.ORGANIZATION_ADMIN] } } })) throw new PayrollError('FORBIDDEN', 'Unauthorized to manage earnings.');
    await lockPayrollPeriod(tx, input.organizationId, input.payrollPeriodId);
    await lockPayrollEmployee(tx, input.organizationId, input.employeeId);
    const period = await tx.payrollPeriod.findFirst({ where: { id: input.payrollPeriodId, organizationId: input.organizationId } });
    if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period unavailable.');
    if (period.status === 'FINALIZED') throw new PayrollError('IMMUTABLE', 'Finalized earnings cannot be changed.');
    if (!await tx.employee.findFirst({ where: { id: input.employeeId, organizationId: input.organizationId, employeeStatus: 'ACTIVE' } })) throw new PayrollError('NOT_FOUND', 'Employee unavailable in this organization.');
    const stored = await tx.payrollStatutoryInput.findUnique({ where: { organizationId_employeeId_payrollPeriodId: { organizationId: input.organizationId, employeeId: input.employeeId, payrollPeriodId: period.id } } });
    if (!stored) throw new PayrollError('SETUP_REQUIRED', 'Verify this employee’s statutory setup in Advanced Settings before adding earnings.');
    if (earningsVersion(stored.payload) !== input.expectedVersion) throw new PayrollError('STALE_INPUT', 'Payroll inputs changed or this request was already submitted. Refresh before continuing.');
    const payload = parseStatutoryInput(stored.payload);
    if (input.operation !== 'RECALCULATE') {
      if (!input.agencyReview?.agencyBasisReference.trim()) throw new PayrollError('SETUP_REQUIRED', 'Reverify the SSS remuneration and Pag-IBIG fund salary including these earnings.');
      Object.assign(payload, input.agencyReview);
    }
    const rows = payload.additionalEarnings;
    const prior = rows.find(row => row.id === (earning?.id ?? input.earningId));
    if (input.operation === 'REMOVE' && !prior) throw new PayrollError('NOT_FOUND', 'Earning not found.');
    if (earning) {
      // Reference uniqueness spans this employee's periods, protecting against repeat payments.
      const history = await tx.payrollStatutoryInput.findMany({ where: { organizationId: input.organizationId, employeeId: input.employeeId } });
      const normalize = (s: string) => s.trim().toLowerCase();
      for (const record of history) {
        const items = parseStatutoryInput(record.payload).additionalEarnings;
        if (items.some(row => (record.payrollPeriodId !== period.id || row.id !== earning.id) && row.supportingReference && normalize(row.supportingReference) === normalize(earning.supportingReference))) throw new PayrollError('DUPLICATE_EARNING', 'This supporting reference is already recorded for the employee. Use a unique approved payment reference.');
      }
      payload.additionalEarnings = [...rows.filter(row => row.id !== earning.id), { ...earning, createdById: prior?.createdById ?? input.actorUserId, updatedById: input.actorUserId }];
    } else if (input.operation === 'REMOVE') payload.additionalEarnings = rows.filter(row => row.id !== input.earningId);
    parseStatutoryInput(payload);
    const previousEntry = await invalidateDraft(tx, input, period.payDate);
    await tx.payrollInputRevision.create({ data: { organizationId: input.organizationId, employeeId: input.employeeId, payrollPeriodId: period.id, actorUserId: input.actorUserId, reason: input.reason.trim(), before: stored.payload as Prisma.InputJsonObject, after: jsonValue(payload), ...(previousEntry ? { previousEntry } : {}) } });
    await tx.payrollStatutoryInput.update({ where: { id: stored.id }, data: { payload: jsonValue(payload), reviewedById: input.actorUserId } });
    return { requiresGeneration: true };
  });
}
