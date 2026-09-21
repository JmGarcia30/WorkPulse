import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { decimalNumber } from './domain';
import { parseLeavePolicy } from './policy';
import { previewLeaveCalculation } from './service';

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

export async function getLeaveAdminOverview(organizationId: string) {
  const requests = await prisma.leaveRequest.findMany({ where: { organizationId }, orderBy: { submittedAt: 'desc' }, include: requestInclude });
  return {
    counts: {
      pending: requests.filter((item) => item.status === 'PENDING').length,
      approved: requests.filter((item) => item.status === 'APPROVED').length,
      closed: requests.filter((item) => ['REJECTED', 'CANCELLED', 'WITHDRAWN'].includes(item.status)).length,
    },
    pendingRequests: requests.filter((item) => item.status === 'PENDING').map(serializeRequest),
    recentRequests: requests.map(serializeRequest),
  };
}

export async function getLeaveAdminSettings(organizationId: string) {
  const types = await prisma.leaveType.findMany({ where: { organizationId }, include: { cycles: { orderBy: { startDate: 'desc' } } }, orderBy: { name: 'asc' } });
  return types.map((type) => ({ ...type, defaultGrantUnits: type.defaultGrantUnits ? decimalNumber(type.defaultGrantUnits) : null, maximumRequestUnits: type.maximumRequestUnits ? decimalNumber(type.maximumRequestUnits) : null, policy: parseLeavePolicy(type), cycles: type.cycles.map((cycle) => ({ ...cycle, startDate: cycle.startDate.toISOString().slice(0, 10), endDate: cycle.endDate.toISOString().slice(0, 10) })) }));
}

export async function getLeaveBalanceAdminData(organizationId: string) {
  const [types, employees] = await Promise.all([
    getLeaveAdminSettings(organizationId),
    prisma.employee.findMany({ where: { organizationId }, select: { id: true, employeeNumber: true, firstName: true, lastName: true, employeeStatus: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
  ]);
  return { types, employees };
}

export async function getLeaveAdminRequest(organizationId: string, requestId: string) {
  const request = await prisma.leaveRequest.findFirst({ where: { id: requestId, organizationId }, include: { ...requestInclude, leaveType: true, days: { orderBy: { attendanceDate: 'asc' } }, employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, employeeStatus: true, employmentRecords: { orderBy: { effectiveFrom: 'desc' }, take: 1, select: { employmentStatus: true, employmentCategory: true, effectiveFrom: true } } } } } });
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
  return { ...serializeRequest(request), employment: request.employee.employmentRecords[0] ?? null, employeeStatus: request.employee.employeeStatus, calculation, policy: parseLeavePolicy(request.leaveType) };
}
