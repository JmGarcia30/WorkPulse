import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { RecruitmentDocumentStatus } from '@prisma/client';
import { resolveHiringDocumentPolicy } from './document-policy';

export async function ensureRecruitmentDocumentsExist(applicationId: string, organizationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, job: { organizationId } },
    select: { job: { select: { category: true, organization: { select: { id: true, slug: true, hiringDocumentRequirements: true } } } } },
  });
  if (!application) throw Error('APPLICATION_NOT_FOUND');
  const policy = resolveHiringDocumentPolicy(application.job.organization, application.job.category);
  if (policy.requirements.length) await prisma.recruitmentDocument.createMany({
    data: policy.requirements.map(def => ({ applicationId, type: def.type, title: def.title,
      status: RecruitmentDocumentStatus.PENDING, isRequired: def.isRequired, isConditional: def.isConditional, notes: def.conditionalNote || null })),
    skipDuplicates: true,
  });
  return prisma.recruitmentDocument.findMany({ where: { applicationId, application: { job: { organizationId } } }, orderBy: { createdAt: 'asc' } });
}
