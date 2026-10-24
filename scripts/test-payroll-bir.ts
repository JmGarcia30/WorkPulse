import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import {
  assessBirTable, calculateBirWithholding, BirCalculationError,
  type BirWithholdingInput, type BenefitHistory, type CashEarning, type TaxFrequency,
} from '../src/features/payroll/bir';
import { classifyCashEarnings } from '../src/features/payroll/bir/earnings';
import { allocateContribution, calculateSss, calculatePhilHealth, calculatePagIbig } from '../src/features/payroll/statutory';

const d = (value: string) => new Prisma.Decimal(value);
const rejects = (fn: () => unknown, code: string) => assert.throws(fn, (error: unknown) => error instanceof BirCalculationError && error.code === code);
function history(payDate = '2026-09-30'): BenefitHistory {
  return {
    organizationId: 'org', employeeId: 'employee', taxYear: payDate.slice(0, 4), paymentMonth: payDate.slice(0, 7),
    reference: 'complete-ledger-before-payment', completeBeforeCurrentPayment: true,
    riceExemptUsedThisMonth: '0', laundryExemptUsedThisMonth: '0', clothingExemptUsedThisYear: '0', otherBenefitsGrossPaidYtd: '0',
  };
}
function input(salary = '35000', frequency: TaxFrequency = 'MONTHLY'): BirWithholdingInput {
  return {
    organizationId: 'org', employeeId: 'employee', periodId: 'period', currency: 'PHP', frequency,
    periodStart: '2026-09-01', periodEnd: frequency === 'MONTHLY' ? '2026-09-30' : '2026-09-15',
    payDate: frequency === 'MONTHLY' ? '2026-09-30' : '2026-09-15',
    earningsComplete: true, grossCompensation: salary, earnings: [{ id: 'salary', kind: 'BASIC_SALARY', amount: salary }],
    benefitHistory: history(frequency === 'MONTHLY' ? '2026-09-30' : '2026-09-15'),
    profile: { residency: 'RESIDENT_CITIZEN_OR_RESIDENT_ALIEN', employment: 'PRIVATE_RANK_AND_FILE_SINGLE_EMPLOYER', minimumWageStatus: 'NOT_MWE', previousEmployerInTaxYear: false, cumulativeMethodAlreadyRequired: false, annualizationRequired: false, finalPayment: false },
    statutoryDeductions: (['SSS', 'PHILHEALTH', 'PAGIBIG'] as const).map((agency, index) => ({
      organizationId: 'org', employeeId: 'employee', periodId: 'period', contributionMonth: '2026-09', agency,
      employeeShare: (frequency === 'MONTHLY' ? ['1750', '875', '200'] : ['875', '437.50', '100'])[index],
      treatment: 'MANDATORY_EMPLOYEE_SHARE', reference: `${agency}-verified-allocation`,
    })),
    unionDues: { amount: '0', reference: 'confirmed-no-union-dues' }, otherNetDeductions: [],
  };
}
function withEarnings(earnings: CashEarning[], overrides: Partial<BirWithholdingInput> = {}) {
  return { ...input(), earnings, grossCompensation: earnings.reduce((total, item) => total.add(item.amount), d('0')), ...overrides };
}
function benefit(kind: CashEarning['kind'], amount: string, id: string = kind): CashEarning {
  return { id, kind, amount, qualificationReference: 'reviewed-benefit-entitlement' };
}

