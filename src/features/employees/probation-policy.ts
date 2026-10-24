import { z } from 'zod';
import { EmploymentCategory } from '@prisma/client';

const categoryPolicySchema = z.object({
  durationMonths: z.number().int().min(1).max(6),
  evaluationRequired: z.boolean(),
  evaluationCriteria: z.string().trim().min(10).max(4000),
  maxRenewals: z.number().int().min(0).max(2),
  renewalMonths: z.number().int().min(0).max(5),
}).superRefine((policy, ctx) => {
  if ((policy.maxRenewals === 0) !== (policy.renewalMonths === 0) || policy.durationMonths + policy.maxRenewals * policy.renewalMonths > 6) {
    ctx.addIssue({ code: 'custom', message: 'Initial probation plus all renewals must fit within six months. Set both renewal fields to zero to prohibit renewals.' });
  }
});
export const organizationProbationPolicySchema = z.object({ TEACHING: categoryPolicySchema, NON_TEACHING: categoryPolicySchema });
export type CompanyProbationPolicy = z.infer<typeof categoryPolicySchema>;
const snapshotSchema = z.object({
  version: z.literal(1), organizationId: z.string().min(1),
  regime: z.enum(['SAGA_INSTITUTIONAL', 'PH_GENERAL']), category: z.nativeEnum(EmploymentCategory),
  durationMonths: z.number().int().min(1).max(12), maxRenewals: z.number().int().min(0).max(2),
  renewalMonths: z.number().int().min(0).max(12), evaluationRequired: z.boolean(),
  evaluationCriteria: z.string(), terms: z.string().min(1),
}).superRefine((policy, ctx) => {
  if (policy.regime === 'PH_GENERAL' && !categoryPolicySchema.safeParse(policy).success) ctx.addIssue({ code: 'custom', message: 'Invalid general probation policy.' });
  if (policy.regime === 'SAGA_INSTITUTIONAL' && (policy.durationMonths !== (policy.category === 'TEACHING' ? 12 : 6) || policy.maxRenewals !== (policy.category === 'TEACHING' ? 2 : 0))) ctx.addIssue({ code: 'custom', message: 'Invalid SAGA probation policy.' });
});
export type ProbationPolicySnapshot = z.infer<typeof snapshotSchema>;
export function isSagaProbationOrganization(organization: { slug: string } | null | undefined) {
  return organization?.slug === 'st-aloysius';
}
export function resolveOfferProbationPolicy(organization: { id: string; slug: string; probationPolicy?: unknown }, category: EmploymentCategory): ProbationPolicySnapshot {
  if (isSagaProbationOrganization(organization)) {
    const teaching = category === 'TEACHING';
    return { version: 1, organizationId: organization.id, regime: 'SAGA_INSTITUTIONAL', category,
      durationMonths: teaching ? 12 : 6, maxRenewals: teaching ? 2 : 0, renewalMonths: teaching ? 12 : 0,
      evaluationRequired: false, evaluationCriteria: '',
      terms: teaching ? 'Probationary appointment for one (1) school year, renewable annually for a maximum of three (3) school years.' : 'Probationary appointment for six (6) months; satisfactory completion may result in regular appointment.' };
  }
  const configured = organizationProbationPolicySchema.safeParse(organization.probationPolicy);
  if (!configured.success) throw new Error('Configure this organization’s probation duration and evaluation standards before creating an offer.');
  const policy = configured.data[category];
  return { version: 1, organizationId: organization.id, regime: 'PH_GENERAL', category, ...policy,
    terms: `Probation: ${policy.durationMonths} calendar months. ${policy.maxRenewals ? `At most ${policy.maxRenewals} renewal(s) of ${policy.renewalMonths} month(s), subject to written employee consent and HR legal review at the agreed period end; total probation never exceeds six months from initial engagement.` : 'No probation renewal is permitted.'} Evaluation standards communicated at engagement: ${policy.evaluationCriteria}. ${policy.evaluationRequired ? 'Documented evaluation is required before a probation decision.' : 'HR must assess the communicated standards before an adverse decision.'}` };
}
export function parseProbationPolicySnapshot(value: unknown, organizationId?: string, category?: EmploymentCategory): ProbationPolicySnapshot {
  const policy = snapshotSchema.parse(value);
  if ((organizationId && policy.organizationId !== organizationId) || (category && policy.category !== category)) throw new Error('Probation policy does not match the organization and employment category.');
  return policy;
}
export function readStoredProbationPolicy(value: string): ProbationPolicySnapshot | null {
  if (!value.trim().startsWith('{')) return null; // Retain existing unstructured historical snapshots.
  return parseProbationPolicySnapshot(JSON.parse(value));
}
export function probationPolicyText(value: string) {
  try { return readStoredProbationPolicy(value)?.terms ?? value; } catch { return 'Stored probation policy requires HR review.'; }
}
export function resolveAgreedProbationPolicy(input: {
  organization: { id: string; slug: string }; category: EmploymentCategory;
  offer: { probationPolicySnapshot?: unknown; probationPeriodMonths: number | null; probationaryTerms: string | null };
}): ProbationPolicySnapshot {
  if (input.offer.probationPolicySnapshot != null) {
    const policy = parseProbationPolicySnapshot(input.offer.probationPolicySnapshot, input.organization.id, input.category);
    if (policy.regime === 'SAGA_INSTITUTIONAL' && !isSagaProbationOrganization(input.organization)) throw new Error('SAGA probation cannot apply to another organization.');
    if (policy.durationMonths !== input.offer.probationPeriodMonths || policy.terms !== input.offer.probationaryTerms) throw new Error('Agreed probation terms and snapshot do not match.');
    return policy;
  }
  if (isSagaProbationOrganization(input.organization)) return resolveOfferProbationPolicy(input.organization, input.category);
  // Legacy offers keep their agreed duration/text. No school-year or renewal inference.
  const months = input.offer.probationPeriodMonths;
  const terms = input.offer.probationaryTerms?.trim();
  if (!Number.isInteger(months) || months! < 1 || months! > 6 || !terms || terms.length < 10) throw new Error('Legacy offer lacks legally supported probation terms. HR must review the agreed contract before conversion; no automatic rewrite is permitted.');
  return { version: 1, organizationId: input.organization.id, regime: 'PH_GENERAL', category: input.category, durationMonths: months!, maxRenewals: 0, renewalMonths: 0, evaluationRequired: false, evaluationCriteria: terms, terms };
}
