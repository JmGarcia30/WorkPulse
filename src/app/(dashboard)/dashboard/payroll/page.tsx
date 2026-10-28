import { notFound } from 'next/navigation';
import { Role } from '@prisma/client';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canViewPayroll } from '@/lib/permissions/rbac';
import { getPayrollDashboardData } from '@/features/payroll/queries';
import { formatPayrollPeriodRange } from '@/features/payroll/formatters';
import {
  PayrollDashboardHeader,
  PayrollTabId,
} from '@/components/payroll/PayrollDashboardHeader';
import { PayrollSummaryCards } from '@/components/payroll/PayrollSummaryCards';
import { PayrollTrendChart } from '@/components/payroll/PayrollTrendChart';
import { PayrollBreakdownPanel } from '@/components/payroll/PayrollBreakdownPanel';
import { EmployeePayrollEntriesTable } from '@/components/payroll/EmployeePayrollEntriesTable';
import { RecentPayrollPeriodsWidget } from '@/components/payroll/RecentPayrollPeriodsWidget';
import { PayrollActionQueueWidget } from '@/components/payroll/PayrollActionQueueWidget';
import { PayrollProcessingTab } from '@/components/payroll/PayrollProcessingTab';
import { PayrollConfigurationTab } from '@/components/payroll/PayrollConfigurationTab';
import { getPayrollReadiness } from '@/features/payroll/readiness';
import { PayrollReadinessTable } from '@/components/payroll/PayrollReadinessTable';
import { PayrollReuseSetup } from '@/components/payroll/PayrollReuseSetup';

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string }>;
}) {
  const user = await requireBackOfficeContext();
  if (!canViewPayroll(user)) notFound();

  const { period: selectedPeriodId, tab: rawTab } = await searchParams;
  const validTabs: PayrollTabId[] = ['overview', 'processing', 'configuration'];
  const activeTab: PayrollTabId = validTabs.includes(rawTab as PayrollTabId)
    ? (rawTab as PayrollTabId)
    : 'overview';

  const data = await getPayrollDashboardData(user.organizationId, selectedPeriodId);
  const { foundation, kpis, trendPoints, recentPeriods, entries, actions } = data;
  const {
    employees,
    compensations,
    periods,
    selectedPeriod,
    review,
    policies,
    currentPolicy,
    leaveTypes,
  } = foundation;

  const canManagePayroll =
    user.role === Role.ORGANIZATION_ADMIN || user.role === Role.HR_ADMIN;
  const canGeneratePayroll =
    canManagePayroll && selectedPeriod !== null && selectedPeriod.status !== 'FINALIZED';
  const readinessData = ['processing', 'configuration'].includes(activeTab) && canManagePayroll && selectedPeriod && selectedPeriod.status !== 'FINALIZED'
    ? await getPayrollReadiness({ organizationId: user.organizationId, actorUserId: user.userId, payrollPeriodId: selectedPeriod.id }) : null;

  const statutorySetup = readinessData?.setup ?? null;

  const periodOptions = periods.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
  }));

  const selectedPeriodDateRange = selectedPeriod
    ? formatPayrollPeriodRange(selectedPeriod.periodStart, selectedPeriod.periodEnd)
    : undefined;
  // Client props contain display values, never Prisma Decimal instances or unused ledger payloads.
  const configurationCompensations = compensations.map(record => ({
    id: record.id, compensationType: record.compensationType, baseRate: record.baseRate.toFixed(2), currency: record.currency,
    payFrequency: record.payFrequency, effectiveFrom: record.effectiveFrom, effectiveTo: record.effectiveTo, status: record.status, employee: record.employee,
  }));
  const configurationPolicies = policies.map(policy => ({
    id: policy.id, version: policy.version, effectiveFrom: policy.effectiveFrom, effectiveTo: policy.effectiveTo, status: policy.status,
    dailyPayBasis: policy.dailyPayBasis, lateDeductionRule: policy.lateDeductionRule, absenceDeductionRule: policy.absenceDeductionRule,
    undertimeDeductionRule: policy.undertimeDeductionRule, roundingRule: policy.roundingRule, createdBy: policy.createdBy,
  }));

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Top Header with Period Picker & Tab Switcher */}
      <PayrollDashboardHeader
        periods={periodOptions}
        selectedPeriodId={selectedPeriod?.id ?? null}
        activeTab={activeTab}
        canManagePayroll={canManagePayroll}
        canGeneratePayroll={canGeneratePayroll}
        issuesCount={review?.issues.length ?? 0}
      />

      {/* 2. Tab Content: Overview (Default Financial Dashboard) */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Top 5 KPI Summary Cards */}
          <PayrollSummaryCards
            kpis={kpis}
            periodName={selectedPeriod?.name}
          />

          {/* Main Financial Workspace Grid (matching reference layout composition) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column (8 Cols): Trend Chart Top + Employee Entries Table Below */}
            <div className="lg:col-span-8 flex flex-col gap-5 min-w-0">
              {/* Upper Left: Payroll Trend Chart */}
              <PayrollTrendChart
                trendPoints={trendPoints}
                currentPeriodName={selectedPeriod?.name}
              />

              {/* Lower Left: Employee Payroll Entries Table */}
              <EmployeePayrollEntriesTable
                entries={entries}
                selectedPeriodName={selectedPeriod?.name}
                isPeriodFinalized={selectedPeriod?.status === 'FINALIZED'}
              />
            </div>

            {/* Right Column (4 Cols): Summary Breakdown Top + Recent Periods & Actions Queue Below */}
            <div className="lg:col-span-4 flex flex-col gap-5 min-w-0">
              {/* Upper Right: Payroll Summary Breakdown Gauge */}
              <PayrollBreakdownPanel
                kpis={kpis}
                periodName={selectedPeriod?.name}
                periodDateRange={selectedPeriodDateRange}
                processingHref={`/dashboard/payroll?tab=processing${selectedPeriod ? `&period=${selectedPeriod.id}` : ''
                  }`}
              />

              {/* Lower Right (Top): Recent Payroll Periods */}
              <RecentPayrollPeriodsWidget periods={recentPeriods} />

              {/* Lower Right (Bottom): Payroll Action Queue */}
              <PayrollActionQueueWidget actions={actions} />
            </div>
          </div>
        </div>
      )}

      {/* 3. Tab Content: Payroll Processing (Create Period, Generate, Review, Finalize) */}
      {activeTab === 'processing' && (
        <>
          <PayrollProcessingTab
            readiness={<>
              {readinessData && <PayrollReadinessTable rows={readinessData.readiness} />}
              {statutorySetup && selectedPeriod && <PayrollReuseSetup rows={statutorySetup} periodId={selectedPeriod.id} />}
              <a className="wp-button-secondary" href={'/dashboard/payroll?tab=configuration' + (selectedPeriod ? '&period=' + selectedPeriod.id : '') + '#advanced-payroll'}>Advanced Payroll Setup</a>
            </>}
            periods={periods}
            selectedPeriod={selectedPeriod}
            review={review ? { period: review.period, summary: review.summary, totals: review.totals, issues: review.issues, canFinalize: review.canFinalize } : null}
          />
          <EmployeePayrollEntriesTable entries={entries} selectedPeriodName={selectedPeriod?.name} isPeriodFinalized={selectedPeriod?.status === 'FINALIZED'} />
        </>
      )}

      {/* 4. Tab Content: Payroll Configuration (Compensations & Policy Versions) */}
      {activeTab === 'configuration' && (
        <PayrollConfigurationTab
          employees={employees}
          compensations={configurationCompensations}
          policies={configurationPolicies}
          statutorySetup={statutorySetup}
          selectedPeriod={selectedPeriod}
          currentPolicy={configurationPolicies.find(policy => policy.id === currentPolicy?.id) ?? null}
          leaveTypes={leaveTypes}
        />
      )}
    </div>
  );
}
