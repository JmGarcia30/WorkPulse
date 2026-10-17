import { Prisma, PayrollEntryStatus, PayrollPeriodStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { assessPayrollPeriod } from './batch2-payroll-review';
import { formatCurrency, formatPayrollDate, formatPayrollPeriodRange } from '@/features/payroll/formatters';

type PayrollDb = Prisma.TransactionClient | typeof prisma;

export async function getPayrollFoundation(
  organizationId: string,
  selectedPeriodId?: string,
  db: PayrollDb = prisma
) {
  const [employees, compensations, periods, policies, leaveTypes] = await Promise.all([
    db.employee.findMany({ where: { organizationId, employeeStatus: 'ACTIVE' }, select: { id: true, employeeNumber: true, firstName: true, lastName: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    db.employeeCompensation.findMany({ where: { organizationId }, include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } } }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }] }),
    db.payrollPeriod.findMany({ where: { organizationId }, orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }] }),
    db.organizationPayrollPolicy.findMany({ where: { organizationId }, include: { createdBy: { select: { name: true } }, leaveTreatments: { include: { leaveType: { select: { code: true, name: true } } } } }, orderBy: { version: 'desc' } }),
    db.leaveType.findMany({ where: { organizationId, isActive: true }, select: { id: true, code: true, name: true, isPaid: true }, orderBy: { name: 'asc' } }),
  ]);
  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId) ?? periods[0] ?? null;
  const entries = selectedPeriod ? await db.payrollEntry.findMany({
    where: { organizationId, payrollPeriodId: selectedPeriod.id },
    include: {
      employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
      employeeCompensation: { select: { compensationType: true, baseRate: true, payFrequency: true, currency: true } },
    },
    orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
  }) : [];
  const review = selectedPeriod ? await assessPayrollPeriod(organizationId, selectedPeriod.id, db) : null;
  const today = new Date();
  const currentPolicy = policies.find(policy => policy.status === 'ACTIVE' && policy.effectiveFrom <= today && (!policy.effectiveTo || policy.effectiveTo >= today)) ?? null;
  return { employees, compensations, periods, selectedPeriod, entries, review, policies, currentPolicy, leaveTypes };
}

export interface PayrollDashboardEntryItem {
  id: string;
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  compensationType: string;
  baseRateFormatted: string;
  payFrequency: string;
  currency: string;
  periodName: string;
  baseAmountFormatted: string;
  grossAmountFormatted: string;
  totalDeductionsFormatted: string;
  netAmountFormatted: string;
  grossNumeric: number;
  deductionsNumeric: number;
  netNumeric: number;
  status: PayrollEntryStatus;
  reviewState: 'READY' | 'SETUP_REQUIRED' | 'CALCULATION_ERROR';
  issueMessage: string | null;
  attendanceSummary: {
    scheduledWorkdays?: number;
    presentDays?: number;
    absentDays?: number;
    approvedLeaveDays?: number;
    lateOccurrences?: number;
  } | null;
  leaveSummary: {
    approvedDays?: number;
    approvedUnits?: string;
  } | null;
  canViewPayslip: boolean;
}

export interface PayrollDashboardSummaryKPIs {
  grossPayroll: string | null;
  netPayroll: string | null;
  totalDeductions: string | null;
  grossNumeric: number;
  netNumeric: number;
  deductionsNumeric: number;
  employeesIncluded: number;
  totalEligibleEmployees: number;
  requiresAttention: number;
  currency: string;
  hasCalculatedData: boolean;
}

export interface PayrollDashboardTrendPoint {
  periodId: string;
  periodName: string;
  periodLabel: string;
  status: PayrollPeriodStatus;
  gross: number;
  net: number;
  deductions: number;
  grossFormatted: string;
  netFormatted: string;
  deductionsFormatted: string;
  isFinalized: boolean;
}

export interface PayrollDashboardRecentPeriod {
  id: string;
  name: string;
  dateRange: string;
  payDate: string;
  status: PayrollPeriodStatus;
  entryCount: number;
  netTotalFormatted: string | null;
  isCurrent: boolean;
}

export interface PayrollDashboardActionItem {
  id: string;
  kind: 'SETUP_REQUIRED' | 'CALCULATION_ERROR' | 'RECOMMENDATION' | 'INFO';
  title: string;
  description: string;
  badge?: string;
  actionText?: string;
  actionTab?: 'processing' | 'configuration';
}

