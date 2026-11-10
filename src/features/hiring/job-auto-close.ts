import 'server-only';
import { JobStatus, type PrismaClient } from '@prisma/client';
import { attendanceDateForInstant } from '@/features/attendance/domain';

export type JobCloseResult = { examined: number; closed: number; moreDue: boolean };

/**
 * Durable daily closeout. A published job expires only after its final
 * organization-local calendar day. All writes and audit rows commit atomically.
 * No HR actor or credentials are impersonated.
 */
export async function closeExpiredJobs(
  db: PrismaClient,
  now: Date = new Date(),
  limit = 100,
): Promise<JobCloseResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 300) throw new Error('Invalid job batch size.');
  const orgs = await db.organization.findMany({
    select: { id: true, timeZone: true },
    orderBy: { id: 'asc' },
  });
  let examined = 0;
  let closed = 0;
  let moreDue = false;

  for (const org of orgs) {
    const today = attendanceDateForInstant(now, org.timeZone);
    const boundary = new Date(today + 'T00:00:00.000Z');
    const rows = await db.job.findMany({
      where: { organizationId: org.id, status: JobStatus.PUBLISHED, closingDate: { lt: boundary } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: Math.max(1, limit - examined) + 1,
    });
    if (rows.length > Math.max(0, limit - examined)) moreDue = true;
    for (const job of rows.slice(0, Math.max(0, limit - examined))) {
      const didClose = await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`subscription:${org.id}`},0))::text`;
        const changed = await tx.job.updateMany({
          where: { id: job.id, organizationId: org.id, status: JobStatus.PUBLISHED, closingDate: { lt: boundary } },
          data: { status: JobStatus.CLOSED },
        });
        if (!changed.count) return false;
        await tx.accountSecurityEvent.create({
          data: {
            organizationId: org.id,
            actorIdentifier: null,
            subjectIdentifier: job.id,
            action: 'JOB_AUTO_CLOSED',
            success: true,
          },
        });
        return true;
      });
      examined++;
      if (didClose) closed++;
    }
    if (examined >= limit) { moreDue ||= rows.length > examined; break; }
  }
  return { examined, closed, moreDue };
}
