import { LeaveRequestStatus, Prisma } from '@prisma/client';
import { decimalNumber } from './domain';
import { parseLeavePolicy } from './policy';
import { attendanceDateToDb } from '@/features/attendance/domain';

type LeaveReadDb = Pick<Prisma.TransactionClient, 'leaveType' | 'leaveRequest' | 'leaveLedgerEntry' | 'employmentRecord'>;

export async function getEmployeeLeaveOverviewData(db: LeaveReadDb, organizationId: string, employeeId: string, options: { recentRequests?: number } = {}) {
  const today = attendanceDateToDb(new Date().toISOString().slice(0, 10));
  const [types, requests, currentEmployment] = await Promise.all([
    db.leaveType.findMany({ where: { organizationId, isActive: true }, include: { cycles: { where: { isClosed: false }, orderBy: { startDate: 'desc' } } }, orderBy: { name: 'asc' } }),
    db.leaveRequest.findMany({ where: { organizationId, employeeId }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], ...(options.recentRequests === undefined ? {} : { take: options.recentRequests }), select: { id: true, leaveTypeNameSnapshot: true, requestCategoryCode: true, requestedStartDate: true, requestedEndDate: true, requestedUnits: true, status: true, submittedAt: true, reviewerRemarks: true, attendanceSyncStatus: true, _count: { select: { documents: true } } } }),
    db.employmentRecord.findFirst({ where: { employeeId, effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: today } }] }, orderBy: { effectiveFrom: 'desc' }, select: { employmentStatus: true } }),
  ]);
  const pairs = types.filter(type => type.balanceTracked).flatMap(type => type.cycles.map(cycle => ({ leaveTypeId: type.id, leaveCycleId: cycle.id })));
  // Aggregate in PostgreSQL: historical ledger entries are never loaded individually.
  // Pending groups include inactive/closed cycles too, for the dashboard's exact total.
  const [ledgerGroups, pendingGroups, grants] = await Promise.all([
    pairs.length ? db.leaveLedgerEntry.groupBy({ by: ['leaveTypeId', 'leaveCycleId'], where: { organizationId, employeeId, OR: pairs }, _sum: { amountUnits: true } }) : [],
    db.leaveRequest.groupBy({ by: ['leaveTypeId', 'leaveCycleId'], where: { organizationId, employeeId, status: LeaveRequestStatus.PENDING }, _sum: { requestedUnits: true }, _count: { _all: true, requestedUnits: true } }),
    pairs.length ? db.leaveLedgerEntry.findMany({ where: { organizationId, employeeId, OR: pairs, grantSource: 'DEFAULT_CYCLE_ENTITLEMENT' }, select: { leaveTypeId: true, leaveCycleId: true, amountUnits: true } }) : [],
  ]);
  const key = (type: string, cycle: string | null) => JSON.stringify([type, cycle]);
  const ledgerByCycle = new Map(ledgerGroups.map(group => [key(group.leaveTypeId, group.leaveCycleId), group]));
  const pendingByCycle = new Map(pendingGroups.map(group => [key(group.leaveTypeId, group.leaveCycleId), group]));
  const grantByCycle = new Map(grants.map(grant => [key(grant.leaveTypeId, grant.leaveCycleId), grant]));
  const balances = types.filter((type) => type.balanceTracked).flatMap((type) => type.cycles.map((cycle) => {
    const cycleKey = key(type.id, cycle.id);
    const ledger = ledgerByCycle.get(cycleKey), pending = pendingByCycle.get(cycleKey), defaultGrant = grantByCycle.get(cycleKey);
    const uncalculatedPending = pending ? pending._count._all - pending._count.requestedUnits : 0;
    const eligibleProjection = type.code === 'SICK_PERSONAL' && currentEmployment?.employmentStatus === 'REGULAR' && !defaultGrant && type.defaultGrantUnits;
    const entitlement = defaultGrant ? decimalNumber(defaultGrant.amountUnits) : eligibleProjection ? decimalNumber(type.defaultGrantUnits) : 0;
    const current = decimalNumber(ledger?._sum.amountUnits ?? null) + (eligibleProjection ? decimalNumber(type.defaultGrantUnits) : 0);
    const pendingUnits = decimalNumber(pending?._sum.requestedUnits ?? null);
    return { leaveTypeId: type.id, leaveTypeCode: type.code, leaveTypeName: type.name, cycleId: cycle.id, cycleName: cycle.name, annualEntitlement: entitlement, used: Math.max(0, entitlement - current), pending: pendingUnits, pendingCalculation: uncalculatedPending > 0, remaining: current - pendingUnits };
  }));
  return {
    balances,
    pendingRequestCount: pendingGroups.reduce((sum, group) => sum + group._count._all, 0),
    leaveTypes: types.map((type) => ({ id: type.id, code: type.code, name: type.name, description: type.description, countingMode: type.countingMode, balanceTracked: type.balanceTracked, cycles: type.cycles.map((cycle) => ({ id: cycle.id, name: cycle.name, startDate: cycle.startDate.toISOString().slice(0, 10), endDate: cycle.endDate.toISOString().slice(0, 10) })), policy: parseLeavePolicy(type) })),
    requests: requests.map((request) => ({ ...request, requestedStartDate: request.requestedStartDate.toISOString().slice(0, 10), requestedEndDate: request.requestedEndDate.toISOString().slice(0, 10), requestedUnits: request.requestedUnits == null ? null : decimalNumber(request.requestedUnits), submittedAt: request.submittedAt.toISOString(), documentCount: request._count.documents })),
  };
}
