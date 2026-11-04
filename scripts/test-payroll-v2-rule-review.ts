import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Prisma } from '@prisma/client';
import { assessBirTable, calculateBirWithholding, BIR_VERIFIED_ON, BIR_VERIFIED_THROUGH, type BirWithholdingInput, type CashEarning } from '../src/features/payroll/bir';
import { calculateSss, calculatePhilHealth, calculatePagIbig } from '../src/features/payroll/statutory';
const checks: string[] = [], amounts: unknown[] = [];
const check = (value: unknown, label: string) => { assert(value, label); checks.push(label); console.log('PASS', label); };
const source = fs.readFileSync('docs/payroll-v2/review/official-wt-calculator.js', 'utf8');
function officialCalculator(regularTaxable: string, period: 'monthly' | 'semi_monthly') {
  const result = { value: '' };
  const sandbox = { document: { getElementById: (id: string) => id === 'payroll_period' ? { value: period } : result }, alert: () => {} };
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { timeout: 1000 });
  // Test-only execution of the unmodified official calculator; manual expected values remain constants.
  vm.runInContext(`getTotalRegular=()=>${regularTaxable};getTotalSupplementary=()=>0;getDailyZero=()=>0;getWeeklyZero=()=>0;getAnnual=()=>0;calculateForm();`, context, { timeout: 1000 });
  return result.value.replaceAll(',', '');
}
function input(frequency: 'MONTHLY' | 'SEMI_MONTHLY' = 'MONTHLY', second = false): BirWithholdingInput {
  const payDate = frequency === 'MONTHLY' || second ? '2026-11-30' : '2026-11-15';
  return {
    organizationId: 'review-org', employeeId: 'review-employee', periodId: 'review-period', currency: 'PHP', frequency,
    periodStart: second ? '2026-11-16' : '2026-11-01', periodEnd: payDate, payDate, earningsComplete: true,
    grossCompensation: frequency === 'MONTHLY' ? '35000' : '17500', earnings: [{ id: 'basic', kind: 'BASIC_SALARY', amount: frequency === 'MONTHLY' ? '35000' : '17500' }],
    benefitHistory: { organizationId: 'review-org', employeeId: 'review-employee', taxYear: '2026', paymentMonth: '2026-11', reference: 'reviewed-prior-history', completeBeforeCurrentPayment: true, riceExemptUsedThisMonth: '0', laundryExemptUsedThisMonth: '0', clothingExemptUsedThisYear: '0', otherBenefitsGrossPaidYtd: '0' },
    profile: { residency: 'RESIDENT_CITIZEN_OR_RESIDENT_ALIEN', employment: 'PRIVATE_RANK_AND_FILE_SINGLE_EMPLOYER', minimumWageStatus: 'NOT_MWE', previousEmployerInTaxYear: false, cumulativeMethodAlreadyRequired: false, annualizationRequired: false, finalPayment: false },
    statutoryDeductions: (['SSS', 'PHILHEALTH', 'PAGIBIG'] as const).map((agency, i) => ({ organizationId: 'review-org', employeeId: 'review-employee', periodId: 'review-period', contributionMonth: '2026-11', agency, employeeShare: (frequency === 'MONTHLY' ? ['1750', '875', '200'] : ['875', '437.50', '100'])[i], treatment: 'MANDATORY_EMPLOYEE_SHARE', reference: 'verified-' + agency })),
    unionDues: { amount: '0', reference: 'verified-none' }, otherNetDeductions: [],
  };
}
function amountCase(label: string, values: BirWithholdingInput, expected: { gross: string; tax: string; deductions: string; net: string; nonTaxableBenefits: string }) {
  const result = calculateBirWithholding(values);
  const actual = { gross: result.grossCompensation.toFixed(2), tax: result.withholdingTax.toFixed(2), deductions: result.totalEmployeeDeductions.toFixed(2), net: result.netPay.toFixed(2), nonTaxableBenefits: result.nonTaxableBenefits.toFixed(2) };
  assert.deepEqual(actual, expected); amounts.push({ label, expected, actual }); check(true, label); return result;
}
check(BIR_VERIFIED_ON === '2026-11-05' && BIR_VERIFIED_THROUGH === '2026-11-30', 'Review date is separate from the bounded November payment horizon');
const monthly = amountCase('November monthly basic', input(), { gross: '35000.00', tax: '1701.30', deductions: '4526.30', net: '30473.70', nonTaxableBenefits: '0.00' });
const first = amountCase('November first cutoff', input('SEMI_MONTHLY'), { gross: '17500.00', tax: '850.58', deductions: '2263.08', net: '15236.92', nonTaxableBenefits: '0.00' });
const second = amountCase('November second cutoff', input('SEMI_MONTHLY', true), { gross: '17500.00', tax: '850.58', deductions: '2263.08', net: '15236.92', nonTaxableBenefits: '0.00' });
check(monthly.assessment.unroundedTax.eq('1701.3') && first.assessment.unroundedTax.eq('850.575'), 'Unrounded manual withholding amounts are 1701.30 monthly and 850.575 per cutoff');
check(monthly.totalEmployeeDeductions.sub(first.totalEmployeeDeductions.add(second.totalEmployeeDeductions)).eq('0.14'), 'Two semimonthly deductions total 4526.16: exactly 0.14 below monthly deductions');
check(officialCalculator('32175', 'monthly') === '1701.30' && officialCalculator('16087.50', 'semi_monthly') === '850.58', 'Official BIR JavaScript independently confirms both withholding values and per-payment centavo rounding');
check(new Prisma.Decimal('32175').mul(12).sub('250000').mul('0.15').eq('20415') && monthly.withholdingTax.mul(12).eq('20415.60') && first.withholdingTax.mul(24).eq('20413.92'), 'Independent twelve-month illustration requires annual reconciliation: tax 20415.00 versus periodic totals 20415.60 / 20413.92');
const context = { contributionMonth: '2026-11', currency: 'PHP' as const, arrangement: 'PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH' as const, coverage: { status: 'MANDATORY' as const } };
const liabilities = [calculateSss({ ...context, monthlyCompensation: '35000' }), calculatePhilHealth({ ...context, monthlyBasicSalary: '35000' }), calculatePagIbig({ ...context, monthlyFundSalary: '35000' })];
check(liabilities.map(row => row.employee.toFixed(2)).join(',') === '1750.00,875.00,200.00', 'November agency shares match independently transcribed official amounts');
check(liabilities[0].employer.eq('3500') && liabilities[0].employerOnly.eq('30'), 'SSS employer counterpart and EC remain separate');
const bonus = input(); bonus.earnings = [...bonus.earnings, { id: 'bonus', kind: 'TAXABLE_BONUS', amount: '2000' }]; bonus.grossCompensation = '37000';
amountCase('November taxable bonus', bonus, { gross: '37000.00', tax: '2001.30', deductions: '4826.30', net: '32173.70', nonTaxableBenefits: '0.00' });
const benefits = input();
const lines: CashEarning[] = [{ id: 'rice', kind: 'RICE_SUBSIDY', amount: '3000', qualificationReference: 'verified-qualified-rice' }, { id: 'clothing', kind: 'CLOTHING_ALLOWANCE', amount: '8500', qualificationReference: 'verified-qualified-clothing' }, { id: 'laundry', kind: 'LAUNDRY_ALLOWANCE', amount: '450', qualificationReference: 'verified-qualified-laundry' }];
benefits.earnings = [...benefits.earnings, ...lines]; benefits.grossCompensation = '46950'; benefits.benefitHistory.otherBenefitsGrossPaidYtd = '90000';
const capped = amountCase('RR29 November caps with exhausted annual pool', benefits, { gross: '46950.00', tax: '1858.80', deductions: '4683.80', net: '42266.20', nonTaxableBenefits: '10900.00' });
check(capped.earnings.closingBalances.riceExemptUsedThisMonth.eq('2500') && capped.earnings.closingBalances.clothingExemptUsedThisYear.eq('8000') && capped.earnings.closingBalances.laundryExemptUsedThisMonth.eq('400'), 'RR29 rice 2500/month, clothing 8000/year and laundry 400/month caps are enforced');
const thirteenth = input(); thirteenth.earnings = [...thirteenth.earnings, { id: '13th', kind: 'THIRTEENTH_MONTH', amount: '1000', qualificationReference: 'verified-13th-month-entitlement' }]; thirteenth.grossCompensation = '36000'; thirteenth.benefitHistory.otherBenefitsGrossPaidYtd = '89900';
amountCase('13th-month shared pool with only 100 remaining', thirteenth, { gross: '36000.00', tax: '1836.30', deductions: '4661.30', net: '31338.70', nonTaxableBenefits: '100.00' });
for (const unsupported of ['CBA_PRODUCTIVITY', 'MEDICAL_ASSISTANCE', 'CHRISTMAS_GIFT']) {
  const values = input(); values.earnings = [{ id: 'unsupported', kind: unsupported as CashEarning['kind'], amount: '35000', qualificationReference: 'unimplemented-category' }];
  assert.throws(() => calculateBirWithholding(values), /unsupported earning classification/i); check(true, `${unsupported} cannot silently use another RR29 exemption`);
}
assert.throws(() => calculateBirWithholding({ ...input(), profile: { ...input().profile, annualizationRequired: true as false } }), /separate method/); check(true, 'Annualization remains an explicit blocker');
assert.throws(() => calculateBirWithholding({ ...input(), benefitHistory: { ...input().benefitHistory, completeBeforeCurrentPayment: false as true } }), /Complete benefit history/); check(true, 'Incomplete benefit history still blocks exemptions');
for (const payDate of ['2026-12-01', '2027-01-01']) { assert.throws(() => assessBirTable({ payDate, frequency: 'MONTHLY', taxableCompensation: '32175' }), /No verified BIR/); check(true, `${payDate} remains outside the verified BIR window`); }
assert.throws(() => calculateSss({ ...context, contributionMonth: '2026-12', monthlyCompensation: '35000' }), /No verified/); check(true, 'December agency schedule remains unverified');
const originalMode = Prisma.Decimal.rounding;
try { Prisma.Decimal.set({ rounding: Prisma.Decimal.ROUND_DOWN }); assert.equal(calculateBirWithholding(input('SEMI_MONTHLY')).withholdingTax.toFixed(2), '850.58'); } finally { Prisma.Decimal.set({ rounding: originalMode }); }
check(true, 'Withholding rounding does not depend on global Decimal rounding mode');
fs.writeFileSync('docs/payroll-v2/review/rule-tests.json', JSON.stringify({ passed: true, checks, amounts, officialReference: { calculator: 'https://web-services.bir.gov.ph/tax_calculator/js/wt_calculator.js', monthly: '1701.30', semimonthly: '850.58' } }, null, 2));
