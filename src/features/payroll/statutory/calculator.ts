import { Prisma } from '@prisma/client';
import { SSS_2025_BRACKETS, STATUTORY_SCHEDULES, STATUTORY_VERIFIED_ON } from './schedules';

export type Agency = keyof typeof STATUTORY_SCHEDULES;
export type Money = string | Prisma.Decimal;
export type Coverage =
  | { status: 'MANDATORY' }
  | { status: 'EXEMPT'; legalBasis: string; evidenceReference: string; reviewedBy: string };

export class StatutoryContributionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'StatutoryContributionError';
  }
}

export interface ContributionContext {
  /** Applicable contribution month, never the pay date. */
  contributionMonth: string;
  currency: 'PHP';
  /** Coverage and monthly bases must already be resolved by the caller. */
  arrangement: 'PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH';
  coverage: Coverage;
}

export interface ContributionAmounts {
  employee: Prisma.Decimal;
  /** Employer counterpart, excluding employer-only charges. */
  employer: Prisma.Decimal;
  employerOnly: Prisma.Decimal;
}

export interface ContributionComponent extends ContributionAmounts {
  code: 'SSS_REGULAR' | 'SSS_MPF' | 'SSS_EC' | 'PHILHEALTH_PREMIUM' | 'PAGIBIG_REGULAR';
}

export interface ContributionResult extends ContributionAmounts {
  agency: Agency;
  contributionMonth: string;
  currency: 'PHP';
  status: 'CALCULATED' | 'EXEMPT';
  schedule: (typeof STATUTORY_SCHEDULES)[Agency];
  verifiedOn: string;
  inputBasis: Prisma.Decimal | null;
  assessedBasis: Prisma.Decimal | null;
  components: readonly ContributionComponent[];
  employerTotal: Prisma.Decimal;
  totalRemittance: Prisma.Decimal;
  exemption: Extract<Coverage, { status: 'EXEMPT' }> | null;
}

function fail(code: string, message: string): never {
  throw new StatutoryContributionError(code, message);
}

export function validateContributionMonth(month: string): void {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000')) {
    fail('INVALID_MONTH', 'Contribution month must be a valid YYYY-MM.');
  }
}

function context(agency: Agency, input: ContributionContext): void {
  validateContributionMonth(input.contributionMonth);
  const schedule = STATUTORY_SCHEDULES[agency];
  if (input.contributionMonth < schedule.effectiveFrom || input.contributionMonth > schedule.verifiedThrough) {
    fail('UNVERIFIED_SCHEDULE', `No verified ${agency} schedule covers ${input.contributionMonth}.`);
  }
  if (input.currency !== 'PHP') fail('UNSUPPORTED_CURRENCY', 'Statutory bases must be resolved in PHP.');
  if (input.arrangement !== 'PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH') {
    fail('UNSUPPORTED_ARRANGEMENT', 'Resolve special, partial-month, or multiple-employer arrangements separately.');
  }
  if (input.coverage?.status === 'EXEMPT') {
    for (const value of [input.coverage.legalBasis, input.coverage.evidenceReference, input.coverage.reviewedBy]) {
      if (typeof value !== 'string' || !value.trim()) fail('UNRESOLVED_COVERAGE', 'Exemption requires a legal basis, evidence reference, and reviewer.');
    }
  } else if (input.coverage?.status !== 'MANDATORY') {
    fail('UNRESOLVED_COVERAGE', 'Mandatory contribution coverage must be explicitly resolved.');
  }
}

function basis(value: Money): Prisma.Decimal {
  if (!(typeof value === 'string' && value.trim() !== '') && !Prisma.Decimal.isDecimal(value)) {
    fail('UNRESOLVED_BASIS', 'Supply the resolved monthly agency basis as a decimal string or Prisma.Decimal.');
  }
  let amount: Prisma.Decimal;
  try { amount = new Prisma.Decimal(value); } catch { return fail('INVALID_BASIS', 'Invalid monthly basis.'); }
  if (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 2 || amount.gt('9999999999.99')) {
    fail('INVALID_BASIS', 'Monthly basis must be positive PHP centavos within Decimal(12,2); zero requires coverage review.');
  }
  return amount;
}

