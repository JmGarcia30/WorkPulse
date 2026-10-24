// Phase 2A is deliberately disconnected from live payroll generation/review/payslips.
export { calculateBirWithholding, type BirWithholdingInput, type BirStatutoryDeduction } from './calculator';
export { assessBirTable } from './table';
export { BirCalculationError } from './validation';
export type { CashEarning, EarningKind, BenefitHistory } from './earnings';
export { BIR_ANNEX_E, BENEFIT_RULES, BIR_SOURCES, BIR_VERIFIED_ON, type TaxFrequency } from './rules';
