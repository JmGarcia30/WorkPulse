import { Prisma } from '@prisma/client';
import { classifyCashEarnings, type BenefitHistory, type CashEarning } from './earnings';
import { assessBirTable } from './table';
import { BIR_SOURCES, type TaxFrequency } from './rules';
import { date, fail, money, requiredText, validateTableContext, type TaxMoney } from './validation';

export interface BirStatutoryDeduction {
  organizationId: string;
  employeeId: string;
  periodId: string;
  contributionMonth: string;
  agency: 'SSS' | 'PHILHEALTH' | 'PAGIBIG';
  employeeShare: TaxMoney;
  treatment: 'MANDATORY_EMPLOYEE_SHARE' | 'REVIEWED_EXEMPT';
  /** Reference to the verified allocation/coverage decision; never an arbitrary organization rate. */
  reference: string;
  legalBasis?: string;
}

export interface BirWithholdingInput {
  organizationId: string;
  employeeId: string;
  periodId: string;
  currency: 'PHP';
  frequency: TaxFrequency;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  earningsComplete: true;
  /** Control total of cash earnings AFTER pay reductions, BEFORE deductions below. */
  grossCompensation: TaxMoney;
  earnings: readonly CashEarning[];
  benefitHistory: BenefitHistory;
  profile: {
    residency: 'RESIDENT_CITIZEN_OR_RESIDENT_ALIEN';
    employment: 'PRIVATE_RANK_AND_FILE_SINGLE_EMPLOYER';
    minimumWageStatus: 'NOT_MWE';
    previousEmployerInTaxYear: false;
    cumulativeMethodAlreadyRequired: false;
    annualizationRequired: false;
    finalPayment: false;
  };
  /** All three agencies explicitly resolved for THIS period; only mandatory employee shares. */
  statutoryDeductions: readonly BirStatutoryDeduction[];
  unionDues: { amount: TaxMoney; reference: string };
  /** Voluntary savings, loans and other net deductions do not reduce the taxable base. */
  otherNetDeductions: readonly { id: string; amount: TaxMoney; reference: string }[];
}

function validateInput(input: BirWithholdingInput): void {
  for (const key of ['organizationId', 'employeeId', 'periodId'] as const) requiredText(input[key], key);
  validateTableContext(input.payDate, input.frequency);
  if (input.currency !== 'PHP') fail('UNSUPPORTED_CURRENCY', 'BIR bases must be PHP.');
  if (input.earningsComplete !== true) fail('INCOMPLETE_INPUT', 'Complete earnings must be explicitly confirmed.');
  const start = date(input.periodStart), end = date(input.periodEnd);
  if (input.periodEnd < input.periodStart || input.payDate < input.periodEnd) fail('UNSUPPORTED_PERIOD', 'Only completed periods paid on/after period end are supported.');
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const sameMonth = input.periodStart.slice(0, 7) === input.periodEnd.slice(0, 7);
  const matches = input.frequency === 'MONTHLY'
    ? start.getUTCDate() === 1 && end.getUTCDate() === monthEnd
    : (start.getUTCDate() === 1 && end.getUTCDate() === 15) || (start.getUTCDate() === 16 && end.getUTCDate() === monthEnd);
  if (!sameMonth || !matches) fail('UNSUPPORTED_PERIOD', 'Use a full calendar month or a conventional 1-15 / 16-month-end cutoff.');
  const profile = input.profile;
  if (!profile) fail('INCOMPLETE_PROFILE', 'Tax residency, employment and MWE status must be resolved.');
  if (profile.residency !== 'RESIDENT_CITIZEN_OR_RESIDENT_ALIEN'
    || profile.employment !== 'PRIVATE_RANK_AND_FILE_SINGLE_EMPLOYER' || profile.minimumWageStatus !== 'NOT_MWE') {
    fail('UNSUPPORTED_TAX_PROFILE', 'MWE, special exemptions, nonresident, managerial fringe-benefit or other arrangements require review.');
  }
  for (const flag of ['previousEmployerInTaxYear', 'cumulativeMethodAlreadyRequired', 'annualizationRequired', 'finalPayment'] as const) {
    if (typeof profile[flag] !== 'boolean') fail('INCOMPLETE_PROFILE', `Resolve ${flag} explicitly.`);
    if (profile[flag] !== false) fail('EXCEPTIONAL_METHOD_REQUIRED', 'Cumulative/annualized or final-pay withholding requires a separate method.');
  }
  if (input.periodEnd.slice(5) === '12-31' || input.payDate.slice(5) === '12-31') {
    fail('EXCEPTIONAL_METHOD_REQUIRED', 'Calendar year-end requires annualization review.');
  }
}