// Independent transcription of Annex E fixed amounts at every threshold, plus samples.
const officialRows: Record<TaxFrequency, readonly (readonly [string, string, string])[]> = {
  MONTHLY: [
    ['0', '0.00', '0.00'], ['20833', '0.00', '0.15'], ['33333', '1875.00', '0.20'],
    ['66667', '8541.80', '0.25'], ['166667', '33541.80', '0.30'], ['666667', '183541.80', '0.35'],
  ],
  SEMI_MONTHLY: [
    ['0', '0.00', '0.00'], ['10417', '0.00', '0.15'], ['16667', '937.50', '0.20'],
    ['33333', '4270.70', '0.25'], ['83333', '16770.70', '0.30'], ['333333', '91770.70', '0.35'],
  ],
};
for (const frequency of ['MONTHLY', 'SEMI_MONTHLY'] as const) {
  for (const [index, [threshold, fixedTax, rate]] of officialRows[frequency].entries()) {
    test(`${frequency} Annex E bracket ${index + 1}: exact threshold and adjacent centavos`, () => {
      const assess = (amount: string) => assessBirTable({ payDate: '2026-09-30', frequency, taxableCompensation: amount });
      const at = assess(threshold);
      assert.equal(at.withholdingTax.toFixed(2), fixedTax);
      assert.equal(at.bracket.number, index === 1 ? 1 : index + 1);
      if (index > 0) {
        const below = assess(d(threshold).sub('0.01').toFixed(2));
        const aboveCent = assess(d(threshold).add('0.01').toFixed(2));
        const [previousThreshold, previousFixed, previousRate] = officialRows[frequency][index - 1];
        assert.equal(below.bracket.number, index);
        assert(below.unroundedTax.eq(d(previousFixed).add(d(threshold).sub('0.01').sub(previousThreshold).mul(previousRate))));
        assert.equal(aboveCent.bracket.number, index + 1);
        assert(aboveCent.unroundedTax.eq(d(fixedTax).add(d('0.01').mul(rate))));
        assert.equal(below.withholdingTax.toFixed(2), fixedTax);
        assert.equal(aboveCent.withholdingTax.toFixed(2), fixedTax);
      }
      const above = assess(d(threshold).add('1').toFixed(2));
      assert.equal(above.withholdingTax.toFixed(2), d(fixedTax).add(rate).toFixed(2));
      assert.equal(above.bracket.number, index + 1);
      assert.equal(at.tableVersion, 'BIR-RR11-2018-ANNEX-E-2023');
      assert.equal(at.effectiveFrom, '2023-01-01');
    });
  }
}

for (const [frequency, amount, expected] of [
  ['MONTHLY', '20000', '0.00'], ['MONTHLY', '30000', '1375.05'], ['MONTHLY', '50000', '5208.40'],
  ['MONTHLY', '100000', '16875.05'], ['MONTHLY', '200000', '43541.70'], ['MONTHLY', '700000', '195208.35'],
  ['SEMI_MONTHLY', '10000', '0.00'], ['SEMI_MONTHLY', '15000', '687.45'], ['SEMI_MONTHLY', '25000', '2604.10'],
  ['SEMI_MONTHLY', '50000', '8437.45'], ['SEMI_MONTHLY', '100000', '21770.80'], ['SEMI_MONTHLY', '350000', '97604.15'],
] as const) test(`${frequency} bracket sample ${amount}`, () => {
  assert.equal(assessBirTable({ payDate: '2023-01-01', frequency, taxableCompensation: amount }).withholdingTax.toFixed(2), expected);
});

for (const [frequency, gross, taxable, expected] of [
  ['MONTHLY', '42825', '40000', '3208.40'],
  ['SEMI_MONTHLY', '21412.50', '20000', '1604.10'],
] as const) test(`${frequency} requested taxable compensation ${taxable} gives ${expected}`, () => {
  assert.equal(assessBirTable({ payDate: '2026-09-30', frequency, taxableCompensation: taxable }).withholdingTax.toFixed(2), expected);
  const value = calculateBirWithholding(input(gross, frequency));
  assert.equal(value.taxableCompensation.toFixed(2), d(taxable).toFixed(2));
  assert.equal(value.withholdingTax.toFixed(2), expected);
});

test('Ordinary supplemental calculation selects the REGULAR bracket (RR 11-2018 step 3 / Illustration 9)', () => {
  const value = assessBirTable({ payDate: '2026-09-30', frequency: 'MONTHLY', taxableCompensation: '165000', supplementaryCompensation: '5000' });
  assert.equal(value.bracket.number, 4);
  assert.equal(value.taxableCompensation.toFixed(2), '170000.00');
  assert.equal(value.withholdingTax.toFixed(2), '34375.05');
  // Illustration 9 uses 2018 rates and contains inconsistent printed totals; do not treat it as a 2023 numeric oracle.
  assert.equal(assessBirTable({ payDate: '2026-09-15', frequency: 'SEMI_MONTHLY', taxableCompensation: '15500' }).withholdingTax.toFixed(2), '762.45');
  // Same taxable input as official Illustration 8, repriced with Annex E (official 2018 tax was 1,016.60).
});

