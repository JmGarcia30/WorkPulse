import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { listPayrollNotifications } from '@/features/payroll/notifications';
import type { HeaderNotification } from '@/components/layout/HeaderNotificationPopover';

/** Reuse the existing per-user read-receipt table without modifying schema. */
export async function listEmployeeHeaderNotifications(): Promise<HeaderNotification[]> {
  const context = await requireEmployeeSelfContext();
  const payroll = await listPayrollNotifications({
    organizationId: context.organization.id,
    userId: context.user.id,
  });
  const keys = payroll.map(item => `ess-payroll:${item.id}`);
  const receipts = keys.length ? await prisma.hrNotificationRead.findMany({
    where: {
      organizationId: context.organization.id,
      userId: context.user.id,
      notificationKey: { in: keys },
    },
    select: { notificationKey: true },
  }) : [];
  const readKeys = new Set(receipts.map(row => row.notificationKey));
  return payroll.map(item => ({
    key: `ess-payroll:${item.id}`,
    category: 'payroll' as const,
    title: 'Payslip available',
    description: item.message,
    href: `/employee/payroll/${item.payrollEntryId}`,
    createdAt: item.createdAt.toISOString(),
    read: readKeys.has(`ess-payroll:${item.id}`),
  })).sort((a,b) => Number(a.read)-Number(b.read) || b.createdAt.localeCompare(a.createdAt));
}