/** Pure ordinary-period preview. Does not generate payroll, persist allocations or adjudicate exemptions. */
export function calculateBirWithholding(input: BirWithholdingInput) {
  validateInput(input);
  const earnings = classifyCashEarnings({ ...input, history: input.benefitHistory });
  const gross = money(input.grossCompensation, 'Gross compensation');
  if (!gross.eq(earnings.grossCompensation)) fail('UNRECONCILED_GROSS', 'Earnings do not reconcile to the declared gross compensation.');
  if (!Array.isArray(input.statutoryDeductions) || input.statutoryDeductions.length !== 3) fail('UNRESOLVED_STATUTORY', 'Resolve SSS, PhilHealth and Pag-IBIG employee shares explicitly.');
  const seen = new Set<string>();
  const statutory = input.statutoryDeductions.map(item => {
    if (!['SSS', 'PHILHEALTH', 'PAGIBIG'].includes(item.agency) || seen.has(item.agency)) fail('UNRESOLVED_STATUTORY', 'Exactly one resolved deduction per agency is required.');
    seen.add(item.agency);
    if (item.organizationId !== input.organizationId || item.employeeId !== input.employeeId || item.periodId !== input.periodId
      || item.contributionMonth !== input.periodStart.slice(0, 7)) fail('STATUTORY_SCOPE_MISMATCH', 'Statutory deductions must belong to this employee, organization, contribution month and period.');
    requiredText(item.reference, 'Statutory allocation reference');
    const amount = money(item.employeeShare, 'Mandatory employee statutory share');
    if (item.treatment === 'REVIEWED_EXEMPT') {
      requiredText(item.legalBasis, 'Statutory exemption legal basis');
      if (!amount.isZero()) fail('UNRESOLVED_STATUTORY', 'An exempt agency must have zero employee deduction.');
    } else if (item.treatment !== 'MANDATORY_EMPLOYEE_SHARE' || amount.lte(0)) {
      fail('UNRESOLVED_STATUTORY', 'A mandatory share must be resolved and positive; unsupported zero allocations require review.');
    }
    return { ...item, employeeShare: amount };
  });
  const employeeStatutoryContributions = statutory.reduce((total, item) => total.add(item.employeeShare), new Prisma.Decimal(0));
  if (!input.unionDues) fail('INCOMPLETE_INPUT', 'Union dues must be explicitly resolved, including zero.');
  requiredText(input.unionDues.reference, 'Union dues reference');
  const unionDues = money(input.unionDues.amount, 'Union dues');
  const regularTaxable = earnings.regularTaxableBeforeContributions.sub(employeeStatutoryContributions).sub(unionDues);
  if (regularTaxable.lt(0)) fail('UNSUPPORTED_DEDUCTION_ALLOCATION', 'Mandatory shares and union dues exceed regular taxable earnings; review allocation.');
  if (!Array.isArray(input.otherNetDeductions)) fail('INCOMPLETE_INPUT', 'Other net deductions must be supplied explicitly, including an empty list.');
  const deductionIds = new Set<string>();
  const otherDeductions = input.otherNetDeductions.map(item => {
    requiredText(item.id, 'Net deduction ID'); requiredText(item.reference, 'Net deduction reference');
    if (deductionIds.has(item.id)) fail('DUPLICATE_DEDUCTION', 'A net deduction may appear only once.');
    deductionIds.add(item.id);
    return { ...item, amount: money(item.amount, 'Net deduction') };
  });
  const otherNetDeductions = otherDeductions.reduce((total, item) => total.add(item.amount), new Prisma.Decimal(0));
  const assessment = assessBirTable({ payDate: input.payDate, frequency: input.frequency, taxableCompensation: regularTaxable, supplementaryCompensation: earnings.supplementaryTaxableCompensation });
  const totalEmployeeDeductions = employeeStatutoryContributions.add(unionDues).add(otherNetDeductions).add(assessment.withholdingTax);
  const netPay = gross.sub(totalEmployeeDeductions);
  if (netPay.lt(0)) fail('INSUFFICIENT_NET_PAY', 'Deductions exceed cash compensation; explicit adjustment handling is required.');
  // JSON-safe input copy: no retained caller references, no database snapshot mutation.
  const inputs = JSON.parse(JSON.stringify(input)) as Prisma.InputJsonObject;
  return {
    version: 'WORKPULSE-BIR-PHASE-2A-1', method: 'ORDINARY_PERIOD_TABLE' as const,
    inputs, sources: BIR_SOURCES, earnings, statutoryDeductions: statutory,
    grossCompensation: gross, nonTaxableBenefits: earnings.nonTaxableBenefits,
    taxableCompensationBeforeContributions: earnings.regularTaxableBeforeContributions.add(earnings.supplementaryTaxableCompensation),
    employeeStatutoryContributions, unionDues, regularTaxableCompensation: regularTaxable,
    supplementaryTaxableCompensation: earnings.supplementaryTaxableCompensation,
    taxableCompensation: assessment.taxableCompensation,
    nonTaxableCompensation: earnings.nonTaxableBenefits.add(employeeStatutoryContributions).add(unionDues),
    assessment, withholdingTax: assessment.withholdingTax, otherNetDeductions,
    totalEmployeeDeductions, netPay,
  };
}
