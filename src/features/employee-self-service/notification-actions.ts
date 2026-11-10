'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { listPayrollNotifications } from '@/features/payroll/notifications';
import { consumeAuthenticationAttempt } from '@/features/platform-admin/service';

/** Employee read receipts do not change payroll or the notification's delivery record. */
export async function markEmployeeNotificationRead(key: string): Promise<{ success?: true; error?: string }> {
  const context = await requireEmployeeSelfContext();
  if (typeof key !== 'string' || !/^payroll:[a-z0-9]{10,45}$/i.test(key)) {
    return { error: 'Invalid notification. Refresh the page and try again.' };
  }
  const rows = await listPayrollNotifications({
    organizationId: context.organization.id, userId: context.user.id,
  });
  if (!rows.some(row => `payroll:${row.id}` === key)) {
    return { error: 'This notification is no longer available to your account.' };
  }
  const allowed = await prisma.$transaction(tx => consumeAuthenticationAttempt(
    tx, `employee-notification-read:${context.organization.id}:${context.user.id}`, 120,
  ));
  if (!allowed) return { error: 'Too many requests. Please try again in 15 minutes.' };
  try {
    await prisma.hrNotificationRead.upsert({
      where: { organizationId_userId_notificationKey: {
        organizationId: context.organization.id, userId: context.user.id, notificationKey: key,
      } },
      create: { organizationId: context.organization.id, userId: context.user.id, notificationKey: key },
      update: {},
    });
    revalidatePath('/employee');
    revalidatePath('/employee/payroll');
    return { success: true };
  } catch {
    return { error: 'Unable to mark the notification as read. Try again.' };
  }
}
