import { Prisma } from '@prisma/client';
import { BENEFIT_RULES } from './rules';
import { fail, money, requiredText, type TaxMoney } from './validation';

export type EarningKind = 'BASIC_SALARY' | 'FIXED_ALLOWANCE' | 'OVERTIME' | 'COMMISSION'
  | 'THIRTEENTH_MONTH' | 'QUALIFYING_OTHER_BENEFIT' | 'RICE_SUBSIDY' | 'CLOTHING_ALLOWANCE' | 'LAUNDRY_ALLOWANCE';
export interface CashEarning {
  id: string;
  kind: EarningKind;
  amount: TaxMoney;
  /** Required for every benefit; the caller must establish eligibility, not just a label. */
  qualificationReference?: string;
}
export interface BenefitHistory {
  organizationId: string;
  employeeId: string;
  taxYear: string;
  paymentMonth: string;
  reference: string;
  /** Complete history BEFORE this payment, including other cutoffs and earlier employers if relevant. */
  completeBeforeCurrentPayment: true;
  riceExemptUsedThisMonth: TaxMoney;
  laundryExemptUsedThisMonth: TaxMoney;
  clothingExemptUsedThisYear: TaxMoney;
  otherBenefitsGrossPaidYtd: TaxMoney;
}

/** Internal classification step. No arbitrary "non-taxable" flag or general exemption passthrough. */
export function classifyCashEarnings(input: {
  organizationId: string; employeeId: string; payDate: string;
  earnings: readonly CashEarning[]; history: BenefitHistory;
}) {
  const history = input.history;
  if (!history || history.completeBeforeCurrentPayment !== true
    || history.organizationId !== input.organizationId || history.employeeId !== input.employeeId
    || history.taxYear !== input.payDate.slice(0, 4) || history.paymentMonth !== input.payDate.slice(0, 7)) {
    fail('INCOMPLETE_BENEFIT_HISTORY', 'Complete benefit history for this employee and payment year/month is required.');
  }
  requiredText(history.reference, 'Benefit history reference');
  const rule = BENEFIT_RULES.find(item => input.payDate >= item.effectiveFrom && input.payDate <= item.effectiveTo);
  if (!rule) return fail('UNVERIFIED_RULES', 'No benefit classification rule covers the payment date.');
  const balances = {
    riceExemptUsedThisMonth: money(history.riceExemptUsedThisMonth, 'Prior rice exemption'),
    laundryExemptUsedThisMonth: money(history.laundryExemptUsedThisMonth, 'Prior laundry exemption'),
    clothingExemptUsedThisYear: money(history.clothingExemptUsedThisYear, 'Prior clothing exemption'),
    otherBenefitsGrossPaidYtd: money(history.otherBenefitsGrossPaidYtd, 'Prior other benefits'),
  };
  if (balances.riceExemptUsedThisMonth.gt(rule.rice) || balances.laundryExemptUsedThisMonth.gt(rule.laundry)
    || balances.clothingExemptUsedThisYear.gt(rule.clothing)) fail('INVALID_BENEFIT_HISTORY', 'Prior exemptions exceed the effective statutory ceiling.');
  if (!Array.isArray(input.earnings) || !input.earnings.length) fail('INCOMPLETE_INPUT', 'Supply the complete earnings list, including explicit zero pay when applicable.');
  const seen = new Set<string>();
  const lines = input.earnings.map(earning => {
    requiredText(earning.id, 'Earning ID');
    if (seen.has(earning.id)) fail('DUPLICATE_EARNING', 'An earning may appear only once.');
    seen.add(earning.id);
    const amount = money(earning.amount, 'Earning amount');
    let regularTaxable = new Prisma.Decimal(0), supplementaryTaxable = new Prisma.Decimal(0);
    let deMinimisExempt = new Prisma.Decimal(0), otherBenefitsExempt = new Prisma.Decimal(0), benefitPoolAmount = new Prisma.Decimal(0);
    if (earning.kind === 'BASIC_SALARY' || earning.kind === 'FIXED_ALLOWANCE') regularTaxable = amount;
    else if (earning.kind === 'OVERTIME' || earning.kind === 'COMMISSION') supplementaryTaxable = amount;
    else {
      if (!['RICE_SUBSIDY', 'CLOTHING_ALLOWANCE', 'LAUNDRY_ALLOWANCE', 'THIRTEENTH_MONTH', 'QUALIFYING_OTHER_BENEFIT'].includes(earning.kind)) {
        fail('UNSUPPORTED_CLASSIFICATION', 'Unresolved or unsupported earning classification; no default taxable/exempt assumption.');
      }
      requiredText(earning.qualificationReference, 'Benefit qualification reference');
      if (earning.kind === 'THIRTEENTH_MONTH' || earning.kind === 'QUALIFYING_OTHER_BENEFIT') benefitPoolAmount = amount;
      else {
        const [key, cap] = earning.kind === 'RICE_SUBSIDY'
          ? ['riceExemptUsedThisMonth', rule.rice] as const
          : earning.kind === 'CLOTHING_ALLOWANCE' ? ['clothingExemptUsedThisYear', rule.clothing] as const
            : ['laundryExemptUsedThisMonth', rule.laundry] as const;
        const remaining = Prisma.Decimal.max(new Prisma.Decimal(cap).sub(balances[key]), 0);
        deMinimisExempt = Prisma.Decimal.min(amount, remaining);
        balances[key] = balances[key].add(deMinimisExempt);
        benefitPoolAmount = amount.sub(deMinimisExempt);
      }
      // Excess de minimis joins the SHARED 90,000 annual other-benefits pool.
      const remaining = Prisma.Decimal.max(new Prisma.Decimal('90000').sub(balances.otherBenefitsGrossPaidYtd), 0);
      otherBenefitsExempt = Prisma.Decimal.min(benefitPoolAmount, remaining);
      supplementaryTaxable = benefitPoolAmount.sub(otherBenefitsExempt);
      balances.otherBenefitsGrossPaidYtd = balances.otherBenefitsGrossPaidYtd.add(benefitPoolAmount);
    }
    return {
      id: earning.id, kind: earning.kind, amount, qualificationReference: earning.qualificationReference ?? null,
      regularTaxable, supplementaryTaxable, deMinimisExempt, otherBenefitsExempt,
      nonTaxable: deMinimisExempt.add(otherBenefitsExempt), benefitPoolAmount,
    };
  });
  const sum = (key: 'amount' | 'regularTaxable' | 'supplementaryTaxable' | 'nonTaxable') =>
    lines.reduce((total, line) => total.add(line[key]), new Prisma.Decimal(0));
  return {
    ruleVersion: rule.version, effectiveFrom: rule.effectiveFrom, historyReference: history.reference,
    lines, grossCompensation: sum('amount'), regularTaxableBeforeContributions: sum('regularTaxable'),
    supplementaryTaxableCompensation: sum('supplementaryTaxable'), nonTaxableBenefits: sum('nonTaxable'),
    closingBalances: balances,
  };
}
