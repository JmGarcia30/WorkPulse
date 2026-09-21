import { LeaveRequestStatus, Prisma } from '@prisma/client';
import { decimalNumber } from './domain';
import { parseLeavePolicy } from './policy';
import { attendanceDateToDb } from '@/features/attendance/domain';

type LeaveReadDb = Pick<Prisma.TransactionClient, 'leaveType' | 'leaveRequest' | 'leaveLedgerEntry' | 'employmentRecord'>;

export async function getEmployeeLeaveOverviewData(db: LeaveReadDb, organizationId: string, employeeId: string) {
  const today = attendanceDateToDb(new Date().toISOString().slice(0, 10));
  const [types, requests, currentEmployment] = await Promise.all([
    db.leaveType.findMany({ where: { organizationId, isActive: true }, include: { cycles: { where: { isClosed: false }, orderBy: { startDate: 'desc' } } }, orderBy: { name: 'asc' } }),
    db.leaveRequest.findMany({ where: { organizationId, employeeId }, orderBy: { submittedAt: 'desc' }, select: { id: true, leaveTypeNameSnapshot: true, requestCategoryCode: true, requestedStartDate: true, requestedEndDate: true, requestedUnits: true, status: true, submittedAt: true, reviewerRemarks: true, attendanceSyncStatus: true, _count: { select: { documents: true } } } }),
    db.employmentRecord.findFirst({ where: { employeeId, effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: today } }] }, orderBy: { effectiveFrom: 'desc' }, select: { employmentStatus: true } }),
  ]);
  const balances = await Promise.all(types.filter((type) => type.balanceTracked).flatMap((type) => type.cycles.map(async (cycle) => {
    const [ledger, pending, defaultGrant, uncalculatedPending] = await Promise.all([
      db.leaveLedgerEntry.aggregate({ where: { organizationId, employeeId, leaveTypeId: type.id, leaveCycleId: cycle.id }, _sum: { amountUnits: true } }),
      db.leaveRequest.aggregate({ where: { organizationId, employeeId, leaveTypeId: type.id, leaveCycleId: cycle.id, status: LeaveRequestStatus.PENDING }, _sum: { requestedUnits: true } }),
      db.leaveLedgerEntry.findFirst({ where: { organizationId, employeeId, leaveTypeId: type.id, leaveCycleId: cycle.id, grantSource: 'DEFAULT_CYCLE_ENTITLEMENT' }, select: { amountUnits: true } }),
      db.leaveRequest.count({ where: { organizationId, employeeId, leaveTypeId: type.id, leaveCycleId: cycle.id, status: LeaveRequestStatus.PENDING, requestedUnits: null } }),
    ]);
    const eligibleProjection = type.code === 'SICK_PERSONAL' && currentEmployment?.employmentStatus === 'REGULAR' && !defaultGrant && type.defaultGrantUnits;
    const entitlement = defaultGrant ? decimalNumber(defaultGrant.amountUnits) : eligibleProjection ? decimalNumber(type.defaultGrantUnits) : 0;
    const current = decimalNumber(ledger._sum.amountUnits) + (eligibleProjection ? decimalNumber(type.defaultGrantUnits) : 0);
    const pendingUnits = decimalNumber(pending._sum.requestedUnits);
    return { leaveTypeId: type.id, leaveTypeCode: type.code, leaveTypeName: type.name, cycleId: cycle.id, cycleName: cycle.name, annualEntitlement: entitlement, used: Math.max(0, entitlement - current), pending: pendingUnits, pendingCalculation: uncalculatedPending > 0, remaining: current - pendingUnits };
  })));
  return {
    balances,
    leaveTypes: types.map((type) => ({ id: type.id, code: type.code, name: type.name, description: type.description, countingMode: type.countingMode, balanceTracked: type.balanceTracked, cycles: type.cycles.map((cycle) => ({ id: cycle.id, name: cycle.name, startDate: cycle.startDate.toISOString().slice(0, 10), endDate: cycle.endDate.toISOString().slice(0, 10) })), policy: parseLeavePolicy(type) })),
    requests: requests.map((request) => ({ ...request, requestedStartDate: request.requestedStartDate.toISOString().slice(0, 10), requestedEndDate: request.requestedEndDate.toISOString().slice(0, 10), requestedUnits: request.requestedUnits == null ? null : decimalNumber(request.requestedUnits), submittedAt: request.submittedAt.toISOString(), documentCount: request._count.documents })),
  };
}
