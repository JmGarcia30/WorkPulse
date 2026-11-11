import { TenantLink } from '@/components/ui/TenantLink';
import { CalendarDays, Calculator, ChevronRight, Clock3, FileText, Gift, ShieldCheck, UserRound, Wallet } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManagePayroll, canViewPayroll } from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { getPayrollDashboardData } from '@/features/payroll/queries';
import { getPayrollReadiness } from '@/features/payroll/readiness';
import { earningsVersion } from '@/features/payroll/earnings';
import { parseStatutoryInput } from '@/features/payroll/statutory-inputs';
import { previewPayrollNotifications } from '@/features/payroll/notifications';
import { formatPayrollDate, formatCurrency } from '@/features/payroll/formatters';
import { PayrollPeriodForm, PayrollGenerationForm, PayrollReviewControls } from '@/components/payroll/PayrollSetupForms';
import { PayrollReadinessTable } from '@/components/payroll/PayrollReadinessTable';
import { PayrollReuseSetup } from '@/components/payroll/PayrollReuseSetup';
import { PayrollConfigurationTab } from '@/components/payroll/PayrollConfigurationTab';
import { PayrollSimpleConfiguration } from '@/components/payroll/PayrollSimpleConfiguration';
import { PayrollReviewTable } from '@/components/payroll/PayrollReviewTable';
import { PayrollEarningsForm, PayrollRecalculateForm, PayrollIncentiveForm } from '@/components/payroll/PayrollEarningsForm';
import { PayrollAttendanceBreakdown } from '@/components/payroll/PayrollAttendanceBreakdown';
import { PayrollNotifyForm } from '@/components/payroll/PayrollNotifyForm';
import { PayrollDeductionBreakdown } from '@/components/payroll/PayrollDeductionBreakdown';

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string; tab?: string; employee?: string }> }) {
  const user = await requireBackOfficeContext();
  if (!canViewPayroll(user)) notFound();
  const params = await searchParams;
  const data = await getPayrollDashboardData(user.organizationId, params.period);
  const { employees, compensations, periods, selectedPeriod: period, review, policies, currentPolicy, leaveTypes } = data.foundation;
  const manage = canManagePayroll(user);
  const editable = manage && period && period.status !== 'FINALIZED';
  const scope = { organizationId: user.organizationId, actorUserId: user.userId, payrollPeriodId: period?.id ?? '' };
  const readiness = editable ? await getPayrollReadiness(scope) : null;
  const inputs = editable ? await prisma.payrollStatutoryInput.findMany({ where: { organizationId: user.organizationId, payrollPeriodId: period.id } }) : [];
  const earningsEmployees = inputs.flatMap(record => {
    const person = employees.find(row => row.id === record.employeeId);
    if (!person) return [];
    try { return [{ id: person.id, name: `${person.firstName} ${person.lastName}`, input: parseStatutoryInput(record.payload), version: earningsVersion(record.payload), hasEntry: data.entries.some(row => row.employeeId === person.id) }]; } catch { return []; }
  });
  const selectedEmployee = params.employee ? employees.find(row => row.id === params.employee) ?? null : null;
  const selectedEntry = selectedEmployee ? data.entries.find(row => row.employeeId === selectedEmployee.id) ?? null : null;
  const selectedEarnings = selectedEmployee ? earningsEmployees.filter(row => row.id === selectedEmployee.id) : [];
  const selectedReadiness = selectedEmployee ? readiness?.readiness.find(row => row.employeeId === selectedEmployee.id) : null;
  const applicableCompensation = selectedEmployee && period
    ? compensations.filter(row => row.employeeId === selectedEmployee.id && row.status === 'ACTIVE'
        && row.effectiveFrom <= period.periodStart && (!row.effectiveTo || row.effectiveTo >= period.periodEnd))
    : [];
  const notification = manage && period?.status === 'FINALIZED' ? await previewPayrollNotifications(scope) : null;
  const configurationCompensations = compensations.map(record => ({ ...record, baseRate: record.baseRate.toFixed(2) }));
  const configurationPolicies = policies.map(policy => ({ id: policy.id, version: policy.version, effectiveFrom: policy.effectiveFrom, effectiveTo: policy.effectiveTo, status: policy.status, dailyPayBasis: policy.dailyPayBasis, lateDeductionRule: policy.lateDeductionRule, absenceDeductionRule: policy.absenceDeductionRule, undertimeDeductionRule: policy.undertimeDeductionRule, roundingRule: policy.roundingRule, createdBy: policy.createdBy }));
  const settings = params.tab === 'configuration' || params.tab === 'advanced';
  const setupRows = params.employee ? readiness?.setup.filter(row => row.id === params.employee) ?? [] : readiness?.setup ?? [];
  const card = 'rounded-2xl border bg-white p-4 sm:p-6 space-y-4';
  const statutoryRows = selectedEntry?.breakdown ? [
    { label: 'SSS', amount: selectedEntry.breakdown.employee.sss },
    { label: 'PhilHealth', amount: selectedEntry.breakdown.employee.philHealth },
    { label: 'Pag-IBIG', amount: selectedEntry.breakdown.employee.pagIbig },
    { label: 'BIR Withholding Tax', amount: selectedEntry.breakdown.employee.bir },
  ] : [];
  if (settings) {
    if (!manage) notFound();
    if (params.tab === 'advanced') {
      return <div className="space-y-5"><header><h1 className="text-2xl font-bold">Advanced Payroll Setup</h1><p className="mt-2 text-sm text-slate-600">Use only for statutory exceptions and historical verification. These controls are not part of the simple payroll configuration screen.</p><TenantLink className="mt-3 inline-block underline" href={`/dashboard/payroll/settings?period=${period?.id ?? ''}&employee=${params.employee ?? ''}`}>Back to Payroll Configuration</TenantLink></header><PayrollConfigurationTab employees={params.employee ? employees.filter(row => row.id === params.employee) : employees} compensations={params.employee ? configurationCompensations.filter(row => row.employeeId === params.employee) : configurationCompensations} policies={configurationPolicies} currentPolicy={configurationPolicies.find(row => row.id === currentPolicy?.id) ?? null} leaveTypes={leaveTypes} statutorySetup={setupRows} selectedPeriod={period} /></div>;
    }
    const simpleCompensations = compensations.map(record => ({
      id: record.id,
      employeeId: record.employeeId,
      baseRate: record.baseRate.toFixed(2),
      currency: record.currency,
      compensationType: record.compensationType,
      payFrequency: record.payFrequency,
      status: record.status,
      effectiveFrom: record.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: record.effectiveTo?.toISOString().slice(0, 10) ?? null,
      overtimePayPerHour: record.overtimePayPerHour?.toFixed(2) ?? null,
      undertimeDeductionPerHour: record.undertimeDeductionPerHour?.toFixed(2) ?? null,
      lateDeductionPerMinute: record.lateDeductionPerMinute?.toFixed(2) ?? null,
      absenceDeductionPerDay: record.absenceDeductionPerDay?.toFixed(2) ?? null,
      notifyOnPayslipReady: record.notifyOnPayslipReady,
    }));
    const simplePeriods = periods.map(row => ({
      id: row.id,
      name: row.name,
      periodStart: row.periodStart.toISOString().slice(0, 10),
      periodEnd: row.periodEnd.toISOString().slice(0, 10),
      status: row.status,
    }));
    const coverage = (readiness?.setup ?? []).map(row => ({
      employeeId: row.id, periodId: period?.id ?? '',
      sss: row.input?.coverage.SSS.status === 'MANDATORY' || row.input?.coverage.SSS.status === 'EXEMPT',
      philHealth: row.input?.coverage.PHILHEALTH.status === 'MANDATORY' || row.input?.coverage.PHILHEALTH.status === 'EXEMPT',
      pagIbig: row.input?.coverage.PAGIBIG.status === 'MANDATORY' || row.input?.coverage.PAGIBIG.status === 'EXEMPT',
      bir: !!row.input?.profile,
    }));
    return <div className="space-y-4 bg-[#FAF8F6] text-[#282934]">
      <TenantLink className="inline-flex text-xs font-semibold underline underline-offset-2" href={`/dashboard/payroll?period=${period?.id ?? ''}`}>Back to Run Payroll</TenantLink>
      <PayrollSimpleConfiguration employees={employees} periods={simplePeriods} compensations={simpleCompensations} coverage={coverage} initialEmployeeId={params.employee} initialPeriodId={period?.id} />
    </div>;
  }

  return <div className="space-y-5 bg-[#FAF8F6] text-[#282934]">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Generate Payroll</h1>
        <p className="mt-1 text-sm italic text-[#636471]">Select the payroll period, review calculations, and generate the employee&apos;s payroll.</p>
      </div>
      {manage && <TenantLink className="rounded-xl border border-[#e8e7e6] bg-white px-4 py-2.5 text-xs font-semibold text-[#282934] hover:bg-[#f8f6f4]" href={`/dashboard/payroll/settings?period=${period?.id ?? ''}`}>Payroll Settings</TenantLink>}
    </header>

    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <form method="get" aria-label="Select employee and payroll period" className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col justify-between gap-2 rounded-2xl border border-[#e8e7e6] bg-white p-4 text-sm font-semibold shadow-sm">
          <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[#282934]" aria-hidden="true" />Select Employee</span>
          <select className="wp-input min-w-0 w-full" name="employee" defaultValue={selectedEmployee?.id ?? ''}>
            <option value="">All employees — period workflow</option>
            {employees.map(row => <option key={row.id} value={row.id}>{row.employeeNumber} — {row.firstName} {row.lastName}</option>)}
          </select>
        </label>
        <div className="min-w-0 rounded-2xl border border-[#e8e7e6] bg-white p-4 shadow-sm">
          <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />Payroll Period</span>
            <select className="wp-input min-w-0 w-full" name="period" defaultValue={period?.id ?? ''} required>
              {!periods.length && <option value="">No period available</option>}
              {periods.map(row => <option key={row.id} value={row.id}>{row.name} · {row.status}</option>)}
            </select>
          </label>
          <button className="mt-3 w-full rounded-lg bg-[#282934] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#41424f] disabled:opacity-50" disabled={!periods.length || !employees.length}>Load Employee Payroll</button>
        </div>
      </form>
      <div className="min-w-0 rounded-2xl bg-[#fff4d3] p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-5 w-5 text-[#d88c00]" aria-hidden="true" />Salary Summary</div>
        <dl className="mt-3 grid grid-cols-2 divide-x divide-[#dfd1ae] text-sm">
          <div className="min-w-0 pr-3">
            <dt className="text-xs text-[#57525a]">{applicableCompensation.length === 1 && !['MONTHLY', 'SEMI_MONTHLY'].includes(applicableCompensation[0].payFrequency) ? 'Saved Base Rate' : 'Monthly Base Salary'}</dt>
            <dd className="mt-1 break-words text-base font-bold tabular-nums sm:text-lg">{applicableCompensation.length === 1 ? formatCurrency(applicableCompensation[0].baseRate, 'PHP') : 'Not set'}</dd>
          </div>
          <div className="min-w-0 pl-3">
            <dt className="text-xs text-[#57525a]">Cut-off Base Pay</dt>
            <dd className="mt-1 break-words text-base font-bold tabular-nums sm:text-lg">{selectedEntry?.baseAmountFormatted ?? 'Pending calculation'}</dd>
          </div>
        </dl>
        {period && <p className="mt-3 text-xs text-[#57525a]">{formatPayrollDate(period.periodStart)} – {formatPayrollDate(period.periodEnd)} · Pay date {formatPayrollDate(period.payDate)}</p>}
      </div>
    </div>

    {manage && <details className="rounded-xl border border-[#e8e7e6] bg-white p-4">
      <summary className="cursor-pointer text-xs font-semibold">Create a new payroll cutoff (start, end and pay date)</summary>
      <p className="mt-2 text-xs text-[#636471]">Use approved cutoff dates; generated entries retain their original period.</p>
      <PayrollPeriodForm />
    </details>}

    {period && manage && <section className="space-y-4 rounded-2xl border border-[#e8e7e6] bg-white p-4 shadow-sm sm:p-5" aria-labelledby="payroll-period-workflow">
      <div>
        <h2 id="payroll-period-workflow" className="text-lg font-bold">Payroll Processing</h2>
        <p className="mt-1 text-xs italic text-[#636471]">Process the selected cutoff for all eligible active employees. After finalization, each employee with an active ESS account can view their payslip in My Payroll without waiting for a notification.</p>
      </div>
      {editable && <div className="payroll-primary-action">
        <PayrollGenerationForm periods={[period]} selectedPeriodId={period.id} />
      </div>}
      {review && period.status !== 'FINALIZED' && <div className="payroll-review-action">
        <PayrollReviewControls periodId={period.id} periodLabel={period.name} status={period.status} canFinalize={review.canFinalize} hasEntries={data.entries.length > 0} />
      </div>}
      {period.status === 'FINALIZED' && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">Payroll finalized. Payslips are available in ESS for employees with active ESS accounts.</p>}
      {period.status === 'FINALIZED' && notification && <div className="payroll-notify-action">
        <PayrollNotifyForm periodId={period.id} token={notification.token} recipients={notification.recipients} skipped={notification.skipped} />
        {notification.skipped > 0 && <p className="mt-2 text-xs text-amber-800">{notification.skipped} finalized employee record(s) have no eligible ESS notification recipient (inactive account or notification preference disabled). Review employee configuration or account access if needed.</p>}
      </div>}
      {review && review.issues.length > 0 && period.status !== 'FINALIZED' && <details className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <summary className="cursor-pointer font-bold">{review.issues.length} payroll review item(s) require attention</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">{review.issues.map((issue, index) => <li key={index}>{issue.employeeName ? issue.employeeName + ': ' : ''}{issue.message}</li>)}</ul>
      </details>}
      <p className="text-xs text-[#636471]">Generation, review, and finalization apply to the entire payroll period. Select an employee below only to inspect or adjust an individual draft.</p>
    </section>}
    {selectedEmployee && period ? <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-xs shadow-sm">
        <p><span className="font-bold">{selectedEmployee.firstName} {selectedEmployee.lastName}</span> · {period.name} · <span className="font-semibold">{period.status}</span></p>
        {manage && <TenantLink className="font-semibold underline underline-offset-2" href={`/dashboard/payroll/settings?period=${period.id}&employee=${selectedEmployee.id}`}>Review employee payroll setup</TenantLink>}
      </div>
      {selectedReadiness && <p className="text-xs text-[#636471]">{selectedReadiness.status}: {selectedReadiness.action}</p>}

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)]">
        <div className="min-w-0 space-y-4">
          <section className="min-w-0 rounded-2xl border border-[#e8e7e6] bg-white p-4 shadow-sm sm:p-5" aria-labelledby="attendance-adjustments">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div><h2 id="attendance-adjustments" className="text-lg font-bold">Attendance Adjustments</h2>
                <p className="mt-0.5 text-xs italic text-[#636471]">Based on recorded attendance within the selected payroll period.</p></div>
            </div>
            {selectedEntry ? <div className="mt-4">
              <PayrollAttendanceBreakdown rows={selectedEntry.attendanceMoney ?? []} currency={selectedEntry.currency} />
              {selectedEntry.attendanceSummary && <p className="mt-3 text-xs text-[#636471]">Attendance: {selectedEntry.attendanceSummary.presentDays ?? 0} present · {selectedEntry.attendanceSummary.lateOccurrences ?? 0} late · {selectedEntry.attendanceSummary.absentDays ?? 0} absent</p>}
            </div> : <p className="mt-4 rounded-xl bg-[#faf8f6] p-4 text-sm text-[#636471]">Recorded attendance deductions will appear after generating the payroll draft. No amounts are estimated.</p>}
            <TenantLink className="mt-3 inline-flex text-xs font-semibold underline underline-offset-2" href={`/dashboard/attendance/${selectedEmployee.id}`}>View original attendance records</TenantLink>
          </section>

          <section className="min-w-0 rounded-2xl border border-[#e8e7e6] bg-white p-4 shadow-sm sm:p-5" aria-labelledby="additional-pay">
            <div className="flex items-start gap-3">
              <Gift className="mt-0.5 h-5 w-5 shrink-0 text-[#e69a00]" aria-hidden="true" />
              <div><h2 id="additional-pay" className="text-lg font-bold">Incentives / Additional Pay</h2>
                <p className="mt-0.5 text-xs italic text-[#636471]">Add approved compensation with the required supporting records.</p></div>
            </div>
            {selectedEntry?.additionalEarnings && <div className="mt-4 rounded-xl bg-[#faf8f6] p-3">
              <h3 className="text-xs font-bold">Recorded additional earnings</h3>
              {selectedEntry.additionalEarnings.length ? <dl className="mt-2 space-y-2">{selectedEntry.additionalEarnings.map(item => <div key={item.id} className="flex justify-between gap-3 text-xs"><dt>{item.description}</dt><dd className="shrink-0 font-semibold tabular-nums text-emerald-700">+{formatCurrency(item.amount, selectedEntry.currency)}</dd></div>)}</dl> : <p className="mt-1 text-xs text-[#636471]">No additional earnings recorded.</p>}
            </div>}
            {editable && manage && selectedEarnings.length > 0 && <div className="mt-4 space-y-3">
              <PayrollIncentiveForm key={selectedEarnings[0].id + '-' + selectedEarnings[0].version} employee={selectedEarnings[0]} periodId={period.id} />
              <PayrollEarningsForm employees={selectedEarnings} periodId={period.id} />
            </div>}
            {editable && manage && selectedEarnings.length === 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Verify statutory and payroll history in Payroll Settings to add approved incentives.</p>}
            {period.status === 'FINALIZED' && <p className="mt-3 text-xs text-[#636471]">This period is finalized. Earnings are locked.</p>}
          </section>

          <section className="min-w-0 rounded-2xl border border-[#e8e7e6] bg-white p-4 shadow-sm sm:p-5" aria-labelledby="statutory-deductions">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div><h2 id="statutory-deductions" className="text-lg font-bold">Statutory Deductions <span className="rounded-md bg-[#ffdf76] px-2 py-1 align-middle text-[10px] font-semibold">Auto-computed</span></h2>
                <p className="mt-1 text-xs italic text-[#636471]">Recorded employee shares from verified Philippine statutory calculations.</p></div>
            </div>
            <dl className="mt-4 divide-y divide-[#ece9e6] rounded-xl bg-[#faf8f6] px-4">
              {statutoryRows.map(row => <div key={row.label} className="flex items-center justify-between gap-3 py-3 text-xs sm:text-sm">
                <dt className="font-medium">{row.label}</dt>
                <dd className="shrink-0 text-right font-semibold tabular-nums">{row.amount === null ? 'Not recorded' : formatCurrency(row.amount, selectedEntry?.currency ?? 'PHP')}</dd>
              </div>)}
              {!selectedEntry && <p className="py-4 text-xs text-[#636471]">Generate a draft to see the statutory breakdown.</p>}
            </dl>
            {selectedEntry?.breakdown && <details className="mt-3 rounded-xl border border-[#e8e7e6] p-3">
              <summary className="cursor-pointer text-xs font-semibold">View calculation details and employer contributions</summary>
              <p className="mt-2 text-xs text-[#636471]">Employer shares are paid separately and are not deducted from employee pay.</p>
              <div className="mt-3"><PayrollDeductionBreakdown breakdown={selectedEntry.breakdown} currency={selectedEntry.currency} status={period.status} /></div>
            </details>}
            <p className="mt-3 text-xs text-[#636471]">Amounts are shown only when saved in the payroll record. Unverified values are not assumed to be zero.</p>
          </section>
        </div>

        <section className="min-w-0 rounded-2xl border border-[#e8e7e6] bg-white p-4 shadow-sm sm:p-5" aria-labelledby="payroll-preview">
          <div className="flex items-start gap-3">
            <Calculator className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div><h2 id="payroll-preview" className="text-lg font-bold">Payroll Preview</h2>
              <p className="mt-0.5 text-xs italic text-[#636471]">Summary of the selected employee&apos;s recorded payroll.</p></div>
          </div>
          {selectedEntry ? <>
            <dl className="mt-5 divide-y divide-[#ece9e6] text-sm">
              <div className="flex items-start justify-between gap-3 py-3"><dt>Base Pay (Cut-off)</dt><dd className="shrink-0 font-bold tabular-nums">{selectedEntry.baseAmountFormatted}</dd></div>
              {selectedEntry.additionalEarnings?.map(item => <div key={item.id} className="flex items-start justify-between gap-3 py-3 text-emerald-700"><dt>{item.description}</dt><dd className="shrink-0 font-semibold tabular-nums">+{formatCurrency(item.amount, selectedEntry.currency)}</dd></div>)}
              <div className="flex items-start justify-between gap-3 py-3"><dt>Gross Earnings</dt><dd className="shrink-0 font-semibold tabular-nums">{selectedEntry.grossAmountFormatted}</dd></div>
              <div className="flex items-start justify-between gap-3 py-3"><dt>Total Deductions</dt><dd className="shrink-0 font-semibold tabular-nums text-red-700">−{selectedEntry.totalDeductionsFormatted}</dd></div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#fff3d1] p-4">
              <span className="font-bold">Net Pay</span><strong className="text-right text-xl font-bold tabular-nums">{selectedEntry.netAmountFormatted}</strong>
            </div>
            {selectedEntry.issueMessage && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{selectedEntry.issueMessage}</p>}
          </> : <div className="mt-5 rounded-xl bg-[#faf8f6] p-5 text-sm text-[#636471]">
            Generate the first payroll draft to preview gross earnings, deductions and net pay. No sample amounts are displayed.
          </div>}
          <TenantLink className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-[#e8e7e6] bg-white px-4 py-3 text-xs font-semibold hover:bg-[#faf8f6]" href={`/dashboard/payroll/reports/employee?period=${period.id}&employee=${selectedEmployee.id}`}>
            <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" aria-hidden="true" />View Attendance &amp; Calculation Report</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </TenantLink>
          {selectedEntry?.canViewPayslip && <TenantLink className="mt-3 inline-flex text-xs font-semibold underline underline-offset-2" href={`/dashboard/payroll/payslips/${selectedEntry.id}`}>View / Print Finalized Payslip</TenantLink>}
        </section>
      </div>
    </> : <div className="rounded-2xl border border-[#e8e7e6] bg-white p-8 text-center">
      <h2 className="text-lg font-bold">Select an employee to start</h2>
      <p className="mt-2 text-sm text-[#636471]">Choose an employee and payroll period above. Payroll Settings is available for first-time salary and statutory setup.</p>
    </div>}
    <details className="rounded-2xl border bg-white p-4 sm:p-6">
      <summary className="cursor-pointer text-sm font-bold text-[#282934]">Advanced: full-period controls, payroll settings and reports</summary>
      <div className="mt-4 space-y-5">
    <section className={card} aria-labelledby="payroll-period"><h2 id="payroll-period" className="font-semibold">1. Generate Payroll</h2>
      <form method="get" className="flex flex-wrap items-end gap-3"><label className="grid flex-1 gap-1 text-xs font-semibold">Payroll period<select name="period" defaultValue={period?.id ?? ''} className="min-w-0 rounded-lg border px-3 py-2 text-sm">{!periods.length && <option value="">No periods yet</option>}{periods.map(row => <option key={row.id} value={row.id}>{row.name} · {row.status}</option>)}</select></label><button className="wp-button-secondary">Select period</button></form>
      {period && <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[['Start date', formatPayrollDate(period.periodStart)], ['End date', formatPayrollDate(period.periodEnd)], ['Scheduled pay date', formatPayrollDate(period.payDate)], ['Status', period.status]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>}
      {manage && <details><summary className="cursor-pointer text-sm font-semibold">Create a payroll period</summary><p className="mt-2 text-xs text-slate-600">Use your configured pay frequency and cutoff dates. Semi-monthly periods use 1–15 or 16–month-end.</p><PayrollPeriodForm /></details>}
    </section>
    <section className={card} aria-labelledby="payroll-generate"><h2 id="payroll-generate" className="font-semibold">Employee setup and optional earnings</h2>
      {editable ? <>
        <p className="text-sm text-slate-600">{employees.length} eligible employees. Approved attendance and leave are checked during generation.</p>
        {readiness && <PayrollReadinessTable rows={readiness.readiness} periodId={period.id} />}
        <PayrollEarningsForm employees={earningsEmployees} periodId={period.id} />
        <PayrollGenerationForm key={period.id} periods={[period]} selectedPeriodId={period.id} />
        {readiness?.setup && <details><summary className="cursor-pointer text-sm font-semibold">Reuse verified employee setup</summary><PayrollReuseSetup rows={readiness.setup} periodId={period.id} /></details>}
      </> : <p className="text-sm text-slate-600">{period?.status === 'FINALIZED' ? 'This payroll is finalized. Earnings and calculations are locked.' : 'Select or create a period to prepare payroll.'}</p>}
    </section>
    <section className={card} aria-labelledby="payroll-review"><h2 id="payroll-review" className="font-semibold">2. Review and Finalize</h2>
      <PayrollReviewTable earningsEmployees={earningsEmployees} periodId={period?.id} entries={data.entries} selectedPeriodName={period?.name} isPeriodFinalized={period?.status === 'FINALIZED'} />
      {review && period?.status !== 'FINALIZED' && review.issues.length > 0 && <details open><summary className="cursor-pointer font-semibold text-amber-900">Resolve {review.issues.length} items before finalization</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{review.issues.map((issue, index) => <li key={index}>{issue.employeeName ? `${issue.employeeName}: ` : ''}{issue.message}</li>)}</ul></details>}
      {manage && period && review && <PayrollReviewControls periodId={period.id} periodLabel={period.name} status={period.status} canFinalize={review.canFinalize} hasEntries={data.entries.length > 0} />}
      {editable && <details><summary className="cursor-pointer text-sm font-semibold">Recalculate an unfinished employee entry</summary>{earningsEmployees.filter(row => row.hasEntry).map(row => <details key={row.id} className="mt-3"><summary className="cursor-pointer text-sm">{row.name}</summary><PayrollRecalculateForm employee={row} periodId={period.id} /></details>)}</details>}
    </section>
    <section className={card} aria-labelledby="payroll-notify"><h2 id="payroll-notify" className="font-semibold">3. Notify Employees</h2>{notification && period ? <PayrollNotifyForm periodId={period.id} token={notification.token} recipients={notification.recipients} skipped={notification.skipped} /> : <p className="text-sm text-slate-600">Notifications become available after finalization. Finalized payslips are available in ESS immediately.</p>}</section>
      </div>
    </details>

  </div>;
}
