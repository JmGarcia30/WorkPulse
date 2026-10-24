import { Temporal } from '@js-temporal/polyfill';
import { SeparationNoticeCompliance } from '@prisma/client';
import { z } from 'zod';

export const organizationResignationPolicySchema = z.object({
  noticePeriod: z.number().int().min(0).max(3650),
  noticeUnit: z.enum(['CALENDAR_DAYS', 'CALENDAR_MONTHS']),
  allowExceptions: z.boolean(),
}).strict().refine(value => value.noticeUnit !== 'CALENDAR_MONTHS' || value.noticePeriod <= 120, {
  message: 'Calendar-month notice must be between 0 and 120 months.',
});
export type OrganizationResignationPolicy = z.infer<typeof organizationResignationPolicySchema>;
const storedPolicySchema = z.object({
  version: z.literal(1), policy: organizationResignationPolicySchema,
  configuredById: z.string().min(1), configuredAt: z.string().datetime(),
}).strict();

export function readOrganizationResignationPolicy(value: unknown) {
  const parsed = storedPolicySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// Legacy case snapshots remain readable and retain their original behavior.
const policySchema = z.object({
  key: z.string(),
  noticeCalendarMonths: z.number().int().nonnegative().nullable(),
  noticeCalendarDays: z.number().int().nonnegative().nullable().optional(),
  allowNoticeExceptions: z.boolean().optional(),
  requireNoticeReviews: z.boolean(),
  requiredCategories: z.array(z.string()),
});
export type SeparationPolicy = z.infer<typeof policySchema>;
export const DEFAULT_CLEARANCE = [
  { category: 'HR_RECORDS', title: 'HR records and documents' },
  { category: 'PROPERTY', title: 'Property and equipment' },
  { category: 'IT', title: 'IT access and assigned devices' },
  { category: 'FINANCE', title: 'Finance and accountabilities' },
  { category: 'TURNOVER', title: 'Records and responsibilities turnover' },
];

export function resolveSeparationPolicy(organizationSlug: string, storedPolicy?: unknown): SeparationPolicy {
  const saga = organizationSlug === 'st-aloysius';
  const configured = saga ? null : readOrganizationResignationPolicy(storedPolicy)?.policy;
  return {
    key: saga ? 'SAGA_EXIT_V1' : configured ? 'ORGANIZATION_EXIT_V1' : 'BASE_EXIT_V1_NOTICE_UNCONFIGURED',
    noticeCalendarMonths: saga ? 1 : configured?.noticeUnit === 'CALENDAR_MONTHS' ? configured.noticePeriod : null,
    ...(configured ? {
      noticeCalendarDays: configured.noticeUnit === 'CALENDAR_DAYS' ? configured.noticePeriod : null,
      allowNoticeExceptions: configured.allowExceptions,
    } : {}),
    requireNoticeReviews: saga,
    requiredCategories: DEFAULT_CLEARANCE.map(item => item.category),
  };
}

export const parsePolicySnapshot = (value: unknown) => policySchema.parse(value);

export function assessNotice(input: {
  separationType: string;
  noticeDate?: string | null;
  proposedEffectiveDate?: string | null;
}, policy: SeparationPolicy): SeparationNoticeCompliance {
  if (input.separationType !== 'RESIGNATION') return 'NOT_APPLICABLE';
  if (policy.noticeCalendarMonths === null && policy.noticeCalendarDays == null) return 'POLICY_REQUIRED';
  if (!input.noticeDate || !input.proposedEffectiveDate) return 'PENDING';
  // Calendar month addition clamps month-end (Jan 31 -> Feb 28/29), with no
  // timezone conversion or approximation by 30 days.
  const earliest = Temporal.PlainDate.from(input.noticeDate).add(policy.noticeCalendarMonths !== null
    ? { months: policy.noticeCalendarMonths } : { days: policy.noticeCalendarDays! });
  return Temporal.PlainDate.compare(Temporal.PlainDate.from(input.proposedEffectiveDate), earliest) >= 0
    ? 'COMPLIANT' : 'EXCEPTION_REQUIRED';
}
