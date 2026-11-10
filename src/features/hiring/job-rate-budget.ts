import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';

export class JobRateLimitError extends Error {
  constructor() {
    super('Too many job changes. Try again in 15 minutes.');
    this.name = 'JobRateLimitError';
  }
}

/**
 * Independently committed, persistent, concurrency-safe budgets.
 * Unlike counting in the job transaction, rejected operations also use quota.
 * Key prefixes segregate limits from staff authentication.
 */
export async function enforceJobMutationBudget(
  db: PrismaClient,
  actor: { organizationId: string; userId: string },
) {
  const allowed = await db.$transaction(async tx => {
    const actorAllowed = await consumeAuthenticationAttempt(
      tx, `job-lifecycle:actor:${actor.organizationId}:${actor.userId}`, 30,
    );
    const tenantAllowed = await consumeAuthenticationAttempt(
      tx, `job-lifecycle:organization:${actor.organizationId}`, 300,
    );
    return actorAllowed && tenantAllowed;
  }, { maxWait: 10000, timeout: 20000 });
  if (!allowed) throw new JobRateLimitError();
}
