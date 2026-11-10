'use server';

import { revalidatePath } from 'next/cache';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canManageJobs } from '@/lib/permissions/rbac';

/**
 * Archiving is a visibility change, never an application status transition.
 * Only HR/organization administrators may archive REJECTED or WITHDRAWN.
 * Restore is allowed only for records that are still terminal.
 * Both changes append a tenant-bound immutable audit event.
 */
export async function setApplicationArchivedAction(
  applicationId: string,
  archive: boolean,
): Promise<{ success?: true; error?: string }> {
  const actor = await getSession();
  if (!actor || !canManageJobs(actor)) {
    return { error: 'You are not authorized to archive applications.' };
  }
  if (typeof applicationId !== 'string' || applicationId.length < 1 || applicationId.length > 200 || typeof archive !== 'boolean') {
    return { error: 'Invalid application request.' };
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const account = await tx.user.findFirst({
        where: { id: actor.userId, organizationId: actor.organizationId, role: { in: ['HR_ADMIN', 'ORGANIZATION_ADMIN'] } },
        select: { id: true },
      });
      if (!account) return { error: 'You are not authorized to archive applications.' };
      const application = await tx.application.findFirst({
        where: { id: applicationId, job: { organizationId: actor.organizationId } },
        select: { id: true, archivedAt: true, status: true },
      });
      if (!application) return { error: 'Application not found in your organization.' };
      if (application.status !== ApplicationStatus.REJECTED && application.status !== ApplicationStatus.WITHDRAWN) {
        return { error: 'Only rejected or withdrawn applications can be archived.' };
      }
      if (Boolean(application.archivedAt) === archive) {
        return { success: true as const };
      }
      const updated = await tx.application.updateMany({
        where: {
          id: application.id,
          job: { organizationId: actor.organizationId },
          status: { in: [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN] },
          archivedAt: archive ? null : { not: null },
        },
        data: { archivedAt: archive ? new Date() : null },
      });
      if (updated.count !== 1) {
        return { error: 'The application changed. Refresh and try again.' };
      }
      await tx.applicationArchiveEvent.create({
        data: {
          organizationId: actor.organizationId,
          applicationId: application.id,
          actorUserId: account.id,
          action: archive ? 'ARCHIVED' : 'RESTORED',
        },
      });
      return { success: true as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.success) {
      revalidatePath('/dashboard/hiring/applicants');
      revalidatePath('/dashboard/hiring/pipeline');
      revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
    }
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return { error: 'The application changed while processing. Refresh and retry.' };
    }
    console.error('Applicant archive mutation failed', { action: archive ? 'ARCHIVED' : 'RESTORED', code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'UNKNOWN' });
    return { error: 'Unable to update the archive. Try again or contact your administrator.' };
  }
}
