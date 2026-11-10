'use server';

import { prisma } from '@/lib/db/prisma';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { listPayrollNotifications } from '@/features/payroll/notifications';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';

export async function markEmployeeNotificationRead(key: string): Promise<{ success?: true; error?: string }> {
  const context = await requireEmployeeSelfContext();
  if (typeof key !== 'string' || !/^ess-payroll:[a-z0-9]+$/i.test(key) || key.length > 160) {
    return { error: 'Invalid notification. Refresh and try again.' };
  }
  const allowed = await prisma.$transaction(tx =>
    consumeAuthenticationAttempt(tx, `ess-notification-read:${context.organization.id}:${context.user.id}`, 120),
  );
  if (!allowed) return { error: 'Too many requests. Try again in 15 minutes.' };
  const payroll = await listPayrollNotifications({
    organizationId: context.organization.id,
    userId: context.user.id,
  });
  if (!payroll.some(notification => `ess-payroll:${notification.id}` === key)) {
    return { error: 'This notification is unavailable. Refresh and try again.' };
  }
  try {
    await prisma.hrNotificationRead.upsert({
      where: { organizationId_userId_notificationKey: {
        organizationId: context.organization.id,
        userId: context.user.id,
        notificationKey: key,
      } },
      create: {
        organizationId: context.organization.id,
        userId: context.user.id,
        notificationKey: key,
      },
      update: {},
    });
    return { success: true };
  } catch {
    return { error: 'Could not mark this notification as read. Please try again.' };
  }
}
