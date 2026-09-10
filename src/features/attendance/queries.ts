import 'server-only';

import { AttendanceStatus, EmploymentCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { attendanceDateToDb, instantForLocalSecond, summarizeAttendanceIndicators } from './domain';

export interface AttendancePeriodFilters {
  from: string;
  to: string;
  employeeId?: string;
  department?: string;
  category?: EmploymentCategory;
  status?: AttendanceStatus;
}

export async function getAttendancePeriod(
  organizationId: string,
  filters: AttendancePeriodFilters
) {
  const records = await prisma.dailyAttendanceRecord.findMany({
    where: {
      organizationId,
      attendanceDate: { gte: attendanceDateToDb(filters.from), lte: attendanceDateToDb(filters.to) },
      employeeId: filters.employeeId,
      attendanceStatus: filters.status,
      employmentRecord: {
        department: filters.department,
        employmentCategory: filters.category,
      },
    },
    include: {
      employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
      employmentRecord: { select: { department: true, employmentCategory: true } },
      scheduleAssignment: {
        include: { scheduleVersion: { include: { scheduleGroup: { select: { name: true } } } } },
      },
    },
    orderBy: [{ attendanceDate: 'desc' }, { employee: { lastName: 'asc' } }],
  });
  return records.map((record) => ({
    id: record.id,
    attendanceDate: record.attendanceDate.toISOString().slice(0, 10),
    employee: record.employee,
    department: record.employmentRecord.department,
    category: record.employmentRecord.employmentCategory,
    scheduleName: record.scheduleAssignment?.scheduleVersion.displayName ?? null,
    scheduleVersion: record.scheduleAssignment?.scheduleVersion.version ?? null,
    firstTimeIn: record.firstTimeIn,
    lastTimeOut: record.lastTimeOut,
    workedSeconds: record.workedSeconds,
    lateSeconds: record.lateSeconds,
    undertimeSeconds: record.undertimeSeconds,
    overtimeSeconds: record.overtimeSeconds,
    status: record.attendanceStatus,
    corrected: record.correctionVersion > 0,
    hasAnomaly: record.hasUnclassifiedEvents || record.hasOutBeforeIn,
  }));
}

export async function getAttendanceFilterOptions(organizationId: string) {
  const [employees, employment] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId },
      select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.employmentRecord.findMany({
      where: { employee: { organizationId } },
      distinct: ['department'],
      select: { department: true },
      orderBy: { department: 'asc' },
    }),
  ]);
  return { employees, departments: employment.map((item) => item.department) };
}

export async function getEmployeeAttendanceDetail(
  organizationId: string,
  employeeId: string,
  from: string,
  to: string
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    select: { id: true, employeeNumber: true, firstName: true, lastName: true },
  });
  if (!employee) return null;
  const records = await prisma.dailyAttendanceRecord.findMany({
    where: { organizationId, employeeId, attendanceDate: { gte: attendanceDateToDb(from), lte: attendanceDateToDb(to) } },
    include: {
      scheduleAssignment: { include: { scheduleVersion: true } },
      corrections: {
        orderBy: { revision: 'desc' },
        include: { createdBy: { select: { name: true } } },
      },
    },
    orderBy: { attendanceDate: 'desc' },
  });
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timeZone: true } });
  const fromInstant = instantForLocalSecond(from, 0, organization.timeZone);
  const through = instantForLocalSecond(to, 86_400, organization.timeZone);
  const events = await prisma.attendanceEvent.findMany({
    where: { organizationId, employeeId, occurredAt: { gte: fromInstant, lt: through } },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    select: { id: true, occurredAt: true, direction: true, source: true, createdAt: true },
  });
  const indicators = summarizeAttendanceIndicators(records.map((record) => ({
    attendanceDate: record.attendanceDate.toISOString().slice(0, 10),
    status: record.attendanceStatus,
    lateSeconds: record.lateSeconds,
  })));
  return { employee, timeZone: organization.timeZone, records, events, indicators };
}

export function getScheduleGroups(organizationId: string) {
  return prisma.workScheduleGroup.findMany({
    where: { organizationId },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        include: { days: { orderBy: { isoWeekday: 'asc' }, include: { breaks: true } }, _count: { select: { assignments: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export function getScheduleAssignmentOptions(organizationId: string) {
  return prisma.employee.findMany({
    where: { organizationId },
    select: {
      id: true, employeeNumber: true, firstName: true, lastName: true,
      scheduleAssignments: {
        orderBy: { effectiveFrom: 'desc' }, take: 1,
        include: { scheduleVersion: true },
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export type AttendancePeriodRow = Prisma.PromiseReturnType<typeof getAttendancePeriod>[number];
