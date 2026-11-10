import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { listPayrollNotifications } from '@/features/payroll/notifications';
import type { EmployeeSelfContext } from '@/features/employee-self-service/context';
import type { NotificationPopoverItem } from '@/components/ui/NotificationPopover';

/** Read only actual payroll notifications addressed to the logged-in ESS account. */
export async function listEmployeeHeaderNotifications(context: EmployeeSelfContext): Promise<NotificationPopoverItem[]> {
  const rows = await listPayrollNotifications({
    organizationId: context.organization.id,
    userId: context.user.id,
  });
  const keys = rows.map(row => `payroll:${row.id}`);
  const receipts = keys.length ? await prisma.hrNotificationRead.findMany({
    where: {
      organizationId: context.organization.id,
      userId: context.user.id,
      notificationKey: { in: keys },
    },
    select: { notificationKey: true },
  }) : [];
  const read = new Set(receipts.map(row => row.notificationKey));
  return rows.map(row => ({
    key: `payroll:${row.id}`,
    title: 'Payslip available',
    description: row.message,
    href: `/employee/payroll/${row.payrollEntryId}`,
    createdAt: row.createdAt.toISOString(),
    read: read.has(`payroll:${row.id}`),
  }));
}