test('Half-cent final rounding is explicit and independent of Decimal global rounding mode', () => {
  const previous = Prisma.Decimal.rounding;
  try {
    Prisma.Decimal.set({ rounding: Prisma.Decimal.ROUND_DOWN });
    const value = assessBirTable({ payDate: '2026-09-30', frequency: 'MONTHLY', taxableCompensation: '66667.02' });
    assert.equal(value.unroundedTax.toString(), '8541.805');
    assert.equal(value.withholdingTax.toFixed(2), '8541.81');
    assert.equal(assessBirTable({ payDate: '2026-09-15', frequency: 'SEMI_MONTHLY', taxableCompensation: '10417.10' }).withholdingTax.toFixed(2), '0.02');
  } finally { Prisma.Decimal.set({ rounding: previous }); }
});

test('Gross / exemptions / mandatory shares / tax / net reconcile; inputs snapshotted without mutation', () => {
  const request = input(); const before = JSON.stringify(request);
  const value = calculateBirWithholding(request);
  assert.equal(value.employeeStatutoryContributions.toFixed(2), '2825.00');
  assert.equal(value.taxableCompensation.toFixed(2), '32175.00');
  assert.equal(value.withholdingTax.toFixed(2), '1701.30');
  assert.equal(value.netPay.toFixed(2), '30473.70');
  assert(value.grossCompensation.eq(value.taxableCompensation.add(value.nonTaxableCompensation)));
  assert(value.grossCompensation.eq(value.netPay.add(value.totalEmployeeDeductions)));
  assert.deepEqual(value.inputs, request);
  assert.equal(JSON.stringify(request), before);
  request.earnings = [];
  assert.equal((value.inputs.earnings as unknown[]).length, 1);
});

test('Semi-monthly uses period earnings and actual allocations, not half monthly tax', () => {
  const value = calculateBirWithholding(input('17500', 'SEMI_MONTHLY'));
  assert.equal(value.taxableCompensation.toFixed(2), '16087.50');
  assert.equal(value.withholdingTax.toFixed(2), '850.58');
  assert(!value.withholdingTax.eq(calculateBirWithholding(input()).withholdingTax.div(2)));
  const second = input('17500', 'SEMI_MONTHLY');
  second.periodStart = '2026-09-16'; second.periodEnd = '2026-09-30'; second.payDate = '2026-09-30';
  assert.equal(calculateBirWithholding(second).withholdingTax.toFixed(2), '850.58');
});

test('Zero-tax ordinary non-MWE pay is supported after mandatory deductions', () => {
  assert(calculateBirWithholding(input('20000')).withholdingTax.eq(0));
  assert(calculateBirWithholding(input('10000', 'SEMI_MONTHLY')).withholdingTax.eq(0));
});

test('Qualifying benefits are exempt within caps and do not consume the 90,000 pool', () => {
  const value = calculateBirWithholding(withEarnings([
    ...input().earnings, benefit('RICE_SUBSIDY', '2500'), benefit('CLOTHING_ALLOWANCE', '8000'), benefit('LAUNDRY_ALLOWANCE', '400'),
  ]));
  assert.equal(value.nonTaxableBenefits.toFixed(2), '10900.00');
  assert.equal(value.withholdingTax.toFixed(2), '1701.30');
  assert(value.earnings.closingBalances.otherBenefitsGrossPaidYtd.eq(0));
});

test('Regular fixed allowances remain taxable; overtime and commissions are supplementary', () => {
  const value = calculateBirWithholding(withEarnings([
    ...input().earnings, { id: 'fixed', kind: 'FIXED_ALLOWANCE', amount: '1000' },
    { id: 'ot', kind: 'OVERTIME', amount: '500' }, { id: 'commission', kind: 'COMMISSION', amount: '500' },
  ]));
  assert.equal(value.regularTaxableCompensation.toFixed(2), '33175.00');
  assert.equal(value.supplementaryTaxableCompensation.toFixed(2), '1000.00');
  assert.equal(value.withholdingTax.toFixed(2), '2001.30');
});

