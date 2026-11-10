'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { listHrNotifications } from './read-model';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';

export async function markHrNotificationRead(key: string): Promise<{ success?: true; error?: string }> {
  const actor = await getSession();
  if (!actor || (actor.role !== Role.HR_ADMIN && actor.role !== Role.ORGANIZATION_ADMIN)) {
    return { error: 'You are not authorized to manage HR notifications.' };
  }
  if (typeof key !== 'string' || key.length > 200 || !/^[a-z0-9:-]+$/i.test(key)) {
    return { error: 'Invalid notification. Refresh the page.' };
  }
  const allowed = await prisma.$transaction(tx =>
    consumeAuthenticationAttempt(tx, `hr-notification-read:${actor.organizationId}:${actor.userId}`, 120),
  );
  if (!allowed) return { error: 'Too many requests. Try again in 15 minutes.' };
  const visible = await listHrNotifications(actor);
  if (!visible.some(item => item.key === key)) {
    return { error: 'This notification is no longer available. Refresh the list.' };
  }
  try {
    await prisma.hrNotificationRead.upsert({
      where: { organizationId_userId_notificationKey: {
        organizationId: actor.organizationId, userId: actor.userId, notificationKey: key,
      } },
      create: { organizationId: actor.organizationId, userId: actor.userId, notificationKey: key },
      update: {},
    });
    revalidatePath('/dashboard/notifications');
    return { success: true };
  } catch {
    return { error: 'Could not update notification. Try again.' };
  }
}
