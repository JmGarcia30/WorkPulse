import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { decimalNumber } from '../src/features/leave/domain';
import { getEmployeeLeaveOverviewData } from '../src/features/leave/read-model';
import { isSagaLeaveOrganization } from '../src/features/leave/organization-policy';

// Regression oracle: the pre-optimization per-cycle reads, against the SAME fixture
// snapshot. Covers projection, persisted grants, fractional deductions and reversals.
export async function assertLeaveEquivalence(db: Prisma.TransactionClient, organizationId: string, employeeId: string) {
  const overview = await getEmployeeLeaveOverviewData(db, organizationId, employeeId);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const employment = await db.employmentRecord.findFirst({ where: { employeeId, effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: today } }] }, orderBy: { effectiveFrom: 'desc' }, select: { employmentStatus: true } });
  const types = await db.leaveType.findMany({ where: { organizationId, isActive: true }, include: { organization: { select: { slug: true } }, cycles: { where: { isClosed: false }, orderBy: { startDate: 'desc' } } }, orderBy: { name: 'asc' } });
  const expected = [];
  for (const type of types.filter(type => type.balanceTracked)) for (const cycle of type.cycles) {
    const where = { organizationId, employeeId, leaveTypeId: type.id, leaveCycleId: cycle.id };
    const [ledger, pending, grant, uncalculated] = await Promise.all([
      db.leaveLedgerEntry.aggregate({ where, _sum: { amountUnits: true } }),
      db.leaveRequest.aggregate({ where: { ...where, status: 'PENDING' }, _sum: { requestedUnits: true } }),
      db.leaveLedgerEntry.findFirst({ where: { ...where, grantSource: 'DEFAULT_CYCLE_ENTITLEMENT' }, select: { amountUnits: true } }),
      db.leaveRequest.count({ where: { ...where, status: 'PENDING', requestedUnits: null } }),
    ]);
    const projection = isSagaLeaveOrganization(type.organization) && type.code === 'SICK_PERSONAL' && employment?.employmentStatus === 'REGULAR' && !grant && type.defaultGrantUnits;
    const entitlement = grant ? decimalNumber(grant.amountUnits) : projection ? decimalNumber(type.defaultGrantUnits) : 0;
    const current = decimalNumber(ledger._sum.amountUnits) + (projection ? decimalNumber(type.defaultGrantUnits) : 0);
    const pendingUnits = decimalNumber(pending._sum.requestedUnits);
    expected.push({ leaveTypeId: type.id, leaveTypeCode: type.code, leaveTypeName: type.name, cycleId: cycle.id, cycleName: cycle.name, annualEntitlement: entitlement, used: Math.max(0, entitlement - current), pending: pendingUnits, pendingCalculation: uncalculated > 0, remaining: current - pendingUnits });
  }
  assert.deepEqual(overview.balances, expected, 'Batched balances must exactly match the prior read model');
  assert.equal(overview.pendingRequestCount, overview.requests.filter(request => request.status === 'PENDING').length);
  const recent = await getEmployeeLeaveOverviewData(db, organizationId, employeeId, { recentRequests: 1 });
  assert.deepEqual(recent.balances, overview.balances);
  assert.equal(recent.pendingRequestCount, overview.pendingRequestCount);
  assert.deepEqual(recent.requests, overview.requests.slice(0, 1));
}
