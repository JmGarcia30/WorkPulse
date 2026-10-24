import { Prisma } from '@prisma/client';
import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import { money } from '../payroll/bir/validation';
import { SeparationError, text } from './domain';

export const FINAL_PAY_KINDS = ['SALARY', 'THIRTEENTH', 'LEAVE', 'SEPARATION', 'ADJUSTMENT', 'DEDUCTION'] as const;
export const FINAL_PAY_LABELS = { SALARY: 'Unpaid earned salary', THIRTEENTH: 'Proportionate 13th-month pay', LEAVE: 'Unused leave conversion', SEPARATION: 'Separation pay', ADJUSTMENT: 'Approved additions / refunds', DEDUCTION: 'Lawful deductions / tax settlement' };
const decimalText = z.string().trim().max(30);
export const finalPayLineSchema = z.object({
  kind: z.enum(FINAL_PAY_KINDS), disposition: z.enum(['UNREVIEWED', 'APPLICABLE', 'NOT_APPLICABLE']),
  basis: z.string().trim().max(4000), first: decimalText, second: decimalText,
}).strict();
export const finalPayPayloadSchema = z.object({
  lines: z.array(finalPayLineSchema).length(FINAL_PAY_KINDS.length),
  coverageConfirmed: z.boolean(), taxReviewed: z.boolean(), reconciliationConfirmed: z.boolean(),
  reviewNotes: z.string().trim().max(4000),
}).strict().refine(input => new Set(input.lines.map(line => line.kind)).size === FINAL_PAY_KINDS.length, 'Every component must appear exactly once.');
export type FinalPayPayload = z.infer<typeof finalPayPayloadSchema>;
export const finalPayBreakdownSchema = z.array(finalPayLineSchema.extend({ amount: z.string().nullable(), formula: z.string() }));
export const emptyFinalPayPayload = (): FinalPayPayload => ({ lines: FINAL_PAY_KINDS.map(kind => ({ kind, disposition: 'UNREVIEWED', basis: '', first: '', second: '' })), coverageConfirmed: false, taxReviewed: false, reconciliationConfirmed: false, reviewNotes: '' });
export const finalPayDeadlinePolicySchema = z.object({ days: z.number().int().min(0).max(30), basis: text }).strict();

export function deadlinePolicy(value: unknown) {
  const parsed = finalPayDeadlinePolicySchema.safeParse(value);
  if (value != null && !parsed.success) throw new SeparationError('NOT_READY', 'Organization final-pay deadline policy is invalid; HR must review settings.');
  return parsed.success ? parsed.data : { days: 30, basis: 'DOLE Labor Advisory 06-2020: 30 days from separation; shorter favorable terms prevail.' };
}

export function finalPayDeadline(separationDate: string, days: number, today: string, paidOn?: string) {
  const dueDate = Temporal.PlainDate.from(separationDate).add({ days }).toString();
  return { dueDate, status: paidOn ? paidOn > dueDate ? 'PAID_LATE' : 'PAID_ON_TIME' : today > dueDate ? 'OVERDUE' : today === dueDate ? 'DUE_TODAY' : 'UPCOMING' };
}

function amount(value: string, label: string) {
  try { return money(value, label); } catch { throw new SeparationError('INVALID_INPUT', `${label}: enter an explicit nonnegative PHP amount with at most two decimal places.`); }
}

export function calculateFinalPay(payload: FinalPayPayload) {
  const blockers: string[] = [];
  if (!payload.coverageConfirmed) blockers.push('Confirm Philippine private-sector coverage and component eligibility. Other regimes require external review.');
  if (!payload.taxReviewed) blockers.push('Tax and statutory settlement require qualified review; no automatic final tax is calculated.');
  if (!payload.reconciliationConfirmed) blockers.push('Reconcile payroll, actual prior payments, attendance, leave, and other benefits; finalized payroll does not prove payment.');
  if (!payload.reviewNotes) blockers.push('Record review evidence, coverage period/tax year, separation grounds, and reconciliation notes.');
  let gross = new Prisma.Decimal(0), deductions = new Prisma.Decimal(0);
  const lines = payload.lines.map(line => {
    const label = FINAL_PAY_LABELS[line.kind];
    if (line.disposition === 'UNREVIEWED' || !line.basis) { blockers.push(`${label}: review applicability and record evidence / legal or policy basis.`); return { ...line, amount: null, formula: 'Not determined' }; }
    if (line.disposition === 'NOT_APPLICABLE') {
      if (line.first || line.second) throw new SeparationError('INVALID_INPUT', `${label}: remove amounts when explicitly not applicable.`);
      return { ...line, amount: '0.00', formula: 'Explicitly reviewed as not applicable' };
    }
    let result: Prisma.Decimal, formula: string;
    let first: Prisma.Decimal;
    if (line.kind === 'LEAVE') {
      if (!/^\d{1,7}(\.\d{1,4})?$/.test(line.first)) throw new SeparationError('INVALID_INPUT', 'Convertible leave days require an explicit nonnegative decimal with at most four decimal places.');
      first = new Prisma.Decimal(line.first);
    } else first = amount(line.first, label);
    if (line.kind === 'SALARY' || line.kind === 'THIRTEENTH') {
      const paid = amount(line.second, `${label} already paid`);
      const earned = line.kind === 'THIRTEENTH' ? first.div(12).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : first;
      result = earned.sub(paid);
      formula = line.kind === 'THIRTEENTH' ? `${first.toFixed(2)} verified basic earned in the calendar year ÷ 12 − ${paid.toFixed(2)} already paid` : `${first.toFixed(2)} earned gross − ${paid.toFixed(2)} gross salary already settled`;
      if (result.lt(0)) throw new SeparationError('NOT_READY', `${label}: prior payments exceed calculated entitlement. Resolve externally; no automatic deduction or zero clamp.`);
    } else if (line.kind === 'LEAVE') {
      // first is verified convertible days, not a guessed statutory entitlement.
      result = first.mul(amount(line.second, 'Verified leave daily conversion rate'));
      formula = `${first.toFixed(4)} verified convertible days × ${line.second} reviewed daily rate`;
    } else {
      if (line.second) throw new SeparationError('INVALID_INPUT', `${label}: unexpected second amount.`);
      result = first;
      formula = 'Externally reviewed amount; evidence and lawful / contractual basis required';
    }
    result = result.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (line.kind === 'DEDUCTION') deductions = deductions.add(result); else gross = gross.add(result);
    return { ...line, amount: result.toFixed(2), formula };
  });
  const net = gross.sub(deductions);
  if (net.lt(0)) blockers.push('Deductions exceed earnings. Resolve the lawful settlement externally; negative final pay is unsupported.');
  if (gross.gt('9999999999.99') || deductions.gt('9999999999.99') || net.gt('9999999999.99')) blockers.push('Final-pay totals exceed supported PHP amount limits.');
  const complete = blockers.length === 0;
  return { lines, blockers, gross: complete ? gross.toFixed(2) : null, deductions: complete ? deductions.toFixed(2) : null, net: complete ? net.toFixed(2) : null };
}
