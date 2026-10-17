import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import { SeparationType } from '@prisma/client';

export class SeparationError extends Error {
  constructor(public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'CONFLICT' | 'DUPLICATE_CASE' | 'NOT_READY' | 'UNAVAILABLE', message: string) {
    super(message);
    this.name = 'SeparationError';
  }
}

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new SeparationError('INVALID_INPUT', 'Invalid separation input. Check required fields and calendar dates.');
  return parsed.data;
}

export const text = z.string().trim().min(1).max(2000);
export const identifier = z.string().trim().min(1).max(128);
export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  try { return Temporal.PlainDate.from(value).toString() === value && value >= '1900-01-01'; } catch { return false; }
});
export const nullableText = text.nullable().optional();
export const detailsSchema = z.object({
  separationType: z.enum(SeparationType),
  reason: text,
  noticeDate: calendarDate.nullable().optional(),
  proposedLastWorkingDay: calendarDate.nullable().optional(),
  proposedEffectiveDate: calendarDate.nullable().optional(),
  noticeRemarks: nullableText,
  administrativeRemarks: nullableText,
}).strict();
export const createSchema = detailsSchema.extend({
  employeeId: identifier,
  requestKey: identifier,
  inactiveEmployeeJustification: nullableText,
}).strict();
export const versionSchema = z.object({ caseId: identifier, expectedVersion: z.number().int().nonnegative() }).strict();
export const itemDetailsSchema = z.object({
  category: z.string().trim().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  title: z.string().trim().min(1).max(200),
  description: nullableText,
  isRequired: z.boolean(),
  responsibleUnit: z.string().trim().min(1).max(200).nullable().optional(),
}).strict();
export type CaseDetails = z.infer<typeof detailsSchema>;
export type CreateCaseInput = z.infer<typeof createSchema>;
export type VersionInput = z.infer<typeof versionSchema>;
export type ItemDetails = z.infer<typeof itemDetailsSchema>;

export function validateDateOrder(input: CaseDetails) {
  if (input.proposedLastWorkingDay && input.proposedEffectiveDate && input.proposedLastWorkingDay > input.proposedEffectiveDate) {
    throw new SeparationError('INVALID_INPUT', 'Last working day cannot follow the proposed effective date.');
  }
  if (input.noticeDate && input.proposedEffectiveDate && input.noticeDate > input.proposedEffectiveDate) {
    throw new SeparationError('INVALID_INPUT', 'Notice cannot follow the proposed effective date.');
  }
  if (input.separationType !== 'RESIGNATION' && (input.noticeDate || input.noticeRemarks)) {
    throw new SeparationError('INVALID_INPUT', 'Resignation notice fields apply only to resignation cases.');
  }
}

export const toDate = (value: string | null | undefined) => value ? new Date(`${value}T00:00:00.000Z`) : null;
export const dateOnly = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
