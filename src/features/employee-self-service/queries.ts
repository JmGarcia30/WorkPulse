import 'server-only';

import { Temporal } from '@js-temporal/polyfill';
import { prisma } from '@/lib/db/prisma';
import { attendanceDateForInstant, attendanceDateToDb, parseAttendanceDate } from '@/features/attendance/domain';
import { requireEmployeeSelfContext } from './context';

function activeAt(asOf: Date) {
  return { effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] };
}

async function scheduleFor(date: string) {
  const context = await requireEmployeeSelfContext();
  const assignment = await prisma.employeeScheduleAssignment.findFirst({
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

export async function getMyCurrentSchedule(asOf = new Date()) {
  const context = await requireEmployeeSelfContext();
  const date = attendanceDateForInstant(asOf, context.organization.timeZone);
  return scheduleFor(date);
}

export async function getMyProfile(asOf = new Date()) {
  const context = await requireEmployeeSelfContext();
  const employee = await prisma.employee.findFirst({
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
  return { employee, loginEmail: context.user.email, schedule: await getMyCurrentSchedule(asOf), organization: context.organization };
}

export async function getMyDashboard(asOf = new Date()) {
  const context = await requireEmployeeSelfContext();
  const today = attendanceDateForInstant(asOf, context.organization.timeZone);
  const [profile, attendance] = await Promise.all([
    getMyProfile(asOf),
    prisma.dailyAttendanceRecord.findUnique({
      where: { organizationId_employeeId_attendanceDate: { organizationId: context.organization.id, employeeId: context.employee.id, attendanceDate: attendanceDateToDb(today) } },
      select: { attendanceDate: true, timeZoneSnapshot: true, scheduledStartAt: true, scheduledEndAt: true, firstTimeIn: true, lastTimeOut: true, attendanceStatus: true },
    }),
  ]);
  return { today, profile, attendance };
}

export async function getMyAttendance(filters: { from: string; to: string }) {
  const context = await requireEmployeeSelfContext();
  const from = parseAttendanceDate(filters.from);
  const to = parseAttendanceDate(filters.to);
  if (Temporal.PlainDate.compare(to, from) < 0 || from.until(to).days > 92) throw new Error('Attendance range must be between 1 and 93 days.');
  const rows = await prisma.dailyAttendanceRecord.findMany({
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
  }));
}
