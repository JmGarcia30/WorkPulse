import { Prisma, type EmployeeStatus, type EmploymentCategory } from '@prisma/client';
import type { UserSessionPayload } from '@/lib/auth/session';
import { canViewAnalytics } from '@/lib/permissions/rbac';
import { deriveProbationReviewState, PROBATION_ENDING_SOON_DAYS, utcStartOfDay } from '@/features/employees/domain';
import { resolveAnalyticsRange, type AnalyticsFilters } from './date-range';

export class AnalyticsAccessError extends Error {
  readonly code = 'FORBIDDEN';
}

type CurrencyTotal = { currency: string; entries: number; gross: string; deductions: string; net: string };
type PayrollAggregate = { periodId: string; currency: string | null; entries: bigint; gross: Prisma.Decimal; deductions: Prisma.Decimal; net: Prisma.Decimal };
type AttendanceAggregate = { attendanceStatus: string; disposition: string; count: bigint; finalized: bigint; late: bigint };

// Internal, read-only database entry point. The session comes from the server guard,
// never request parameters. Revalidate the persisted actor before reading any HR data.
export async function readAnalytics(session: UserSessionPayload | null, db: Prisma.TransactionClient, filters: AnalyticsFilters = {}, asOf = new Date()) {
  if (!canViewAnalytics(session) || !session) throw new AnalyticsAccessError('Analytics access is unavailable.');
  // A single joined read still validates the persisted actor on every invocation.
  const [actor] = await db.$queryRaw<Array<{ organizationId: string; timeZone: string }>>(Prisma.sql`
    SELECT u."organizationId", o."timeZone" FROM "User" u
    JOIN "Organization" o ON o."id" = u."organizationId"
    WHERE u."id" = ${session.userId} AND u."organizationId" = ${session.organizationId}
      AND u."role"::text = ${session.role}
  `);
  if (!actor) throw new AnalyticsAccessError('Analytics access is unavailable.');
  const organizationId = actor.organizationId;
  const range = resolveAnalyticsRange(filters, actor.timeZone, asOf);
  // Normalize Prisma's lazy thenable once; filtered and unfiltered paths reuse it.
  const employeesPromise = Promise.resolve(db.employee.findMany({
    where: { organizationId },
    select: {
      id: true, firstName: true, lastName: true, employeeNumber: true, employeeStatus: true, createdAt: true,
      employmentRecords: {
        where: { effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] },
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }], take: 1,
        select: {
          employmentCategory: true, employmentStatus: true,
          probation: { select: { probationStatus: true, decision: true, expectedEndAt: true } },
        },
      },
    },
  }));
  // Type filters consistently use CURRENT employment; historical type is not guessed.
  // Only a category filter requires the current-employment cohort before aggregates.
  const filteredEmployees = range.category ? (await employeesPromise).filter(employee => employee.employmentRecords[0]?.employmentCategory === range.category) : null;
  const employeeScope: Prisma.EmployeeWhereInput = { organizationId, ...(filteredEmployees ? { id: { in: filteredEmployees.map(employee => employee.id) } } : {}) };
  const attendanceWhere: Prisma.DailyAttendanceRecordWhereInput = {
    organizationId, employee: employeeScope, attendanceDate: { gte: range.fromDate, lte: range.toDate },
  };
  const requestWhere: Prisma.LeaveRequestWhereInput = {
    organizationId, employee: employeeScope,
    requestedStartDate: { lte: range.toDate }, requestedEndDate: { gte: range.fromDate },
  };
  const periodWhere: Prisma.PayrollPeriodWhereInput = { organizationId, payDate: { gte: range.fromDate, lte: range.toDate } };
  const payrollWhere: Prisma.PayrollEntryWhereInput = { organizationId, employee: employeeScope, payrollPeriod: periodWhere };
  const sqlCohort = !filteredEmployees ? Prisma.empty : filteredEmployees.length
    ? Prisma.sql`AND e."id" IN (${Prisma.join(filteredEmployees.map(employee => employee.id))})`
    : Prisma.sql`AND FALSE`;

  const [attendanceTotals, lateLeaders, leaveGroups, approvedUnits, leaveTypes, periods, entryCounts, payrollGroups, employees] = await Promise.all([
    // Keep distinct finalized-workday and tardiness predicates inside SQL FILTERs.
    // Grouped results are bounded by status/disposition, not attendance history size.
    db.$queryRaw<AttendanceAggregate[]>(Prisma.sql`
      SELECT d."attendanceStatus", d."disposition", COUNT(*) AS "count",
        COUNT(*) FILTER (WHERE d."finalizedAt" IS NOT NULL AND d."disposition" = 'NORMAL'
          AND d."attendanceStatus" IN ('PRESENT', 'ABSENT', 'INCOMPLETE')) AS "finalized",
        COUNT(*) FILTER (WHERE d."disposition" = 'NORMAL'
          AND d."attendanceStatus" NOT IN ('REST_DAY', 'NO_SCHEDULE') AND d."lateSeconds" > 0) AS "late"
      FROM "DailyAttendanceRecord" d JOIN "Employee" e ON e."id" = d."employeeId"
      WHERE d."organizationId" = ${organizationId} AND e."organizationId" = ${organizationId}
        AND d."attendanceDate" >= ${range.from}::date AND d."attendanceDate" <= ${range.to}::date
        ${sqlCohort}
      GROUP BY d."attendanceStatus", d."disposition"
    `),
    db.dailyAttendanceRecord.groupBy({
      by: ['employeeId'], where: { ...attendanceWhere, disposition: 'NORMAL', attendanceStatus: { notIn: ['REST_DAY', 'NO_SCHEDULE'] }, lateSeconds: { gt: 0 } },
      _count: { employeeId: true }, _sum: { lateSeconds: true },
      orderBy: [{ _count: { employeeId: 'desc' } }, { _sum: { lateSeconds: 'desc' } }, { employeeId: 'asc' }], take: 5,
    }),
    db.leaveRequest.groupBy({ by: ['status', 'leaveTypeId'], where: requestWhere, _count: { _all: true } }),
    db.leaveRequestDay.aggregate({
      where: {
        organizationId, employee: employeeScope, attendanceDate: { gte: range.fromDate, lte: range.toDate },
        leaveRequest: { organizationId, status: 'APPROVED', calculationFinalizedAt: { not: null } },
      }, _sum: { chargeUnits: true },
    }),
    db.leaveType.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.payrollPeriod.findMany({ where: periodWhere, select: { id: true, name: true, periodStart: true, periodEnd: true, payDate: true, status: true, finalizedAt: true }, orderBy: [{ payDate: 'desc' }, { id: 'asc' }] }),
    db.payrollEntry.groupBy({ by: ['payrollPeriodId', 'status'], where: payrollWhere, _count: { _all: true } }),
    // Aggregate before returning payroll data: no individual salary or raw snapshot
    // is loaded into the page. Currency comes from the finalized H6 snapshot.
    db.$queryRaw<PayrollAggregate[]>(Prisma.sql`
      SELECT pe."payrollPeriodId" AS "periodId",
        pe."calculationSnapshot" #>> '{compensation,currency}' AS "currency",
        COUNT(*) AS "entries", SUM(pe."grossAmount") AS "gross",
        SUM(pe."totalDeductions") AS "deductions", SUM(pe."netAmount") AS "net"
      FROM "PayrollEntry" pe
      JOIN "PayrollPeriod" p ON p."id" = pe."payrollPeriodId"
      JOIN "Employee" e ON e."id" = pe."employeeId"
      WHERE pe."organizationId" = ${organizationId} AND p."organizationId" = ${organizationId}
        AND e."organizationId" = ${organizationId}
        AND p."payDate" >= ${range.fromDate} AND p."payDate" <= ${range.toDate}
        AND pe."status" = 'FINALIZED' AND p."status" = 'FINALIZED' AND p."finalizedAt" IS NOT NULL
        ${sqlCohort}
      GROUP BY pe."payrollPeriodId", pe."calculationSnapshot" #>> '{compensation,currency}'
    `),
    employeesPromise,
  ]);

  const cohort = filteredEmployees ?? employees;
  const attendanceGroups = attendanceTotals.map(group => ({ ...group, _count: { _all: Number(group.count) } }));
  const countStatus = (status: EmployeeStatus) => cohort.filter(employee => employee.employeeStatus === status).length;
  const active = cohort.filter(employee => employee.employeeStatus === 'ACTIVE');
  const categoryCount = (category: EmploymentCategory) => active.filter(employee => employee.employmentRecords[0]?.employmentCategory === category).length;
  const probationCases = active.filter(employee => {
    const employment = employee.employmentRecords[0];
    return employment?.employmentStatus === 'PROBATIONARY' && employment.probation?.probationStatus === 'ACTIVE' && employment.probation.decision === 'PENDING';
  });
  const normalCount = (status: string) => attendanceGroups.filter(group => group.attendanceStatus === status && group.disposition !== 'APPROVED_LEAVE').reduce((sum, group) => sum + group._count._all, 0);
  const finalizedWorkdays = attendanceTotals.reduce((sum, group) => sum + Number(group.finalized), 0);
  const finalizedPresent = attendanceTotals.filter(group => group.attendanceStatus === 'PRESENT').reduce((sum, group) => sum + Number(group.finalized), 0);
  const requestCount = (status: string) => leaveGroups.filter(group => group.status === status).reduce((sum, group) => sum + group._count._all, 0);
  const currencyTotals = new Map<string, { entries: number; gross: Prisma.Decimal; deductions: Prisma.Decimal; net: Prisma.Decimal }>();
  let unavailableCurrencyEntries = 0;
  const validGroups = payrollGroups.filter(group => {
    if (group.currency && /^[A-Z]{3}$/.test(group.currency)) return true;
    unavailableCurrencyEntries += Number(group.entries);
    return false;
  });
  for (const group of validGroups) {
    const total = currencyTotals.get(group.currency!) ?? { entries: 0, gross: new Prisma.Decimal(0), deductions: new Prisma.Decimal(0), net: new Prisma.Decimal(0) };
    total.entries += Number(group.entries);
    total.gross = total.gross.add(group.gross);
    total.deductions = total.deductions.add(group.deductions);
    total.net = total.net.add(group.net);
    currencyTotals.set(group.currency!, total);
  }
  const periodCounts = new Map<string, number>();
  for (const group of entryCounts) periodCounts.set(group.payrollPeriodId, (periodCounts.get(group.payrollPeriodId) ?? 0) + group._count._all);
  const visiblePeriods = periods.filter(period => !range.category || periodCounts.has(period.id));
  const serializeTotal = (currency: string, total: { entries: number; gross: Prisma.Decimal; deductions: Prisma.Decimal; net: Prisma.Decimal }): CurrencyTotal => ({ currency, entries: total.entries, gross: total.gross.toFixed(2), deductions: total.deductions.toFixed(2), net: total.net.toFixed(2) });
  const today = utcStartOfDay(asOf);
  const reviewCutoff = new Date(today.getTime() + PROBATION_ENDING_SOON_DAYS * 86_400_000);
  const actions = probationCases.flatMap(employee => {
    const employment = employee.employmentRecords[0];
    const probation = employment.probation!;
    const review = deriveProbationReviewState({ ...probation, asOf });
    if (!review.needsAttention) return [];
    return [{ employeeId: employee.id, employeeNumber: employee.employeeNumber, employeeName: `${employee.firstName} ${employee.lastName}`, category: employment.employmentCategory, status: review.state, date: probation.expectedEndAt.toISOString().slice(0, 10), action: review.decisionAllowed ? 'HR decision review due' : 'Prepare probation review' }];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.employeeNumber.localeCompare(b.employeeNumber));

  return {
    range: { preset: range.preset, from: range.from, to: range.to, category: range.category ?? 'ALL' },
    asOf: asOf.toISOString(), timeZone: actor.timeZone,
    workforce: {
      active: active.length, teaching: categoryCount('TEACHING'), nonTeaching: categoryCount('NON_TEACHING'),
      probationary: active.filter(employee => employee.employmentRecords[0]?.employmentStatus === 'PROBATIONARY').length,
      regular: active.filter(employee => employee.employmentRecords[0]?.employmentStatus === 'REGULAR').length,
      unclassified: active.filter(employee => !employee.employmentRecords[0]).length,
      inactive: countStatus('INACTIVE'), separated: countStatus('SEPARATED'),
      conversions: cohort.filter(employee => employee.createdAt >= range.fromInstant && employee.createdAt < range.throughInstant).length,
    },
    attendance: {
      recordedDays: attendanceGroups.reduce((sum, group) => sum + group._count._all, 0),
      presentDays: normalCount('PRESENT'), absentDays: normalCount('ABSENT'), incompleteDays: normalCount('INCOMPLETE'),
      openDays: normalCount('OPEN'), restDays: normalCount('REST_DAY'), noScheduleDays: normalCount('NO_SCHEDULE'),
      approvedLeaveDays: attendanceGroups.filter(group => group.disposition === 'APPROVED_LEAVE').reduce((sum, group) => sum + group._count._all, 0),
      lateOccurrences: attendanceTotals.reduce((sum, group) => sum + Number(group.late), 0),
      rate: finalizedWorkdays ? Number((100 * finalizedPresent / finalizedWorkdays).toFixed(1)) : null,
      finalizedWorkdays,
      lateLeaders: lateLeaders.map(group => {
        const employee = employees.find(item => item.id === group.employeeId)!;
        return { employeeNumber: employee.employeeNumber, employeeName: `${employee.firstName} ${employee.lastName}`, count: group._count.employeeId, lateMinutes: group._sum.lateSeconds == null ? null : Number((group._sum.lateSeconds / 60).toFixed(1)) };
      }),
    },
    leave: {
      requests: leaveGroups.reduce((sum, group) => sum + group._count._all, 0), pending: requestCount('PENDING'), approved: requestCount('APPROVED'), rejected: requestCount('REJECTED'),
      withdrawn: requestCount('WITHDRAWN'), cancelled: requestCount('CANCELLED'),
      approvedUnits: (approvedUnits._sum.chargeUnits ?? new Prisma.Decimal(0)).toString(),
      byType: leaveTypes.map(type => ({ name: type.name, count: leaveGroups.filter(group => group.leaveTypeId === type.id).reduce((sum, group) => sum + group._count._all, 0) })).filter(type => type.count > 0),
    },
    payroll: {
      entries: entryCounts.reduce((sum, group) => sum + group._count._all, 0),
      finalizedEntries: payrollGroups.reduce((sum, group) => sum + Number(group.entries), 0),
      finalizedPeriods: visiblePeriods.filter(period => period.status === 'FINALIZED' && period.finalizedAt !== null).length,
      totals: [...currencyTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, total]) => serializeTotal(currency, total)),
      unavailableCurrencyEntries,
      periods: visiblePeriods.slice(0, 6).map(period => ({
        id: period.id, name: period.name, from: period.periodStart.toISOString().slice(0, 10), to: period.periodEnd.toISOString().slice(0, 10), payDate: period.payDate.toISOString().slice(0, 10), status: period.status,
        employees: periodCounts.get(period.id) ?? 0,
        totals: validGroups.filter(group => group.periodId === period.id).map(group => serializeTotal(group.currency!, { ...group, entries: Number(group.entries) })),
      })),
    },
    employment: {
      activeProbationCases: probationCases.length,
      teachingCases: probationCases.filter(employee => employee.employmentRecords[0].employmentCategory === 'TEACHING').length,
      nonTeachingCases: probationCases.filter(employee => employee.employmentRecords[0].employmentCategory === 'NON_TEACHING').length,
      teachingEndingSoon: probationCases.filter(employee => employee.employmentRecords[0].employmentCategory === 'TEACHING' && employee.employmentRecords[0].probation!.expectedEndAt >= today && employee.employmentRecords[0].probation!.expectedEndAt <= reviewCutoff).length,
      actionCount: actions.length, actions: actions.slice(0, 20),
    },
  };
}

export type AnalyticsViewModel = Awaited<ReturnType<typeof readAnalytics>>;
