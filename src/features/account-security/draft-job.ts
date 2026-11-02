import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { AccountSecurityError, requireSelfAdministrator } from './profile';

/** Only never-published, unused drafts qualify. Audit and deletion commit together. */
export async function deleteUnusedDraftJob(db: PrismaClient, context: { organizationId: string; userId: string; token: string }, jobId: string, confirmation: unknown) {
  if (confirmation !== 'DELETE DRAFT') throw new AccountSecurityError('CONFIRMATION', 'Type DELETE DRAFT to confirm.');
  return db.$transaction(async tx => {
    const actor = await requireSelfAdministrator(tx, context);
    await tx.$queryRaw`SELECT id FROM "Job" WHERE id=${jobId} AND "organizationId"=${context.organizationId} FOR UPDATE`;
    const job = await tx.job.findFirst({ where: { id: jobId, organizationId: context.organizationId }, select: { status: true, publishedAt: true, _count: { select: { applications: true, employmentRecords: true } } } });
    if (!job || job.status !== 'DRAFT' || job.publishedAt || job._count.applications || job._count.employmentRecords) throw new AccountSecurityError('DEPENDENCIES', 'Only an unpublished draft with no applications or employment records can be deleted.');
    await tx.job.delete({ where: { id: jobId, organizationId: context.organizationId } });
    await tx.accountSecurityEvent.create({ data: { organizationId: context.organizationId, actorIdentifier: actor.id, subjectIdentifier: jobId, action: 'DRAFT_JOB_DELETED', success: true } });
  });
}
