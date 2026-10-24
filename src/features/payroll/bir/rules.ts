/** Official government rules; no organization percentage overrides. */
export const BIR_VERIFIED_ON = '2026-10-22';
export const BIR_SOURCES = Object.freeze({
  regulation: 'https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%2011-2018.pdf',
  annexE: 'https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf',
  rr4: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%204-2025.pdf',
  rr29: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2029-2025.pdf',
  rr29Digest: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2029-2025%20digest%20FINAL.pdf',
  publicationIndex: 'https://www.bir.gov.ph/2025-Revenue-Regulations',
  calculator: 'https://web-services.bir.gov.ph/tax_calculator/wt_calculator.html',
});
export type TaxFrequency = 'MONTHLY' | 'SEMI_MONTHLY';
export interface TaxBracket {
  threshold: string;
  fixedTax: string;
  rate: string;
}
const rows = (values: readonly (readonly [string, string, string])[]): readonly Readonly<TaxBracket>[] =>
  Object.freeze(values.map(([threshold, fixedTax, rate]) => Object.freeze({ threshold, fixedTax, rate })));

export const BIR_ANNEX_E = Object.freeze({
  version: 'BIR-RR11-2018-ANNEX-E-2023', effectiveFrom: '2023-01-01', verifiedThrough: BIR_VERIFIED_ON,
  MONTHLY: rows([
    ['0', '0', '0'], ['20833', '0', '0.15'], ['33333', '1875', '0.20'],
    ['66667', '8541.80', '0.25'], ['166667', '33541.80', '0.30'], ['666667', '183541.80', '0.35'],
  ]),
  SEMI_MONTHLY: rows([
    ['0', '0', '0'], ['10417', '0', '0.15'], ['16667', '937.50', '0.20'],
    ['33333', '4270.70', '0.25'], ['83333', '16770.70', '0.30'], ['333333', '91770.70', '0.35'],
  ]),
});

// Effectivity = 15 days after BIR website publication (Jan 30 / Dec 22 respectively).
// Only the cash benefit categories supported by this phase are encoded here.
export const BENEFIT_RULES = Object.freeze([
  Object.freeze({ version: 'RR11-2018', effectiveFrom: '2023-01-01', effectiveTo: '2025-02-13', rice: '2000', clothing: '6000', laundry: '300' }),
  Object.freeze({ version: 'RR4-2025', effectiveFrom: '2025-02-14', effectiveTo: '2026-01-05', rice: '2000', clothing: '7000', laundry: '300' }),
  Object.freeze({ version: 'RR29-2025', effectiveFrom: '2026-01-06', effectiveTo: BIR_VERIFIED_ON, rice: '2500', clothing: '8000', laundry: '400' }),
]);
