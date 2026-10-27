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
import { PayrollStatutorySetupPanel } from '@/components/payroll/PayrollStatutorySetupPanel';
import { getPayrollStatutorySetup } from '@/features/payroll/setup-queries';

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
  const statutorySetup = activeTab === 'processing' && canManagePayroll && selectedPeriod && selectedPeriod.status !== 'FINALIZED'
    ? await getPayrollStatutorySetup({ organizationId: user.organizationId, actorUserId: user.userId, payrollPeriodId: selectedPeriod.id }) : null;

  // Guided UI only. The payroll engine still enforces every statutory, tax and finalization prerequisite.
  const employeesWithPeriodCompensation = selectedPeriod
    ? employees.filter(employee => compensations.filter(record =>
        record.employeeId === employee.id &&
        record.status === 'ACTIVE' &&
        record.effectiveFrom <= selectedPeriod.periodStart &&
        (!record.effectiveTo || record.effectiveTo >= selectedPeriod.periodEnd)
      ).length === 1).length
    : 0;
  const employeesWithReviewedStatutorySetup = statutorySetup?.filter(row => row.input && row.opening).length ?? 0;

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
                processingHref={`/dashboard/payroll?tab=processing${
                  selectedPeriod ? `&period=${selectedPeriod.id}` : ''
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
        {canManagePayroll && (
          <section aria-label="Payroll quick start" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-700">HR quick start</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Run payroll in three steps</h2>
              <p className="mt-1 text-sm text-slate-600">WorkPulse calculates BIR withholding and SSS, PhilHealth, and Pag-IBIG contributions. HR reviews the source information instead of typing calculated deductions.</p>
            </div>
            <ol className="grid gap-3 md:grid-cols-3">
              <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">1. Set employee salaries</p>
                <p className="mt-1 text-xs text-slate-600">Set the full monthly salary and effective date for each active employee.</p>
                <a href="/dashboard/payroll?tab=configuration" className="mt-2 inline-block text-xs font-bold text-teal-800 underline underline-offset-2">Open salary setup</a>
              </li>
              <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">2. Verify government deductions</p>
                <p className="mt-1 text-xs text-slate-600">Review coverage, contribution bases, and opening tax history. Open the section below when setup is missing.</p>
              </li>
              <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">3. Generate, review and publish</p>
                <p className="mt-1 text-xs text-slate-600">Finalize only after approving every entry. Finalized payslips become visible in the employee's ESS account.</p>
              </li>
            </ol>
            {selectedPeriod && (
              <div className="flex flex-wrap items-center gap-2 text-xs" role="status">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">Salary coverage: {employeesWithPeriodCompensation}/{employees.length}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">Reviewed statutory setup + history: {employeesWithReviewedStatutorySetup}/{employees.length}</span>
                {review && review.summary.ready === 0 && (
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">No payroll entries ready yet</span>
                )}
              </div>
            )}
            <p className="text-xs text-slate-500">These counters cover basic setup only. The calculation engine still checks employment history, tax eligibility, dates, attendance, and statutory schedules. No deduction or security check is skipped.</p>
          </section>
        )}
        {statutorySetup && selectedPeriod && (
          <details className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none select-none p-4 sm:p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">Government deductions & tax setup</h2>
                  <p className="mt-1 text-xs text-slate-600">Advanced verification required before calculation. {employeesWithReviewedStatutorySetup} of {employees.length} employees have saved period inputs and opening history.</p>
                </div>
                <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 group-open:hidden">Expand setup +</span>
                <span className="hidden shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 group-open:inline">Collapse −</span>
              </div>
            </summary>
            <div className="border-t border-slate-100 p-2 sm:p-3">
              <PayrollStatutorySetupPanel key={selectedPeriod.id} rows={statutorySetup} periodId={selectedPeriod.id} periodName={selectedPeriod.name} payDate={selectedPeriod.payDate.toISOString().slice(0, 10)} />
            </div>
          </details>
        )}
        <PayrollProcessingTab
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
          currentPolicy={configurationPolicies.find(policy => policy.id === currentPolicy?.id) ?? null}
          leaveTypes={leaveTypes}
        />
      )}
    </div>
  );
}
