import { Prisma } from '@prisma/client';
import { BIR_ANNEX_E, type TaxFrequency } from './rules';

export type TaxMoney = string | Prisma.Decimal;
export class BirCalculationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'BirCalculationError';
  }
}
export function fail(code: string, message: string): never { throw new BirCalculationError(code, message); }
export function requiredText(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail('INCOMPLETE_INPUT', `${label} is required.`);
}
export function money(value: TaxMoney, label: string): Prisma.Decimal {
  if (!(typeof value === 'string' && value.trim()) && !Prisma.Decimal.isDecimal(value)) fail('INCOMPLETE_INPUT', `${label} must be an explicit decimal string or Prisma.Decimal.`);
  let amount: Prisma.Decimal;
  try { amount = new Prisma.Decimal(value); } catch { return fail('INVALID_MONEY', `${label} is invalid.`); }
  if (!amount.isFinite() || amount.lt(0) || amount.decimalPlaces() > 2 || amount.gt('9999999999.99')) fail('INVALID_MONEY', `${label} must be nonnegative PHP centavos within Decimal(12,2).`);
  return amount;
}
export function date(value: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('INVALID_DATE', 'Dates must use YYYY-MM-DD.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail('INVALID_DATE', 'Invalid calendar date.');
  return parsed;
}
export function validateTableContext(payDate: string, frequency: TaxFrequency): void {
  date(payDate);
  if (payDate < BIR_ANNEX_E.effectiveFrom || payDate > BIR_ANNEX_E.verifiedThrough) fail('UNVERIFIED_RULES', 'No verified BIR rules cover this payment date.');
  if (frequency !== 'MONTHLY' && frequency !== 'SEMI_MONTHLY') fail('UNSUPPORTED_FREQUENCY', 'Use monthly or semi-monthly; biweekly is not semi-monthly.');
}
