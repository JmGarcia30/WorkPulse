import 'server-only';
import { JobStatus, type PrismaClient } from '@prisma/client';
import { auditedJobMutation } from '@/features/account-security/job-audit';

type JobActor = { organizationId: string; userId: string };

export class JobLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobLifecycleError';
  }
}

/**
 * An archived posting is never deleted. Applications, history, offers, and
 * employee-conversion links continue to refer to the original job.
 *
 * The audited mutation holds WorkPulse's organization transaction lock and
 * checks the actor again before committing the status change.
 */
export async function archiveClosedJob(db: PrismaClient, actor: JobActor, jobId: string) {
  return auditedJobMutation(db, actor, 'JOB_ARCHIVED', async tx => {
    const changed = await tx.job.updateMany({
      where: { id: jobId, organizationId: actor.organizationId, status: JobStatus.CLOSED },
      data: { status: JobStatus.ARCHIVED },
    });
    if (changed.count !== 1) {
      throw new JobLifecycleError('Only a closed posting can be archived. Close the posting first, or refresh if its status changed.');
    }
    return tx.job.findFirstOrThrow({
      where: { id: jobId, organizationId: actor.organizationId },
      select: { id: true, status: true },
    });
  });
}

/**
 * Reusing an archived posting starts an entirely NEW, unpublished recruitment
 * cycle. Old applicants remain attached to the archived source posting.
 * Requirements are copied as new rows; no candidate records are copied.
 */
export async function reuseArchivedJob(db: PrismaClient, actor: JobActor, jobId: string) {
  return auditedJobMutation(db, actor, 'JOB_REUSED', async tx => {
    const source = await tx.job.findFirst({
      where: { id: jobId, organizationId: actor.organizationId, status: JobStatus.ARCHIVED },
      include: { structuredReqs: true },
    });
    if (!source) {
      throw new JobLifecycleError('This posting is not archived, has changed, or is unavailable in your organization.');
    }

    // The organization lock in auditedJobMutation serializes slug generation
    // for all audited job writes, even under concurrent HR requests.
    const stem = (source.slug.slice(0, 70).replace(/-+$/, '') || 'job') + '-cycle';
    let slug = stem;
    let suffix = 2;
    while (await tx.job.findUnique({
      where: { organizationId_slug: { organizationId: actor.organizationId, slug } },
      select: { id: true },
    })) {
      if (suffix > 10000) throw new JobLifecycleError('Too many matching postings. Contact your administrator.');
      slug = `${stem}-${suffix++}`;
    }

    const copy = await tx.job.create({
      data: {
        organizationId: actor.organizationId,
        slug,
        title: source.title,
        department: source.department,
        employmentType: source.employmentType,
        location: source.location,
        category: source.category,
        description: source.description,
        responsibilities: source.responsibilities,
        qualifications: source.qualifications,
        requirements: source.requirements,
        status: JobStatus.DRAFT,
        publishedAt: null,
        closingDate: null,
        structuredReqs: {
          create: source.structuredReqs.map(req => ({
            name: req.name,
            type: req.type,
            description: req.description,
            isRequired: req.isRequired,
          })),
        },
      },
      select: { id: true, status: true, slug: true },
    });

    // Keep a source-to-new-cycle audit link without changing the Job schema.
    // The regular JOB_REUSED event (subject = new job ID) is written by
    // auditedJobMutation in this same transaction.
    await tx.accountSecurityEvent.create({
      data: {
        organizationId: actor.organizationId,
        actorIdentifier: actor.userId,
        subjectIdentifier: source.id,
        action: 'JOB_REUSED_AS_NEW_DRAFT',
        success: true,
        operationKey: `job-reuse:${copy.id}`,
      },
    });

    return copy;
  });
}
