import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { canManageSchedules } from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { attendanceDateForInstant } from '@/features/attendance/domain';
import {
  getScheduleAssignmentOptions,
  getScheduleGroups,
  getScheduleAssignments,
} from '@/features/attendance/queries';
import { ScheduleManager } from '@/components/attendance/ScheduleManager';

export default async function AttendanceSchedulesPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!canManageSchedules(user)) redirect('/dashboard');

  const [groups, employees, assignments, org] = await Promise.all([
    getScheduleGroups(user.organizationId),
    getScheduleAssignmentOptions(user.organizationId),
    getScheduleAssignments(user.organizationId),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { timeZone: true },
    }),
  ]);

  const timeZone = org?.timeZone || 'Asia/Manila';
  const today = attendanceDateForInstant(new Date(), timeZone);

  const formattedGroups = groups.map((group) => ({
    id: group.id,
    scheduleKey: group.scheduleKey,
    name: group.name,
    description: group.description,
    isArchived: group.isArchived,
    versions: group.versions.map((version) => ({
      id: version.id,
      version: version.version,
      displayName: version.displayName,
      lateGraceSeconds: version.lateGraceSeconds,
      assignmentsCount: version._count.assignments,
    })),
  }));

  const formattedAssignments = assignments.map((assignment) => {
    const effectiveFromStr = assignment.effectiveFrom.toISOString().slice(0, 10);
    const effectiveToStr = assignment.effectiveTo ? assignment.effectiveTo.toISOString().slice(0, 10) : null;
    const isFuture = effectiveFromStr > today;
    const isPast = effectiveToStr ? effectiveToStr <= today : false;
    const hasAttendance = assignment._count.dailyAttendanceRecords > 0;
    const hasLeave = assignment._count.leaveRequestDays > 0;
    const isDeletable = isFuture && !hasAttendance && !hasLeave;

    let ineligibleReason = '';
    if (!isFuture) {
      ineligibleReason = 'Active or historical assignments cannot be deleted destructively. Set an end date or replace the assignment instead.';
    } else if (hasAttendance) {
      ineligibleReason = `Cannot delete: assignment has ${assignment._count.dailyAttendanceRecords} recorded attendance record(s).`;
    } else if (hasLeave) {
      ineligibleReason = `Cannot delete: assignment has ${assignment._count.leaveRequestDays} leave day(s) attached.`;
    }

    return {
      id: assignment.id,
      employeeId: assignment.employee.id,
      employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
      employeeNumber: assignment.employee.employeeNumber,
      scheduleName: assignment.scheduleVersion.scheduleGroup.name,
      scheduleKey: assignment.scheduleVersion.scheduleGroup.scheduleKey,
      versionNumber: assignment.scheduleVersion.version,
      effectiveFrom: effectiveFromStr,
      effectiveTo: effectiveToStr,
      status: (isFuture ? 'UPCOMING' : isPast ? 'PAST' : 'ACTIVE') as 'UPCOMING' | 'ACTIVE' | 'PAST',
      isDeletable,
      ineligibleReason,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#282934]">Work Schedules</h1>
        <p className="text-xs text-slate-500">
          Manage immutable versions, archive schedules, and configure effective-dated employee assignments
        </p>
      </div>

      <ScheduleManager
        groups={formattedGroups}
        employees={employees.map(({ id, employeeNumber, firstName, lastName }) => ({
          id,
          employeeNumber,
          firstName,
          lastName,
        }))}
        assignments={formattedAssignments}
      />
    </div>
  );
}
