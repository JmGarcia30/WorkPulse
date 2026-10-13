import { Temporal } from '@js-temporal/polyfill';
import type { Prisma } from '@prisma/client';
import type { EmployeeSelfContext } from './access';
import { attendanceDateForInstant, attendanceDateToDb, parseAttendanceDate } from '@/features/attendance/domain';
import { getEmployeeLeaveOverviewData } from '@/features/leave/read-model';
import { listFinalizedPayslipsForEmployee } from '@/features/payroll/payslip';
import { summarizeAttendanceIndicators } from '@/features/attendance/domain';

// Internal reads receive the authenticated scope from the server-only query wrappers.
// Keep client-supplied employee/organization identifiers out of these entry points.
function activeAt(asOf: Date) {
  return { effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] };
}

async function scheduleFor(context: EmployeeSelfContext, db: Prisma.TransactionClient, date: string) {
  const assignment = await db.employeeScheduleAssignment.findFirst({
    where: {
      organizationId: context.organization.id,
      employeeId: context.employee.id,
      effectiveFrom: { lte: attendanceDateToDb(date) },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: attendanceDateToDb(date) } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    select: {
      effectiveFrom: true,
      effectiveTo: true,
      scheduleVersion: {
        select: {
          displayName: true,
          days: {
            orderBy: { isoWeekday: 'asc' },
            select: { isoWeekday: true, isWorkday: true, expectedStartSecond: true, expectedEndSecond: true, breaks: { select: { startSecond: true, endSecond: true, isPaid: true } } },
          },
        },
      },
    },
  });
  if (!assignment) return null;
  return {
    name: assignment.scheduleVersion.displayName,
    effectiveFrom: assignment.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: assignment.effectiveTo?.toISOString().slice(0, 10) ?? null,
    days: assignment.scheduleVersion.days,
  };
}

export async function getMyCurrentSchedule(context: EmployeeSelfContext, db: Prisma.TransactionClient, asOf = new Date()) {
  const date = attendanceDateForInstant(asOf, context.organization.timeZone);
  return scheduleFor(context, db, date);
}

export async function getMyProfile(context: EmployeeSelfContext, db: Prisma.TransactionClient, asOf = new Date()) {
  const employee = await db.employee.findFirst({
    where: { id: context.employee.id, organizationId: context.organization.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      employeeNumber: true,
      employeeStatus: true,
      employmentRecords: {
        where: activeAt(asOf),
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        select: {
          jobTitle: true,
          department: true,
          employmentCategory: true,
          employmentType: true,
          employmentStatus: true,
          payFrequency: true,
          hireDate: true,
          startDate: true,
          effectiveFrom: true,
          effectiveTo: true,
          probation: { select: { startedAt: true, expectedEndAt: true, probationStatus: true } },
        },
      },
    },
  });
  if (!employee) return null;
  return { employee, loginEmail: context.user.email, schedule: await getMyCurrentSchedule(context, db, asOf), organization: context.organization };
}

export async function getMyDashboard(context: EmployeeSelfContext, db: Prisma.TransactionClient, asOf = new Date()) {
  const today = attendanceDateForInstant(asOf, context.organization.timeZone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [profile, attendance, monthRows, leave, payslips] = await Promise.all([
    getMyProfile(context, db, asOf),
    db.dailyAttendanceRecord.findUnique({
      where: { organizationId_employeeId_attendanceDate: { organizationId: context.organization.id, employeeId: context.employee.id, attendanceDate: attendanceDateToDb(today) } },
      select: { attendanceDate: true, timeZoneSnapshot: true, scheduledStartAt: true, scheduledEndAt: true, firstTimeIn: true, lastTimeOut: true, attendanceStatus: true },
    }),
    getMyAttendance(context, db, { from: monthStart, to: today }),
    getEmployeeLeaveOverviewData(db, context.organization.id, context.employee.id),
    listFinalizedPayslipsForEmployee({ organizationId: context.organization.id, userId: context.user.id }, db),
  ]);
  const indicators = summarizeAttendanceIndicators(monthRows.map(row => ({ attendanceDate: row.date, status: row.status, disposition: row.disposition, lateSeconds: row.lateSeconds })));
  return { today, profile, attendance, monthSummary: {
    recordedDays: monthRows.length,
    presentDays: monthRows.filter(row => row.status === 'PRESENT' && row.disposition !== 'APPROVED_LEAVE').length,
    lateOccurrences: indicators.tardinessCount,
    approvedLeaveDays: monthRows.filter(row => row.disposition === 'APPROVED_LEAVE').length,
  }, leave, latestPayroll: payslips[0] ?? null };
}

export async function getMyAttendance(context: EmployeeSelfContext, db: Prisma.TransactionClient, filters: { from: string; to: string }) {
  const from = parseAttendanceDate(filters.from);
  const to = parseAttendanceDate(filters.to);
  if (Temporal.PlainDate.compare(to, from) < 0 || from.until(to).days > 92) throw new Error('Attendance range must be between 1 and 93 days.');
  const rows = await db.dailyAttendanceRecord.findMany({
    where: {
      organizationId: context.organization.id,
      employeeId: context.employee.id,
      attendanceDate: { gte: attendanceDateToDb(filters.from), lte: attendanceDateToDb(filters.to) },
    },
    orderBy: { attendanceDate: 'desc' },
    select: {
      id: true,
      attendanceDate: true,
      timeZoneSnapshot: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      firstTimeIn: true,
      lastTimeOut: true,
      workedSeconds: true,
      lateSeconds: true,
      undertimeSeconds: true,
      overtimeSeconds: true,
      attendanceStatus: true,
      correctionVersion: true,
      disposition: true,
      leaveTypeNameSnapshot: true,
      hasLeaveAttendanceConflict: true,
      scheduleAssignment: { select: { scheduleVersion: { select: { displayName: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    date: row.attendanceDate.toISOString().slice(0, 10),
    timeZone: row.timeZoneSnapshot,
    scheduleName: row.scheduleAssignment?.scheduleVersion.displayName ?? null,
    scheduledStartAt: row.scheduledStartAt,
    scheduledEndAt: row.scheduledEndAt,
    firstTimeIn: row.firstTimeIn,
    lastTimeOut: row.lastTimeOut,
    workedSeconds: row.workedSeconds,
    lateSeconds: row.lateSeconds,
    undertimeSeconds: row.undertimeSeconds,
    overtimeSeconds: row.overtimeSeconds,
    status: row.attendanceStatus,
    corrected: row.correctionVersion > 0,
    disposition: row.disposition,
    leaveTypeName: row.leaveTypeNameSnapshot,
    leaveAttendanceConflict: row.hasLeaveAttendanceConflict,
  }));
}

export async function getOwnLeaveRequest(context: EmployeeSelfContext, db: Prisma.TransactionClient, requestId: string) {
  const request = await db.leaveRequest.findFirst({
    where: { id: requestId, organizationId: context.organization.id, employeeId: context.employee.id },
    include: { days: { orderBy: { attendanceDate: 'asc' } }, documents: { where: { removedAt: null }, select: { id: true, kindCode: true, fileName: true, fileType: true, fileSize: true, createdAt: true } } },
  });
  return request;
}