test('Exhausted 90,000 pool does not tax qualifying de minimis within its own ceilings', () => {
  const request = withEarnings([
    ...input().earnings, benefit('RICE_SUBSIDY', '2500'), benefit('CLOTHING_ALLOWANCE', '8000'), benefit('LAUNDRY_ALLOWANCE', '400'),
    benefit('THIRTEENTH_MONTH', '100'), benefit('QUALIFYING_OTHER_BENEFIT', '100'),
  ]);
  request.benefitHistory.otherBenefitsGrossPaidYtd = '90000';
  const value = calculateBirWithholding(request);
  assert(value.nonTaxableBenefits.eq('10900'));
  assert(value.supplementaryTaxableCompensation.eq('200'));
  assert(value.earnings.closingBalances.otherBenefitsGrossPaidYtd.eq('90200'));
});

test('Employer counterparts and employer-only EC cannot be labeled as statutory employee deductions', () => {
  for (const treatment of ['EMPLOYER_SHARE', 'EMPLOYER_ONLY_EC']) {
    const request = input();
    request.statutoryDeductions = request.statutoryDeductions.map((item, index) => index ? item : { ...item, treatment: treatment as never });
    rejects(() => calculateBirWithholding(request), 'UNRESOLVED_STATUTORY');
  }
});

test('Excess de minimis and 13th month share one annual pool; excess becomes supplementary', () => {
  const request = withEarnings([...input().earnings, benefit('THIRTEENTH_MONTH', '1000'), benefit('RICE_SUBSIDY', '3500')]);
  request.benefitHistory.otherBenefitsGrossPaidYtd = '89000';
  const value = calculateBirWithholding(request);
  assert.equal(value.nonTaxableBenefits.toFixed(2), '3500.00');
  assert.equal(value.supplementaryTaxableCompensation.toFixed(2), '1000.00');
  assert.equal(value.withholdingTax.toFixed(2), '1851.30');
  assert.equal(value.earnings.closingBalances.otherBenefitsGrossPaidYtd.toFixed(2), '91000.00');
});

test('Same-category multiple lines and semi-monthly history cannot duplicate a monthly exemption', () => {
  const request = withEarnings([...input().earnings, benefit('RICE_SUBSIDY', '1000', 'rice1'), benefit('RICE_SUBSIDY', '1000', 'rice2')]);
  request.benefitHistory.riceExemptUsedThisMonth = '2000';
  request.benefitHistory.otherBenefitsGrossPaidYtd = '90000';
  const value = calculateBirWithholding(request);
  assert(value.nonTaxableBenefits.eq('500'));
  assert(value.supplementaryTaxableCompensation.eq('1500'));
  assert(value.earnings.closingBalances.riceExemptUsedThisMonth.eq('2500'));
});

for (const [payDate, ruleVersion, rice, clothing, laundry] of [
  ['2023-01-01', 'RR11-2018', '2000', '6000', '300'],
  ['2025-02-13', 'RR11-2018', '2000', '6000', '300'],
  ['2025-02-14', 'RR4-2025', '2000', '7000', '300'],
  ['2026-01-05', 'RR4-2025', '2000', '7000', '300'],
  ['2026-01-06', 'RR29-2025', '2500', '8000', '400'],
  ['2026-10-22', 'RR29-2025', '2500', '8000', '400'],
]) test(`Benefit amendment effectivity ${payDate}`, () => {
  const value = classifyCashEarnings({ organizationId: 'org', employeeId: 'employee', payDate, history: history(payDate), earnings: [benefit('RICE_SUBSIDY', '5000'), benefit('CLOTHING_ALLOWANCE', '10000'), benefit('LAUNDRY_ALLOWANCE', '1000')] });
  assert.equal(value.ruleVersion, ruleVersion);
  assert.equal(value.lines[0].deMinimisExempt.toFixed(2), d(rice).toFixed(2));
  assert.equal(value.lines[1].deMinimisExempt.toFixed(2), d(clothing).toFixed(2));
  assert.equal(value.lines[2].deMinimisExempt.toFixed(2), d(laundry).toFixed(2));
});

test('Annual clothing exemption is not reset per cutoff or after a ceiling increase', () => {
  const request = withEarnings([...input().earnings, benefit('CLOTHING_ALLOWANCE', '2000')]);
  request.benefitHistory.clothingExemptUsedThisYear = '7000';
  request.benefitHistory.otherBenefitsGrossPaidYtd = '90000';
  const value = calculateBirWithholding(request);
  assert(value.nonTaxableBenefits.eq('1000')); assert(value.supplementaryTaxableCompensation.eq('1000'));
});