function component(code: ContributionComponent['code'], employee: Money, employer: Money, employerOnly: Money = '0'): ContributionComponent {
  return { code, employee: new Prisma.Decimal(employee), employer: new Prisma.Decimal(employer), employerOnly: new Prisma.Decimal(employerOnly) };
}

function result(agency: Agency, input: ContributionContext, inputBasis: Prisma.Decimal | null, assessedBasis: Prisma.Decimal | null, components: ContributionComponent[]): ContributionResult {
  const employee = components.reduce((sum, item) => sum.add(item.employee), new Prisma.Decimal(0));
  const employer = components.reduce((sum, item) => sum.add(item.employer), new Prisma.Decimal(0));
  const employerOnly = components.reduce((sum, item) => sum.add(item.employerOnly), new Prisma.Decimal(0));
  return {
    agency, contributionMonth: input.contributionMonth, currency: 'PHP',
    status: input.coverage.status === 'EXEMPT' ? 'EXEMPT' : 'CALCULATED',
    schedule: STATUTORY_SCHEDULES[agency], verifiedOn: STATUTORY_VERIFIED_ON,
    inputBasis, assessedBasis, components, employee, employer, employerOnly,
    employerTotal: employer.add(employerOnly), totalRemittance: employee.add(employer).add(employerOnly),
    exemption: input.coverage.status === 'EXEMPT' ? { ...input.coverage } : null,
  };
}

export function calculateSss(input: ContributionContext & { monthlyCompensation: Money }): ContributionResult {
  context('SSS', input);
  if (input.coverage.status === 'EXEMPT') return result('SSS', input, null, null, []);
  const amount = basis(input.monthlyCompensation);
  const row = SSS_2025_BRACKETS.find(item => amount.gte(item.lowerInclusive) && (item.upperExclusive === null || amount.lt(item.upperExclusive)));
  if (!row) return fail('UNRESOLVED_BASIS', 'No SSS salary bracket matches.');
  return result('SSS', input, amount, new Prisma.Decimal(row.monthlySalaryCredit), [
    component('SSS_REGULAR', row.employeeRegular, row.employerRegular),
    component('SSS_MPF', row.employeeProvident, row.employerProvident),
    component('SSS_EC', '0', '0', row.employerEc),
  ]);
}

/** Official rounding guidance: round total first, then give the odd centavo to employer. */
export function splitPhilHealthPremium(total: Prisma.Decimal): ContributionAmounts {
  if (!total.isFinite() || total.lt(0)) return fail('INVALID_AMOUNT', 'Premium must be nonnegative and finite.');
  const rounded = total.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const employee = rounded.div(2).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  return { employee, employer: rounded.sub(employee), employerOnly: new Prisma.Decimal(0) };
}

export function calculatePhilHealth(input: ContributionContext & { monthlyBasicSalary: Money }): ContributionResult {
  context('PHILHEALTH', input);
  if (input.coverage.status === 'EXEMPT') return result('PHILHEALTH', input, null, null, []);
  const amount = basis(input.monthlyBasicSalary);
  const assessed = Prisma.Decimal.min(Prisma.Decimal.max(amount, '10000'), '100000');
  const shares = splitPhilHealthPremium(assessed.mul('0.05'));
  return result('PHILHEALTH', input, amount, assessed, [component('PHILHEALTH_PREMIUM', shares.employee, shares.employer)]);
}

export function calculatePagIbig(input: ContributionContext & { monthlyFundSalary: Money }): ContributionResult {
  context('PAGIBIG', input);
  if (input.coverage.status === 'EXEMPT') return result('PAGIBIG', input, null, null, []);
  const amount = basis(input.monthlyFundSalary);
  const assessed = Prisma.Decimal.min(amount, '10000');
  const employee = assessed.mul(amount.lte('1500') ? '0.01' : '0.02');
  const employer = assessed.mul('0.02');
  // Circular 460 gives rates, but no sub-centavo rounding rule. Do not guess one.
  if (employee.decimalPlaces() > 2 || employer.decimalPlaces() > 2) {
    fail('ROUNDING_UNVERIFIED', 'Pag-IBIG fractional-centavo rounding needs agency confirmation; no amount returned.');
  }
  return result('PAGIBIG', input, amount, assessed, [component('PAGIBIG_REGULAR', employee, employer)]);
}
