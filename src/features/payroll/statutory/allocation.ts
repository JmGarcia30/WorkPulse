import { Prisma } from '@prisma/client';
import { type Agency, type ContributionAmounts, type ContributionComponent, type ContributionResult, StatutoryContributionError } from './calculator';

export interface ContributionAllocation extends ContributionAmounts {
  organizationId: string;
  employeeId: string;
  contributionMonth: string;
  agency: Agency;
  frequency: 'MONTHLY' | 'SEMI_MONTHLY';
  slot: 'MONTH' | 'FIRST' | 'SECOND';
  /** Persist under a unique constraint/transaction in Phase 2, together with scope. */
  allocationKey: string;
  policy: 'MONTHLY_ONCE_OR_HALF_THEN_RECONCILE_V1';
  components: readonly ContributionComponent[];
  employerTotal: Prisma.Decimal;
  totalRemittance: Prisma.Decimal;
}

function fail(message: string): never {
  throw new StatutoryContributionError('INVALID_ALLOCATION', message);
}

/** Pure preview; the caller must supply the complete persisted month ledger, including retries. */
export function allocateContribution(monthly: ContributionResult, input: {
  organizationId: string;
  employeeId: string;
  frequency: 'MONTHLY' | 'SEMI_MONTHLY';
  slot: 'MONTH' | 'FIRST' | 'SECOND';
  priorAllocations: readonly ContributionAllocation[];
}): ContributionAllocation {
  if (!input.organizationId?.trim() || !input.employeeId?.trim()) fail('Organization and employee are required.');
  if (!Array.isArray(input.priorAllocations)) fail('Supply the complete month allocation ledger explicitly.');
  if (!(input.frequency === 'MONTHLY' && input.slot === 'MONTH')
    && !(input.frequency === 'SEMI_MONTHLY' && (input.slot === 'FIRST' || input.slot === 'SECOND'))) {
    fail('Unsupported frequency or cutoff. Biweekly is not semi-monthly.');
  }
  const prior: readonly ContributionAllocation[] = input.priorAllocations;
  for (const item of prior) {
    if (item.organizationId !== input.organizationId || item.employeeId !== input.employeeId
      || item.agency !== monthly.agency || item.contributionMonth !== monthly.contributionMonth) {
      fail('Ledger must contain only this organization, employee, agency, and contribution month.');
    }
    if (item.frequency !== input.frequency) fail('Cannot switch allocation frequency within a contribution month.');
    if (item.slot === input.slot) fail('This contribution cutoff is already allocated.');
    for (const share of ['employee', 'employer', 'employerOnly'] as const) {
      const total = item.components.reduce((sum, line) => {
        const amount = line[share];
        if (!Prisma.Decimal.isDecimal(amount) || !amount.isFinite() || amount.lt(0) || amount.decimalPlaces() > 2) {
          fail('Prior allocations must contain nonnegative Decimal centavos.');
        }
        return sum.add(amount);
      }, new Prisma.Decimal(0));
      if (!Prisma.Decimal.isDecimal(item[share]) || !total.eq(item[share])) fail('Prior allocation totals do not match components.');
    }
    if (!item.employerTotal.eq(item.employer.add(item.employerOnly))
      || !item.totalRemittance.eq(item.employee.add(item.employerTotal))) fail('Prior allocation totals do not reconcile.');
  }
  if (input.slot === 'SECOND') {
    if (prior.length !== 1 || prior[0].slot !== 'FIRST') fail('Second cutoff requires exactly one posted first cutoff.');
  } else if (prior.length !== 0) fail('First/monthly cutoff requires an empty month ledger.');

  if (prior[0] && (prior[0].components.length !== monthly.components.length
    || new Set(prior[0].components.map(item => item.code)).size !== monthly.components.length)) {
    fail('Prior components do not match the monthly calculation; coverage changes need review.');
  }
  const components = monthly.components.map(item => {
    const previous = prior[0]?.components.find(candidate => candidate.code === item.code);
    if (prior[0] && !previous) fail('Prior components do not match the monthly calculation.');
    const shares = {} as ContributionAmounts;
    for (const share of ['employee', 'employer', 'employerOnly'] as const) {
      const already = previous?.[share] ?? new Prisma.Decimal(0);
      if (!Prisma.Decimal.isDecimal(already) || !already.isFinite() || already.lt(0) || already.decimalPlaces() > 2) {
        fail('Prior allocations must contain nonnegative Decimal centavos.');
      }
      if (already.gt(item[share])) fail('Previous allocations exceed the monthly liability; adjustment review required.');
      shares[share] = input.slot === 'FIRST'
        ? item[share].div(2).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN)
        : item[share].sub(already);
    }
    return { code: item.code, ...shares };
  });
  const sum = (share: keyof ContributionAmounts) => components.reduce((total, item) => total.add(item[share]), new Prisma.Decimal(0));
  const employee = sum('employee'), employer = sum('employer'), employerOnly = sum('employerOnly');
  return {
    organizationId: input.organizationId, employeeId: input.employeeId,
    contributionMonth: monthly.contributionMonth, agency: monthly.agency,
    frequency: input.frequency, slot: input.slot,
    allocationKey: JSON.stringify([input.organizationId, input.employeeId, monthly.contributionMonth, monthly.agency, input.slot]),
    policy: 'MONTHLY_ONCE_OR_HALF_THEN_RECONCILE_V1',
    components, employee, employer, employerOnly,
    employerTotal: employer.add(employerOnly), totalRemittance: employee.add(employer).add(employerOnly),
  };
}
