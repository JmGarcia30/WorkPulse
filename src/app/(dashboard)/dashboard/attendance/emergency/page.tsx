import { notFound } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canRecordAttendance } from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { requestWorkspacePath } from '@/lib/tenant/server';
import Link from 'next/link';
import { EmergencyAttendanceRecoveryForm } from '@/components/attendance/EmergencyAttendanceRecoveryForm';

export default async function EmergencyAttendancePage() {
  const actor = await requireBackOfficeContext();
  if (!canRecordAttendance(actor)) notFound();
  const [organization, employees] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: actor.organizationId },
      select: { timeZone: true },
    }),
    prisma.employee.findMany({
      where: { organizationId: actor.organizationId, employeeStatus: 'ACTIVE' },
      select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ]);

  return <main className="space-y-5">
    <header className="space-y-2">
      <Link href={await requestWorkspacePath('/dashboard/attendance')} className="text-sm font-medium underline">Back to Attendance</Link>
      <h1 className="wp-page-title">Emergency Manual Attendance</h1>
      <p className="max-w-3xl text-sm italic text-[var(--wp-text-muted)]">
        Enter verified paper-log attendance after a power, network or RFID outage.
        This workflow does not change or impersonate an existing RFID scan.
      </p>
    </header>
    <EmergencyAttendanceRecoveryForm employees={employees} timeZone={organization.timeZone} />
  </main>;
}