export interface PayrollDashboardData {
  foundation: Awaited<ReturnType<typeof getPayrollFoundation>>;
  kpis: PayrollDashboardSummaryKPIs;
  trendPoints: PayrollDashboardTrendPoint[];
  recentPeriods: PayrollDashboardRecentPeriod[];
  entries: PayrollDashboardEntryItem[];
  actions: PayrollDashboardActionItem[];
  currency: string;
}

export async function getPayrollDashboardData(
  organizationId: string,
  selectedPeriodId?: string,
  db: PayrollDb = prisma
): Promise<PayrollDashboardData> {
  const foundation = await getPayrollFoundation(organizationId, selectedPeriodId, db);
  const { employees, periods, selectedPeriod, entries, review } = foundation;

  // 1. Efficient batched aggregation for recent periods (up to 12 periods)
  const recentPeriodIds = periods.slice(0, 12).map((p) => p.id);
  const aggregates =
    recentPeriodIds.length > 0
      ? await db.payrollEntry.groupBy({
          by: ['payrollPeriodId'],
          where: { organizationId, payrollPeriodId: { in: recentPeriodIds } },
          _sum: { grossAmount: true, totalDeductions: true, netAmount: true },
          _count: { id: true },
        })
      : [];

  const aggMap = new Map(
    aggregates.map((item) => [
      item.payrollPeriodId,
      {
        gross: item._sum.grossAmount ?? new Prisma.Decimal(0),
        deductions: item._sum.totalDeductions ?? new Prisma.Decimal(0),
        net: item._sum.netAmount ?? new Prisma.Decimal(0),
        count: item._count.id,
      },
    ])
  );

  const currency = 'PHP';

  // 2. Summary KPIs
  const hasCalculatedData = entries.length > 0;
  const grossNum = review?.totals.gross ? Number(review.totals.gross) : 0;
  const dedNum = review?.totals.deductions ? Number(review.totals.deductions) : 0;
  const netNum = review?.totals.net ? Number(review.totals.net) : 0;

  const kpis: PayrollDashboardSummaryKPIs = {
    grossPayroll: hasCalculatedData ? formatCurrency(grossNum, currency) : null,
    totalDeductions: hasCalculatedData ? formatCurrency(dedNum, currency) : null,
    netPayroll: hasCalculatedData ? formatCurrency(netNum, currency) : null,
    grossNumeric: grossNum,
    deductionsNumeric: dedNum,
    netNumeric: netNum,
    employeesIncluded: review?.totals.employeeCount ?? entries.length,
    totalEligibleEmployees: employees.length,
    requiresAttention: review?.issues.length ?? 0,
    currency,
    hasCalculatedData,
  };

  // 3. Trend Points (ordered chronologically from oldest to newest)
  const trendPoints: PayrollDashboardTrendPoint[] = periods
    .slice(0, 12)
    .slice()
    .reverse()
    .map((period) => {
      const agg = aggMap.get(period.id);
      const g = agg ? Number(agg.gross.toString()) : 0;
      const d = agg ? Number(agg.deductions.toString()) : 0;
      const n = agg ? Number(agg.net.toString()) : 0;
      return {
        periodId: period.id,
        periodName: period.name,
        periodLabel: formatPayrollDate(period.periodStart, { includeYear: false }),
        status: period.status,
        gross: g,
        net: n,
        deductions: d,
        grossFormatted: formatCurrency(g, currency),
        netFormatted: formatCurrency(n, currency),
        deductionsFormatted: formatCurrency(d, currency),
        isFinalized: period.status === 'FINALIZED',
      };
    });

  // 4. Recent Periods List (up to 5 most recent)
  const recentPeriods: PayrollDashboardRecentPeriod[] = periods.slice(0, 5).map((period) => {
    const agg = aggMap.get(period.id);
    return {
      id: period.id,
      name: period.name,
      dateRange: formatPayrollPeriodRange(period.periodStart, period.periodEnd),
      payDate: formatPayrollDate(period.payDate),
      status: period.status,
      entryCount: agg?.count ?? 0,
      netTotalFormatted: agg && agg.count > 0 ? formatCurrency(agg.net, currency) : null,
      isCurrent: period.id === selectedPeriod?.id,
    };
  });

  // 5. Entries View Model
  type SnapshotShape = {
    attendanceSummary?: {
      scheduledWorkdays?: number;
      presentDays?: number;
      absentDays?: number;
      approvedLeaveDays?: number;
      lateOccurrences?: number;
    };
    leaveSummary?: {
      approvedDays?: number;
      approvedUnits?: string;
    };
  };

  const issuesByEmployee = new Map(
    (review?.issues ?? []).map((issue) => [issue.employeeId, issue])
  );

  const entryItems: PayrollDashboardEntryItem[] = entries.map((entry) => {
    const snapshot = entry.calculationSnapshot as SnapshotShape | null;
    const issue = issuesByEmployee.get(entry.employeeId);
    const compensation = entry.employeeCompensation;

    return {
      id: entry.id,
      employeeId: entry.employeeId,
      employeeNumber: entry.employee.employeeNumber,
      firstName: entry.employee.firstName,
      lastName: entry.employee.lastName,
      compensationType: compensation.compensationType,
      baseRateFormatted: formatCurrency(compensation.baseRate, compensation.currency),
      payFrequency: compensation.payFrequency,
      currency: compensation.currency,
      periodName: selectedPeriod?.name ?? '',
      baseAmountFormatted: formatCurrency(entry.baseAmount, compensation.currency),
      grossAmountFormatted: formatCurrency(entry.grossAmount, compensation.currency),
      totalDeductionsFormatted: formatCurrency(entry.totalDeductions, compensation.currency),
      netAmountFormatted: formatCurrency(entry.netAmount, compensation.currency),
      grossNumeric: Number(entry.grossAmount.toString()),
      deductionsNumeric: Number(entry.totalDeductions.toString()),
      netNumeric: Number(entry.netAmount.toString()),
      status: entry.status,
      reviewState: issue ? issue.kind : 'READY',
      issueMessage: issue ? issue.message : null,
      attendanceSummary: snapshot?.attendanceSummary ?? null,
      leaveSummary: snapshot?.leaveSummary ?? null,
      canViewPayslip: selectedPeriod?.status === 'FINALIZED' && entry.status === 'FINALIZED',
    };
  });

  // 6. Action Queue Items
  const actions: PayrollDashboardActionItem[] = [];

  if (!selectedPeriod) {
    actions.push({
      id: 'create-first-period',
      kind: 'RECOMMENDATION',
      title: 'Create Your First Payroll Period',
      description: 'Define institutional cut-off dates and the scheduled pay date.',
      badge: 'Action Needed',
      actionText: 'Create Period',
      actionTab: 'processing',
    });
  } else {
    if (selectedPeriod.status === 'DRAFT' && entries.length === 0) {
      actions.push({
        id: 'generate-period',
        kind: 'RECOMMENDATION',
        title: `Generate Payroll for ${selectedPeriod.name}`,
        description: 'Compute base compensation, attendance deductions, and approved leaves.',
        badge: 'Draft Period',
        actionText: 'Generate Payroll',
        actionTab: 'processing',
      });
    }

    if (review?.issues && review.issues.length > 0) {
      review.issues.slice(0, 3).forEach((issue, idx) => {
        actions.push({
          id: `issue-${idx}`,
          kind: issue.kind,
          title: issue.employeeName
            ? `${issue.employeeName} (${issue.employeeNumber})`
            : 'Payroll Policy Setup',
          description: issue.message,
          badge: issue.kind === 'SETUP_REQUIRED' ? 'Setup Needed' : 'Error',
          actionText: 'Resolve',
          actionTab: issue.kind === 'SETUP_REQUIRED' ? 'configuration' : 'processing',
        });
      });
    }

    if (selectedPeriod.status === 'DRAFT' && entries.length > 0 && review?.issues.length === 0) {
      actions.push({
        id: 'move-to-review',
        kind: 'RECOMMENDATION',
        title: 'Ready for Review',
        description: `${entries.length} entries calculated with 0 issues. Move to controlled HR review.`,
        badge: 'Ready',
        actionText: 'Open Review',
        actionTab: 'processing',
      });
    }

    if (selectedPeriod.status === 'REVIEW' && review?.canFinalize) {
      actions.push({
        id: 'ready-to-finalize',
        kind: 'RECOMMENDATION',
        title: 'Eligible for Finalization',
        description: 'All calculations verified. Finalize this period to lock official payslips.',
        badge: 'Finalize Ready',
        actionText: 'Finalize Now',
        actionTab: 'processing',
      });
    }
  }

  return {
    foundation,
    kpis,
    trendPoints,
    recentPeriods,
    entries: entryItems,
    actions,
    currency,
  };
}
