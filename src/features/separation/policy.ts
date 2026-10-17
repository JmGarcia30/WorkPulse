import { Temporal } from '@js-temporal/polyfill';
import { SeparationNoticeCompliance } from '@prisma/client';
import { z } from 'zod';

// Only the existing SAGA tenant receives SAGA rules. Unknown tenants fail closed
// for resignation notice review until a policy resolver is added for them.
const policySchema = z.object({
  key: z.string(),
  noticeCalendarMonths: z.number().int().positive().nullable(),
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

export function resolveSeparationPolicy(organizationSlug: string): SeparationPolicy {
  const saga = organizationSlug === 'st-aloysius';
  return {
    key: saga ? 'SAGA_EXIT_V1' : 'BASE_EXIT_V1_NOTICE_UNCONFIGURED',
    noticeCalendarMonths: saga ? 1 : null,
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
  if (policy.noticeCalendarMonths === null) return 'POLICY_REQUIRED';
  if (!input.noticeDate || !input.proposedEffectiveDate) return 'PENDING';
  // Calendar month addition clamps month-end (Jan 31 -> Feb 28/29), with no
  // timezone conversion or approximation by 30 days.
  const earliest = Temporal.PlainDate.from(input.noticeDate).add({ months: policy.noticeCalendarMonths });
  return Temporal.PlainDate.compare(Temporal.PlainDate.from(input.proposedEffectiveDate), earliest) >= 0
    ? 'COMPLIANT' : 'EXCEPTION_REQUIRED';
}
