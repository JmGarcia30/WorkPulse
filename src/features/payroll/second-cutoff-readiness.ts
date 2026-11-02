import { Prisma, type PayrollPeriod } from '@prisma/client';
import { allocateContribution, StatutoryContributionError, type ContributionAllocation, type ContributionResult } from './statutory';
import { statutoryEntryIssue } from './statutory-integration';

/** Read-only preflight. Generation still validates and reserves under its own locks. */
export async function secondCutoffContributionIssue(db: Prisma.TransactionClient, input: {
  organizationId: string;
  employeeId: string;
  period: PayrollPeriod;
  liabilities: ContributionResult[];
}): Promise<string | null> {
  const { organizationId, employeeId, period, liabilities } = input;
  const contributionMonth = period.periodStart.toISOString().slice(0, 7);
  const missing = 'First-cutoff contribution history is missing. Generate and finalize the first cutoff before this second cutoff.';
  const invalid = 'First-cutoff contribution history is invalid. Review its employee, month, agency allocations and finalized payroll before this second cutoff.';
  const month = await db.payrollContributionMonth.findUnique({
    where: { organizationId_employeeId_contributionMonth: { organizationId, employeeId, contributionMonth } },
    include: { allocations: { include: { posting: { include: { entry: { include: { payrollPeriod: true } } } } } } },
  });
  if (!month || month.allocations.length === 0) return missing;
  if (month.frequency !== 'SEMI_MONTHLY' || month.allocations.length !== 3) return invalid;
  const first = month.allocations[0].posting;
  const firstPeriod = first.entry.payrollPeriod;
  if (first.entry.status !== 'FINALIZED' || firstPeriod.status !== 'FINALIZED') {
    return 'Finalize the first cutoff payroll before calculating this second cutoff.';
  }
  if (!firstPeriod.finalizedAt || first.organizationId !== organizationId || first.employeeId !== employeeId
    || first.entry.organizationId !== organizationId || first.entry.employeeId !== employeeId
    || firstPeriod.organizationId !== organizationId
    || firstPeriod.periodStart.toISOString().slice(0, 10) !== `${contributionMonth}-01`
    || firstPeriod.periodEnd.toISOString().slice(0, 10) !== `${contributionMonth}-15`
    || first.payDate.getTime() !== firstPeriod.payDate.getTime() || first.payDate >= period.payDate
    || first.payDate < firstPeriod.periodEnd
    || month.allocations.some(item => item.postingId !== first.id || item.frequency !== 'SEMI_MONTHLY' || item.slot !== 'FIRST')
    || new Set(month.allocations.map(item => item.agency)).size !== 3
    || liabilities.some(liability => !month.allocations.some(item => item.agency === liability.agency))) return invalid;
  try {
    // Check persisted amounts/snapshots as well as the allocation's own scope and totals.
    if (await statutoryEntryIssue(db, first.entry)) return invalid;
    for (const liability of liabilities) {
      const stored = month.allocations.find(item => item.agency === liability.agency)!;
      const saved = stored.allocation as unknown as ContributionAllocation;
      const amounts = (value: { employee: Prisma.Decimal; employer: Prisma.Decimal; employerOnly: Prisma.Decimal }) => ({
        employee: new Prisma.Decimal(value.employee), employer: new Prisma.Decimal(value.employer), employerOnly: new Prisma.Decimal(value.employerOnly),
      });
      const prior = { ...saved, ...amounts(saved), employerTotal: new Prisma.Decimal(saved.employerTotal), totalRemittance: new Prisma.Decimal(saved.totalRemittance), components: saved.components.map(item => ({ ...item, ...amounts(item) })) };
      allocateContribution(liability, { organizationId, employeeId, frequency: 'SEMI_MONTHLY', slot: 'SECOND', priorAllocations: [prior] });
    }
  } catch (error) {
    if (error instanceof StatutoryContributionError || error instanceof TypeError
      || error instanceof Error && error.message.includes('[DecimalError]')) return invalid;
    throw error;
  }
  return null;
}
