import { ApplicationStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { resolveHiringDocumentPolicy } from './document-policy';
import { getStageTransitionBlockers } from './stage-prerequisites';
import { canUpdateApplicationStatus } from '@/lib/permissions/rbac';

export const transitionInclude = {
  job: { include: { organization: true } },
  interviews: { include: { evaluation: true } },
  assessments: true,
  recruitmentDocuments: true,
  employee: { select: { id: true } },
} satisfies Prisma.ApplicationInclude;

export function transitionSource(application: Prisma.ApplicationGetPayload<{ include: typeof transitionInclude }>) {
  return {
    ...application,
    jobCategory: application.job.category,
    hiringPolicy: resolveHiringDocumentPolicy(application.job.organization, application.job.category),
    interviews: application.interviews.map(interview => ({ ...interview, recommendation: interview.evaluation?.recommendation })),
  };
}

export async function transitionApplicationStatus(input: {
  applicationId: string; organizationId: string; actorUserId: string; target: ApplicationStatus;
}) {
  try {
    return await prisma.$transaction(async tx => {
      const actor = await tx.user.findFirst({ where: { id: input.actorUserId, organizationId: input.organizationId } });
      if (!actor || !canUpdateApplicationStatus({ ...actor, userId: actor.id })) return { error: 'Unauthorized to update application status.' };
      const application = await tx.application.findFirst({
        where: { id: input.applicationId, job: { organizationId: input.organizationId } },
        include: transitionInclude,
      });
      if (!application) return { error: 'Application not found or access denied.' };
      if (input.target === ApplicationStatus.HIRED) return { error: 'Use the Hiring Readiness conversion action to create the Employee record atomically.' };
      if (application.status === input.target) return { success: true };
      const blockers = getStageTransitionBlockers(transitionSource(application), input.target);
      if (blockers.length) return { error: blockers.join(' ') };
      const changed = await tx.application.updateMany({
        where: { id: application.id, status: application.status, job: { organizationId: input.organizationId } },
        data: { status: input.target },
      });
      if (changed.count !== 1) throw new Error('APPLICATION_STATUS_CONFLICT');
      if (input.target === ApplicationStatus.REJECTED || input.target === ApplicationStatus.WITHDRAWN) {
        await tx.candidateAccess.upsert({ where: { applicationId: application.id }, create: { applicationId: application.id, revoked: true }, update: { revoked: true, linkHash: null, sessionHash: null, delivered: false } });
      }
      await tx.applicationStatusHistory.create({ data: {
        applicationId: application.id, fromStatus: application.status, toStatus: input.target, changedById: input.actorUserId,
      } });
      return { success: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if ((error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') ||
      (error instanceof Error && error.message === 'APPLICATION_STATUS_CONFLICT')) {
      return { error: 'Application or prerequisites changed concurrently. Refresh and review before retrying.' };
    }
    throw error;
  }
}
