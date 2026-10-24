import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { decimalNumber } from './domain';
import { isSagaLeaveOrganization } from './organization-policy';
import { parseLeavePolicy } from './policy';
import { previewLeaveCalculation } from './service';
import { attendanceDateForInstant, parseAttendanceDate } from '@/features/attendance/domain';

const requestInclude = {
  employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
  documents: { where: { removedAt: null }, select: { id: true, kindCode: true, fileName: true } },
} as const;

type AdminRequestRecord = Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>;

function serializeRequest(request: AdminRequestRecord) {
  return {
    id: request.id, employeeId: request.employeeId, employee: request.employee,
    employeeName: request.employeeNameSnapshot ?? `${request.employee.firstName} ${request.employee.lastName}`.trim(),
    organizationName: request.organizationNameSnapshot,
    organizationTimeZone: request.organizationTimeZoneSnapshot ?? 'UTC',
    type: request.leaveTypeNameSnapshot, typeCode: request.leaveTypeCodeSnapshot,
    category: request.requestCategoryCode,
    from: request.requestedStartDate.toISOString().slice(0, 10),
    to: request.requestedEndDate.toISOString().slice(0, 10),
    expectedReturnDate: request.expectedReturnDateSnapshot?.toISOString().slice(0, 10) ?? null,
    units: request.requestedUnits == null ? null : decimalNumber(request.requestedUnits), reason: request.reason, status: request.status,
    submittedAt: request.submittedAt.toISOString(), reviewedAt: request.reviewedAt?.toISOString() ?? null,
    reviewerName: request.reviewerNameSnapshot, remarks: request.reviewerRemarks,
    attendanceSyncStatus: request.attendanceSyncStatus,
    eligibilityAttestation: request.eligibilityAttestation,
    eligibilityVerification: request.eligibilityVerification,
    documents: request.documents,
  };
}

export type SerializedLeaveRequest = ReturnType<typeof serializeRequest>;

export interface LeaveAdminOverviewData {
  counts: {
    pending: number;
    approved: number;
    closed: number;
  };
  summary: {
    pending: number;
    approvedThisMonth: number;
    approvedLastMonth: number;
    approvedDiff: number;
    rejectedCancelled: number;
    totalClosed: number;
    onLeaveToday: number;
  };
  upcomingApproved: SerializedLeaveRequest[];
  activityData: {
    weekly: Array<{ date: string; label: string; approved: number; pending: number }>;
    monthly: Array<{ date: string; label: string; approved: number; pending: number }>;
  };
  leaveTypes: Array<{ id: string; code: string; name: string }>;
  pendingRequests: SerializedLeaveRequest[];
  allRequests: SerializedLeaveRequest[];
  recentRequests: SerializedLeaveRequest[];
  timeZone: string;
  today: string;
}

export async function getLeaveAdminOverview(organizationId: string): Promise<LeaveAdminOverviewData> {
  const [requests, leaveTypes, organization] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { organizationId },
      orderBy: { submittedAt: 'desc' },
      include: requestInclude,
    }),
    prisma.leaveType.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timeZone: true },
    }),
  ]);

  const timeZone = organization?.timeZone ?? 'Asia/Manila';
  const todayStr = attendanceDateForInstant(new Date(), timeZone);
  const currentMonth = todayStr.slice(0, 7);

  const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
  const prevMonthDate = new Date(Date.UTC(currentYear, currentMonthNum - 2, 1));
  const prevMonth = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;

  const allRequests = requests.map(serializeRequest);
  const pendingRequests = allRequests.filter((item) => item.status === 'PENDING');
  const approvedRequests = allRequests.filter((item) => item.status === 'APPROVED');
  const closedRequests = allRequests.filter((item) => ['REJECTED', 'CANCELLED', 'WITHDRAWN'].includes(item.status));

  const approvedThisMonth = approvedRequests.filter((item) => {
    return item.from.startsWith(currentMonth) || (item.reviewedAt ? attendanceDateForInstant(new Date(item.reviewedAt), timeZone).startsWith(currentMonth) : false);
  }).length;

  const approvedLastMonth = approvedRequests.filter((item) => {
    return item.from.startsWith(prevMonth) || (item.reviewedAt ? attendanceDateForInstant(new Date(item.reviewedAt), timeZone).startsWith(prevMonth) : false);
  }).length;

  const approvedDiff = approvedThisMonth - approvedLastMonth;

  const rejectedThisMonth = closedRequests.filter((item) => {
    return item.from.startsWith(currentMonth) || (item.reviewedAt ? attendanceDateForInstant(new Date(item.reviewedAt), timeZone).startsWith(currentMonth) : false) || (item.submittedAt ? attendanceDateForInstant(new Date(item.submittedAt), timeZone).startsWith(currentMonth) : false);
  }).length;

  const onLeaveToday = approvedRequests.filter((item) => item.from <= todayStr && item.to >= todayStr).length;

  const upcomingApproved = approvedRequests
    .filter((item) => item.to >= todayStr)
    .sort((a, b) => a.from.localeCompare(b.from))
    .slice(0, 8);

  const todayTemporal = parseAttendanceDate(todayStr);
  const weeklyDays: Array<{ date: string; label: string; approved: number; pending: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = todayTemporal.subtract({ days: i });
    const dStr = d.toString();
    const dateObj = new Date(`${dStr}T00:00:00Z`);
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(dateObj);
    const approvedCount = approvedRequests.filter((r) => r.from <= dStr && r.to >= dStr).length;
    const pendingCount = pendingRequests.filter((r) => r.from <= dStr && r.to >= dStr).length;
    weeklyDays.push({ date: dStr, label, approved: approvedCount, pending: pendingCount });
  }

  const monthlyDays: Array<{ date: string; label: string; approved: number; pending: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = todayTemporal.subtract({ days: i });
    const dStr = d.toString();
    const dateObj = new Date(`${dStr}T00:00:00Z`);
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(dateObj);
    const approvedCount = approvedRequests.filter((r) => r.from <= dStr && r.to >= dStr).length;
    const pendingCount = pendingRequests.filter((r) => r.from <= dStr && r.to >= dStr).length;
    monthlyDays.push({ date: dStr, label, approved: approvedCount, pending: pendingCount });
  }

  return {
    counts: {
      pending: pendingRequests.length,
      approved: approvedRequests.length,
      closed: closedRequests.length,
    },
    summary: {
      pending: pendingRequests.length,
      approvedThisMonth,
      approvedLastMonth,
      approvedDiff,
      rejectedCancelled: rejectedThisMonth > 0 ? rejectedThisMonth : closedRequests.length,
      totalClosed: closedRequests.length,
      onLeaveToday,
    },
    upcomingApproved,
    activityData: {
      weekly: weeklyDays,
      monthly: monthlyDays,
    },
    leaveTypes,
    pendingRequests,
    allRequests,
    recentRequests: allRequests,
    timeZone,
    today: todayStr,
  };
}