test('Union dues reduce the tax base; voluntary savings/loans reduce net only', () => {
  const request = input(); request.unionDues = { amount: '100', reference: 'union-ledger' };
  request.otherNetDeductions = [{ id: 'voluntary', amount: '500', reference: 'voluntary-savings' }, { id: 'loan', amount: '500', reference: 'loan' }];
  const value = calculateBirWithholding(request);
  assert(value.taxableCompensation.eq('32075')); assert(value.withholdingTax.eq('1686.30'));
  assert(value.netPay.eq('29388.70')); assert(value.otherNetDeductions.eq('1000'));
});

test('Every statutory agency must be present, unique, resolved, and scoped to this payment', () => {
  for (const agency of ['SSS', 'PHILHEALTH', 'PAGIBIG']) {
    const request = input(); request.statutoryDeductions = request.statutoryDeductions.filter(item => item.agency !== agency);
    rejects(() => calculateBirWithholding(request), 'UNRESOLVED_STATUTORY');
  }
  const request = input();
  rejects(() => calculateBirWithholding({ ...request, statutoryDeductions: [request.statutoryDeductions[0], request.statutoryDeductions[0], request.statutoryDeductions[2]] }), 'UNRESOLVED_STATUTORY');
  for (const key of ['organizationId', 'employeeId', 'periodId', 'contributionMonth'] as const) {
    rejects(() => calculateBirWithholding({ ...request, statutoryDeductions: request.statutoryDeductions.map((item, i) => i ? item : { ...item, [key]: 'wrong' }) }), 'STATUTORY_SCOPE_MISMATCH');
  }
  rejects(() => calculateBirWithholding({ ...request, statutoryDeductions: request.statutoryDeductions.map(item => ({ ...item, employeeShare: '0' })) }), 'UNRESOLVED_STATUTORY');
  rejects(() => calculateBirWithholding({ ...request, statutoryDeductions: undefined as never }), 'UNRESOLVED_STATUTORY');
});

test('Reviewed statutory exemptions require evidence and zero deduction', () => {
  const request = input(); request.statutoryDeductions = request.statutoryDeductions.map(item => ({ ...item, employeeShare: '0', treatment: 'REVIEWED_EXEMPT', legalBasis: 'reviewed-agency-exemption' }));
  assert(calculateBirWithholding(request).employeeStatutoryContributions.eq(0));
  rejects(() => calculateBirWithholding({ ...request, statutoryDeductions: request.statutoryDeductions.map(item => ({ ...item, legalBasis: '' })) }), 'INCOMPLETE_INPUT');
  rejects(() => calculateBirWithholding({ ...request, statutoryDeductions: request.statutoryDeductions.map(item => ({ ...item, employeeShare: '1' })) }), 'UNRESOLVED_STATUTORY');
});

test('Phase 1 mandatory employee allocations feed the preview without employer shares or EC', () => {
  const request = input('17500', 'SEMI_MONTHLY');
  const context = { contributionMonth: '2026-09', currency: 'PHP' as const, arrangement: 'PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH' as const, coverage: { status: 'MANDATORY' as const } };
  const monthly = [calculateSss({ ...context, monthlyCompensation: '35000' }), calculatePhilHealth({ ...context, monthlyBasicSalary: '35000' }), calculatePagIbig({ ...context, monthlyFundSalary: '35000' })];
  request.statutoryDeductions = monthly.map(result => {
    const allocation = allocateContribution(result, { organizationId: 'org', employeeId: 'employee', frequency: 'SEMI_MONTHLY', slot: 'FIRST', priorAllocations: [] });
    return { organizationId: 'org', employeeId: 'employee', periodId: 'period', contributionMonth: result.contributionMonth, agency: result.agency, employeeShare: allocation.employee, treatment: 'MANDATORY_EMPLOYEE_SHARE', reference: allocation.allocationKey };
  });
  const value = calculateBirWithholding(request);
  assert(value.employeeStatutoryContributions.eq('1412.50'));
  assert(value.withholdingTax.eq('850.58'));
  assert(value.netPay.eq('15236.92'));
});

