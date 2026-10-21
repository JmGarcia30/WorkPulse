import { EmploymentCategory, RecruitmentDocumentType } from '@prisma/client';
import { z } from 'zod';
import { getSagaDocumentRequirements, type DocumentRequirementDefinition } from './saga-requirements';

const definition = z.object({
  type: z.enum(RecruitmentDocumentType),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  isRequired: z.boolean(),
  isConditional: z.boolean(),
  conditionalNote: z.string().trim().max(500).optional(),
  submissionTarget: z.string().trim().min(1).max(160),
}).strict().refine(d => !(d.isRequired && d.isConditional), 'Choose mandatory or conditional, not both');
const requirements = z.array(definition).max(Object.keys(RecruitmentDocumentType).length).refine(rows => new Set(rows.map(d => d.type)).size === rows.length, 'Duplicate document type');
export const hiringDocumentPolicySchema = z.object({ TEACHING: requirements, NON_TEACHING: requirements }).strict();

export interface HiringDocumentPolicy {
  organizationId: string;
  isSaga: boolean;
  requirements: DocumentRequirementDefinition[];
}

// Called with the organization fetched through the job/application's ownership
// relation. Category alone, a URL alias or a missing tenant never selects SAGA.
export function resolveHiringDocumentPolicy(organization: { id: string; slug: string; hiringDocumentRequirements: unknown }, category: EmploymentCategory): HiringDocumentPolicy {
  if (!organization.id) throw Error('HIRING_ORGANIZATION_REQUIRED');
  const isSaga = organization.slug === 'st-aloysius';
  const configured = organization.hiringDocumentRequirements;
  const defaults: DocumentRequirementDefinition[] = isSaga ? getSagaDocumentRequirements(category) : [{
    type: RecruitmentDocumentType.RESUME_APPLICATION_LETTER, title: 'Resume / application letter',
    isRequired: true, isConditional: false, submissionTarget: 'Hiring team',
  }];
  return { organizationId: organization.id, isSaga, requirements: configured == null ? defaults : hiringDocumentPolicySchema.parse(configured)[category] };
}

// Keep historical files and IDs accessible without treating retired or formerly
// auto-generated SAGA slots as current mandatory requirements for another tenant.
export function applyDocumentPolicy<T extends { type: RecruitmentDocumentType; title: string; isRequired: boolean; isConditional: boolean }>(documents: T[], policy: HiringDocumentPolicy): T[] {
  return documents.map(doc => {
    const current = policy.requirements.find(def => def.type === doc.type);
    return { ...doc, title: current?.title ?? doc.title, isRequired: current?.isRequired ?? false, isConditional: current?.isConditional ?? false };
  });
}
