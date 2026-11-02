import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';

export async function auditedJobMutation<T extends { id: string }>(db: PrismaClient, actor: { organizationId: string; userId: string }, action: 'JOB_CREATED' | 'JOB_UPDATED' | 'JOB_PUBLISHED' | 'JOB_CLOSED', mutate: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async tx => {
    const user = await tx.user.findFirst({ where: { id: actor.userId, organizationId: actor.organizationId, role: { in: ['HR_ADMIN', 'ORGANIZATION_ADMIN'] } }, select: { id: true } });
    if (!user) throw new Error('FORBIDDEN');
    const record = await mutate(tx);
    await tx.accountSecurityEvent.create({ data: { organizationId: actor.organizationId, actorIdentifier: user.id, subjectIdentifier: record.id, action, success: true } });
    return record;
  });
}
