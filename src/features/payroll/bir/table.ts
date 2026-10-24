import { Prisma } from '@prisma/client';
import { BIR_ANNEX_E, BIR_SOURCES, BIR_VERIFIED_ON, type TaxFrequency } from './rules';
import { fail, money, validateTableContext, type TaxMoney } from './validation';

/** Mathematical table assessment only. Payroll must use calculateBirWithholding for input/method validation. */
export function assessBirTable(input: { payDate: string; frequency: TaxFrequency; taxableCompensation: TaxMoney; supplementaryCompensation?: TaxMoney }) {
  validateTableContext(input.payDate, input.frequency);
  const taxable = money(input.taxableCompensation, 'Taxable compensation');
  const supplementary = money(input.supplementaryCompensation === undefined ? '0' : input.supplementaryCompensation, 'Supplementary compensation');
  const brackets = BIR_ANNEX_E[input.frequency];
  if (supplementary.gt(0) && (taxable.lte(brackets[1].threshold) || supplementary.gte(taxable))) {
    fail('EXCEPTIONAL_METHOD_REQUIRED', 'Supplementary compensation requires the cumulative average method in this case.');
  }
  // Whole-peso printed ranges are continuous through the centavo before the next threshold.
  let index = 0;
  for (let i = 1; i < brackets.length; i++) if (taxable.gte(brackets[i].threshold)) index = i;
  if (taxable.eq(brackets[1].threshold)) index = 0; // "and below" zero-tax boundary
  const row = brackets[index];
  // RR 11-2018 section 2.79(B)(3), steps 3-4: select bracket using regular pay,
  // then apply that bracket to regular plus supplementary pay (see Illustration 9).
  const excess = taxable.add(supplementary).sub(row.threshold);
  const unroundedTax = new Prisma.Decimal(row.fixedTax).add(excess.mul(row.rate));
  return {
    tableVersion: BIR_ANNEX_E.version, effectiveFrom: BIR_ANNEX_E.effectiveFrom,
    verifiedOn: BIR_VERIFIED_ON, sourceUrl: BIR_SOURCES.annexE,
    payDate: input.payDate, frequency: input.frequency, taxableCompensation: taxable.add(supplementary),
    regularTaxableCompensation: taxable, supplementaryTaxableCompensation: supplementary,
    bracket: { number: index + 1, threshold: new Prisma.Decimal(row.threshold), fixedTax: new Prisma.Decimal(row.fixedTax), rate: new Prisma.Decimal(row.rate) },
    excess, unroundedTax, withholdingTax: unroundedTax.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    rounding: 'FINAL_TAX_HALF_UP_CENTAVO' as const,
  };
}
