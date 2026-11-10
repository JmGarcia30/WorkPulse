import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { publishedJobCount, enforcePublishedJobIncrease } from '@/features/subscriptions/job-limit';

export async function auditedJobMutation<T extends { id: string }>(db: PrismaClient, actor: { organizationId: string; userId: string }, action: 'JOB_CREATED' | 'JOB_UPDATED' | 'JOB_PUBLISHED' | 'JOB_CLOSED' | 'JOB_ARCHIVED' | 'JOB_REUSED', mutate: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async tx => {
    const user = await tx.user.findFirst({ where: { id: actor.userId, organizationId: actor.organizationId, role: { in: ['HR_ADMIN', 'ORGANIZATION_ADMIN'] } }, select: { id: true } });
    if (!user) throw new Error('FORBIDDEN');
    // Same immutable-tenant lock used by subscription approval/activation. The
    // count and mutation cannot race another publish, close or tier change.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`subscription:${actor.organizationId}`},0))::text`;
    const before=await publishedJobCount(tx,actor.organizationId);
    const record = await mutate(tx);
    await enforcePublishedJobIncrease(tx,actor.organizationId,before);
    await tx.accountSecurityEvent.create({ data: { organizationId: actor.organizationId, actorIdentifier: user.id, subjectIdentifier: record.id, action, success: true } });
    return record;
  });
}
