import { CompensationType, PayFrequency } from '@prisma/client';
import { Prisma } from '@prisma/client';

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

export function inclusiveCalendarDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function isFullCalendarMonth(start: Date, end: Date): boolean {
  return start.getUTCDate() === 1
    && end.getUTCFullYear() === start.getUTCFullYear()
    && end.getUTCMonth() === start.getUTCMonth()
    && end.getUTCDate() === new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
}

function isFullCalendarYear(start: Date, end: Date): boolean {
  return start.getUTCMonth() === 0 && start.getUTCDate() === 1
    && end.getUTCFullYear() === start.getUTCFullYear()
    && end.getUTCMonth() === 11 && end.getUTCDate() === 31;
}

export function calculateMonthlyCompensationBase(input: {
  baseRate: Prisma.Decimal;
  payFrequency: PayFrequency;
  periodStart: Date;
  periodEnd: Date;
}): Prisma.Decimal {
  const days = inclusiveCalendarDays(input.periodStart, input.periodEnd);
  const matches = input.payFrequency === PayFrequency.MONTHLY
    ? isFullCalendarMonth(input.periodStart, input.periodEnd)
    : input.payFrequency === PayFrequency.WEEKLY
      ? days === 7
      : input.payFrequency === PayFrequency.BIWEEKLY
        ? days === 14
        : input.payFrequency === PayFrequency.ANNUAL
          ? isFullCalendarYear(input.periodStart, input.periodEnd)
          : false;
  if (!matches) {
    throw new PayrollError('SETUP_REQUIRED', `The selected period does not exactly match the ${input.payFrequency.toLowerCase()} compensation frequency.`);
  }
  return input.baseRate.toDecimalPlaces(2);
}