export async function getLeaveAdminSettings(organizationId: string) {
  const types = await prisma.leaveType.findMany({ where: { organizationId }, include: { cycles: { orderBy: { startDate: 'desc' } } }, orderBy: { name: 'asc' } });
  return types.map((type) => ({ ...type, defaultGrantUnits: type.defaultGrantUnits ? decimalNumber(type.defaultGrantUnits) : null, maximumRequestUnits: type.maximumRequestUnits ? decimalNumber(type.maximumRequestUnits) : null, policy: parseLeavePolicy(type), cycles: type.cycles.map((cycle) => ({ ...cycle, startDate: cycle.startDate.toISOString().slice(0, 10), endDate: cycle.endDate.toISOString().slice(0, 10) })) }));
}

export async function getLeaveBalanceAdminData(organizationId: string) {
  const [types, employees, organization] = await Promise.all([
    getLeaveAdminSettings(organizationId),
    prisma.employee.findMany({ where: { organizationId }, select: { id: true, employeeNumber: true, firstName: true, lastName: true, employeeStatus: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } }),
  ]);
  return { types, employees, isSagaOrganization: isSagaLeaveOrganization(organization) };
}

export async function getLeaveAdminRequest(organizationId: string, requestId: string) {
  const request = await prisma.leaveRequest.findFirst({ where: { id: requestId, organizationId }, include: { ...requestInclude, leaveType: { include: { organization: { select: { slug: true } } } }, days: { orderBy: { attendanceDate: 'asc' } }, employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, employeeStatus: true, employmentRecords: { orderBy: { effectiveFrom: 'desc' }, take: 1, select: { employmentStatus: true, employmentCategory: true, effectiveFrom: true } } } } } });
  if (!request) return null;
  const calculation = request.status === 'PENDING' ? await previewLeaveCalculation({
    organizationId,
    employeeId: request.employeeId,
    from: request.requestedStartDate.toISOString().slice(0, 10),
    to: request.requestedEndDate.toISOString().slice(0, 10),
    countingMode: request.countingModeSnapshot,
    requiredEmploymentStatus: request.leaveType.requiredEmploymentStatus,
  }) : {
    status: 'READY' as const,
    units: request.requestedUnits == null ? 0 : decimalNumber(request.requestedUnits),
    scheduledWorkdays: request.days.filter((day) => day.isScheduledWorkday).length,
    scheduleNames: [...new Set(request.days.map((day) => (day.scheduleSnapshot as { displayName?: string } | null)?.displayName).filter((name): name is string => Boolean(name)))],
    expectedReturnDate: request.expectedReturnDateSnapshot?.toISOString().slice(0, 10) ?? null,
  };
  return { ...serializeRequest(request), isSagaOrganization: isSagaLeaveOrganization(request.leaveType.organization), employment: request.employee.employmentRecords[0] ?? null, employeeStatus: request.employee.employeeStatus, calculation, policy: parseLeavePolicy(request.leaveType) };
}
