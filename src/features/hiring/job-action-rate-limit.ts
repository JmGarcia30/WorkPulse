import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';

type JobAction = 'close' | 'archive' | 'reuse';

/**
 * Persistent organization and actor budgets shared across Vercel workers.
 * Each call commits separately from the job mutation so failures still count.
 * The existing throttle window is 15 minutes.
 */
export async function consumeJobActionBudget(
  db: PrismaClient,
  actor: { organizationId: string; userId: string },
  action: JobAction,
): Promise<boolean> {
  return db.$transaction(async tx => {
    if (!await consumeAuthenticationAttempt(
      tx, `hiring:job-action:tenant:${actor.organizationId}`, 200,
    )) return false;
    return consumeAuthenticationAttempt(
      tx, `hiring:job-action:${action}:${actor.organizationId}:${actor.userId}`,
      action === 'reuse' ? 10 : 30,
    );
  }, { maxWait: 10_000, timeout: 30_000 });
}