test('Explicit zero cash pay with reviewed zero-share coverage is distinguishable from missing pay', () => {
  const request = input('0');
  request.statutoryDeductions = request.statutoryDeductions.map(item => ({ ...item, employeeShare: '0', treatment: 'REVIEWED_EXEMPT', legalBasis: 'reviewed-no-deduction-this-period' }));
  const value = calculateBirWithholding(request);
  assert(value.grossCompensation.eq(0)); assert(value.withholdingTax.eq(0)); assert(value.netPay.eq(0));
});

test('Missing history, wrong scope and excessive claimed exemptions fail', () => {
  const request = input();
  rejects(() => calculateBirWithholding({ ...request, benefitHistory: undefined as never }), 'INCOMPLETE_BENEFIT_HISTORY');
  for (const key of ['organizationId', 'employeeId', 'taxYear', 'paymentMonth'] as const) rejects(() => calculateBirWithholding({ ...request, benefitHistory: { ...request.benefitHistory, [key]: 'wrong' } }), 'INCOMPLETE_BENEFIT_HISTORY');
  rejects(() => calculateBirWithholding({ ...request, benefitHistory: { ...request.benefitHistory, completeBeforeCurrentPayment: false as never } }), 'INCOMPLETE_BENEFIT_HISTORY');
  rejects(() => calculateBirWithholding({ ...request, benefitHistory: { ...request.benefitHistory, riceExemptUsedThisMonth: '2500.01' } }), 'INVALID_BENEFIT_HISTORY');
});

test('Unsupported benefits and missing qualification cannot become tax-free compensation', () => {
  for (const kind of ['NON_TAXABLE', 'UNKNOWN', 'MWE_SALARY', 'RETIREMENT', 'HEALTH_EMERGENCY_ALLOWANCE', 'ACHIEVEMENT_AWARD', 'DEPENDENT_MEDICAL', 'MEAL_ALLOWANCE', 'NONCASH_FRINGE_BENEFIT']) {
    rejects(() => calculateBirWithholding(withEarnings([...input().earnings, { id: 'unsupported', kind: kind as never, amount: '100' }])), 'UNSUPPORTED_CLASSIFICATION');
  }
  rejects(() => calculateBirWithholding(withEarnings([...input().earnings, { id: 'rice', kind: 'RICE_SUBSIDY', amount: '100' }])), 'INCOMPLETE_INPUT');
  rejects(() => calculateBirWithholding(withEarnings([...input().earnings, ...input().earnings])), 'DUPLICATE_EARNING');
});

test('MWE, unknown profiles, previous employers and exceptional methods cannot return ordinary zero tax', () => {
  const request = input('20000');
  rejects(() => calculateBirWithholding({ ...request, profile: undefined as never }), 'INCOMPLETE_PROFILE');
  for (const minimumWageStatus of ['MWE', 'UNKNOWN', undefined]) rejects(() => calculateBirWithholding({ ...request, profile: { ...request.profile, minimumWageStatus: minimumWageStatus as never } }), 'UNSUPPORTED_TAX_PROFILE');
  for (const key of ['previousEmployerInTaxYear', 'cumulativeMethodAlreadyRequired', 'annualizationRequired', 'finalPayment'] as const) {
    rejects(() => calculateBirWithholding({ ...request, profile: { ...request.profile, [key]: true } as never }), 'EXCEPTIONAL_METHOD_REQUIRED');
    rejects(() => calculateBirWithholding({ ...request, profile: { ...request.profile, [key]: undefined } as never }), 'INCOMPLETE_PROFILE');
  }
  rejects(() => calculateBirWithholding({ ...request, profile: { ...request.profile, residency: 'NONRESIDENT' as never } }), 'UNSUPPORTED_TAX_PROFILE');
});

test('Current supplemental triggers require cumulative average method, including taxable benefit overflow', () => {
  rejects(() => calculateBirWithholding(withEarnings([{ id: 'salary', kind: 'BASIC_SALARY', amount: '20000' }, { id: 'ot', kind: 'OVERTIME', amount: '100' }])), 'EXCEPTIONAL_METHOD_REQUIRED');
  rejects(() => calculateBirWithholding(withEarnings([...input().earnings, { id: 'commission', kind: 'COMMISSION', amount: '35000' }])), 'EXCEPTIONAL_METHOD_REQUIRED');
  const request = withEarnings([{ id: 'salary', kind: 'BASIC_SALARY', amount: '20000' }, benefit('THIRTEENTH_MONTH', '1')]);
  request.benefitHistory.otherBenefitsGrossPaidYtd = '90000';
  rejects(() => calculateBirWithholding(request), 'EXCEPTIONAL_METHOD_REQUIRED');
});

