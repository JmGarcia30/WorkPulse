import { CompensationType, PayFrequency } from '@prisma/client';

export class PayrollError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PayrollError';
  }
}

export function parsePayrollDate(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new PayrollError('INVALID_DATE', `${label} must use YYYY-MM-DD format.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new PayrollError('INVALID_DATE', `${label} is not a valid calendar date.`);
  }
  return date;
}

export function validateCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new PayrollError('INVALID_CURRENCY', 'Currency must be a three-letter ISO code.');
  return currency;
}

export function parseCompensationType(value: string): CompensationType {
  if (!Object.values(CompensationType).includes(value as CompensationType)) throw new PayrollError('INVALID_COMPENSATION_TYPE', 'Unsupported compensation type.');
  return value as CompensationType;
}

export function parsePayFrequency(value: string): PayFrequency {
  if (!Object.values(PayFrequency).includes(value as PayFrequency)) throw new PayrollError('INVALID_PAY_FREQUENCY', 'Unsupported pay frequency.');
  return value as PayFrequency;
}
