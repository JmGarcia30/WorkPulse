import type { Prisma } from '@prisma/client';

// Reuse the existing dashboard Requires Attention infrastructure. The notice
// itself is the durable event; acknowledgment clears it without a delivery race.
export async function readResignationNotifications(db: Prisma.TransactionClient, organizationId: string, hrAccess: boolean) {
  if (!hrAccess) return [];
  return db.employeeSeparationCase.findMany({
    where: { organizationId, submissionSource: 'ESS', separationType: 'RESIGNATION', acknowledgedAt: null, status: { in: ['DRAFT', 'IN_PROGRESS', 'READY_FOR_FINAL_REVIEW'] } },
    select: { id: true, initiatedAt: true, proposedEffectiveDate: true, employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
    orderBy: [{ initiatedAt: 'asc' }, { id: 'asc' }], take: 15,
  });
}