test('Missing/inconsistent earnings, union dues, net deductions and unsafe balances fail', () => {
  const request = input();
  rejects(() => calculateBirWithholding({ ...request, earningsComplete: undefined as never }), 'INCOMPLETE_INPUT');
  rejects(() => calculateBirWithholding({ ...request, earnings: [] }), 'INCOMPLETE_INPUT');
  rejects(() => calculateBirWithholding({ ...request, grossCompensation: '35001' }), 'UNRECONCILED_GROSS');
  rejects(() => calculateBirWithholding({ ...request, unionDues: undefined as never }), 'INCOMPLETE_INPUT');
  rejects(() => calculateBirWithholding({ ...request, otherNetDeductions: undefined as never }), 'INCOMPLETE_INPUT');
  const loan = { id: 'loan', amount: '1', reference: 'loan' };
  rejects(() => calculateBirWithholding({ ...request, otherNetDeductions: [loan, loan] }), 'DUPLICATE_DEDUCTION');
  rejects(() => calculateBirWithholding({ ...request, otherNetDeductions: [{ ...loan, amount: '35000' }] }), 'INSUFFICIENT_NET_PAY');
  rejects(() => calculateBirWithholding(input('1000')), 'UNSUPPORTED_DEDUCTION_ALLOCATION');
});

test('Monetary inputs reject binary numbers, missing, negative, subcentavo, nonfinite and overflow amounts', () => {
  for (const amount of ['-1', '1.001', 'NaN', 'Infinity', '10000000000', 'invalid']) rejects(() => assessBirTable({ payDate: '2026-09-30', frequency: 'MONTHLY', taxableCompensation: amount }), 'INVALID_MONEY');
  for (const amount of ['', ' ', undefined, null, 10000]) rejects(() => assessBirTable({ payDate: '2026-09-30', frequency: 'MONTHLY', taxableCompensation: amount as never }), 'INCOMPLETE_INPUT');
  assert(assessBirTable({ payDate: '2026-09-30', frequency: 'MONTHLY', taxableCompensation: d('30000') }).withholdingTax.eq('1375.05'));
});

test('Effective date verification, calendar periods and tax payment dates are explicit', () => {
  for (const payDate of ['2022-12-31', '2026-10-23', '2027-01-01']) rejects(() => assessBirTable({ payDate, frequency: 'MONTHLY', taxableCompensation: '30000' }), 'UNVERIFIED_RULES');
  for (const payDate of ['2026-02-30', '', '2026-1-01']) rejects(() => assessBirTable({ payDate, frequency: 'MONTHLY', taxableCompensation: '30000' }), 'INVALID_DATE');
  rejects(() => calculateBirWithholding({ ...input(), frequency: 'BIWEEKLY' as never }), 'UNSUPPORTED_FREQUENCY');
  rejects(() => calculateBirWithholding({ ...input(), currency: 'USD' as never }), 'UNSUPPORTED_CURRENCY');
  rejects(() => calculateBirWithholding({ ...input(), periodStart: '2026-09-02' }), 'UNSUPPORTED_PERIOD');
  rejects(() => calculateBirWithholding({ ...input(), periodStart: '2026-08-01' }), 'UNSUPPORTED_PERIOD');
  rejects(() => calculateBirWithholding({ ...input(), payDate: '2026-09-15' }), 'UNSUPPORTED_PERIOD');
  const request = input(); request.payDate = '2026-10-15'; request.benefitHistory = history(request.payDate);
  assert.equal(calculateBirWithholding(request).assessment.payDate, '2026-10-15');
  const yearEnd = input(); yearEnd.periodStart = '2025-12-01'; yearEnd.periodEnd = '2025-12-31'; yearEnd.payDate = '2025-12-31';
  rejects(() => calculateBirWithholding(yearEnd), 'EXCEPTIONAL_METHOD_REQUIRED');
});
