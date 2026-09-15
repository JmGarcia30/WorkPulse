import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { decimalNumber } from './domain';
import { getEmployeeLeaveOverviewData } from './read-model';

export async function getMyLeaveOverview() {
  const context = await requireEmployeeSelfContext();
  return getEmployeeLeaveOverviewData(prisma, context.organization.id, context.employee.id);
}

export async function getMyLeaveRequest(requestId: string) {
  const context = await requireEmployeeSelfContext();
  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, organizationId: context.organization.id, employeeId: context.employee.id },
    include: { days: { orderBy: { attendanceDate: 'asc' } }, documents: { where: { removedAt: null }, select: { id: true, kindCode: true, fileName: true, fileType: true, fileSize: true, createdAt: true } } },
  });
  if (!request) return null;
  return { id: request.id, type: request.leaveTypeNameSnapshot, category: request.requestCategoryCode, from: request.requestedStartDate.toISOString().slice(0, 10), to: request.requestedEndDate.toISOString().slice(0, 10), expectedReturnDate: request.expectedReturnDateSnapshot?.toISOString().slice(0, 10) ?? null, units: decimalNumber(request.requestedUnits), reason: request.reason, status: request.status, submittedAt: request.submittedAt.toISOString(), reviewedAt: request.reviewedAt?.toISOString() ?? null, reviewerName: request.reviewerNameSnapshot, employeeName: request.employeeNameSnapshot ?? `${context.employee.firstName} ${context.employee.lastName}`.trim(), organizationName: request.organizationNameSnapshot ?? context.organization.name, organizationTimeZone: request.organizationTimeZoneSnapshot ?? context.organization.timeZone, reviewerRemarks: request.reviewerRemarks, attendanceSyncStatus: request.attendanceSyncStatus, days: request.days.map((day) => ({ date: day.attendanceDate.toISOString().slice(0, 10), charged: decimalNumber(day.chargeUnits), scheduled: day.isScheduledWorkday })), documents: request.documents };
}
