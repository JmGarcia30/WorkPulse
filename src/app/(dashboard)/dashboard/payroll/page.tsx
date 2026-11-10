import { TenantLink } from '@/components/ui/TenantLink';
import { notFound } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManagePayroll, canViewPayroll } from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { getPayrollDashboardData } from '@/features/payroll/queries';
import { getPayrollReadiness } from '@/features/payroll/readiness';
import { earningsVersion } from '@/features/payroll/earnings';
import { parseStatutoryInput } from '@/features/payroll/statutory-inputs';
import { previewPayrollNotifications } from '@/features/payroll/notifications';
import { formatPayrollDate } from '@/features/payroll/formatters';
import { PayrollPeriodForm, PayrollGenerationForm, PayrollReviewControls } from '@/components/payroll/PayrollSetupForms';
import { PayrollReadinessTable } from '@/components/payroll/PayrollReadinessTable';
import { PayrollReuseSetup } from '@/components/payroll/PayrollReuseSetup';
import { PayrollConfigurationTab } from '@/components/payroll/PayrollConfigurationTab';
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
  const settings = params.tab === 'configuration';
  const setupRows = params.employee ? readiness?.setup.filter(row => row.id === params.employee) ?? [] : readiness?.setup ?? [];
  const card = 'rounded-2xl border bg-white p-4 sm:p-6 space-y-4';
  if (settings) {
    if (!manage) notFound();
    return <div className="space-y-5"><header><h1 className="text-2xl font-bold">Payroll Settings</h1><p className="mt-2 text-sm text-slate-600">Follow employee setup in order. Existing verified records are shown; missing history and legal declarations require HR review.</p><TenantLink className="mt-3 inline-block underline" href={`/dashboard/payroll?period=${period?.id ?? ''}`}>Back to payroll</TenantLink></header><PayrollConfigurationTab employees={params.employee ? employees.filter(row => row.id === params.employee) : employees} compensations={params.employee ? configurationCompensations.filter(row => row.employeeId === params.employee) : configurationCompensations} policies={configurationPolicies} currentPolicy={configurationPolicies.find(row => row.id === currentPolicy?.id) ?? null} leaveTypes={leaveTypes} statutorySetup={setupRows} selectedPeriod={period} /></div>;
  }
  return <div className="space-y-5 bg-[#FAF8F6] text-[#282934]">
    <header><h1 className="text-2xl font-bold">Payroll</h1><p className="mt-1 text-sm text-slate-600">Generate payroll, review and finalize, then notify employees.</p>{manage && <TenantLink className="mt-2 inline-block text-sm font-semibold underline" href={`/dashboard/payroll/settings?period=${period?.id ?? ''}`}>Payroll Settings</TenantLink>}</header>
    <ol aria-label="Payroll workflow" className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">{['1. Choose Employee & Period', '2. Review Pay & Incentives', '3. Generate & Finalize', '4. Notify Employee'].map(label => <li className="rounded-lg border bg-white p-3 font-semibold" key={label}>{label}</li>)}</ol>
    <section className={card} aria-labelledby="quick-payroll">
      <div>
        <h2 id="quick-payroll" className="text-lg font-bold">Quick Employee Payroll</h2>
        <p className="mt-1 text-sm text-slate-600">Select an employee and cutoff, review attendance deductions and any incentives, then generate a draft. Statutory deductions use verified Philippine schedules and saved employee records.</p>
      </div>
      <form method="get" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1 text-xs font-semibold">Pay period
          <select className="wp-input" name="period" defaultValue={period?.id ?? ''} required>
            {periods.map(row => <option key={row.id} value={row.id}>{row.name} · {row.status}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">Employee
          <select className="wp-input" name="employee" defaultValue={selectedEmployee?.id ?? ''} required>
            <option value="">Select employee</option>
            {employees.map(row => <option key={row.id} value={row.id}>{row.employeeNumber} — {row.firstName} {row.lastName}</option>)}
          </select>
        </label>
        <button className="wp-button-secondary" disabled={!periods.length || !employees.length}>Select Employee</button>
      </form>
      {selectedEmployee && period ? <div className="space-y-4">
        <div className="rounded-xl bg-[#FAF8F6] p-4">
          <h3 className="text-sm font-bold">1. Employee salary and payroll dates</h3>
          <p className="mt-1 text-sm">{selectedEmployee.firstName} {selectedEmployee.lastName} · {period.name}</p>
          <p className="mt-2 text-sm">Monthly base salary: {applicableCompensation.length === 1 ? `PHP ${applicableCompensation[0].baseRate.toFixed(2)} · ${applicableCompensation[0].payFrequency.replaceAll('_', ' ').toLowerCase()}` : 'Payroll setup required — verify the salary for this cutoff.'}</p>
          <p className="mt-1 text-sm">Cutoff: {formatPayrollDate(period.periodStart)} to {formatPayrollDate(period.periodEnd)} · Pay date: {formatPayrollDate(period.payDate)}</p>
          <p className="mt-1 text-sm">Cutoff base pay: {selectedEntry?.baseAmountFormatted ?? 'Calculated after draft generation'}</p>
          <p className="mt-1 text-xs text-slate-600">{selectedReadiness ? `${selectedReadiness.status}: ${selectedReadiness.action}` : period.status === 'FINALIZED' ? 'This period has been finalized.' : 'Set up a payroll period before calculation.'}</p>
          {manage && <TenantLink className="mt-2 inline-block text-sm font-semibold underline" href={`/dashboard/payroll/settings?period=${period.id}&employee=${selectedEmployee.id}`}>Review employee payroll setup</TenantLink>}
        </div>
        {editable && <div>
          <h3 className="text-sm font-bold">2. Attendance adjustments and additional pay</h3>
          <p className="mt-1 text-xs text-slate-600">Calculated peso deductions are taken from the saved attendance/payroll record. Overtime and incentives must be approved and classified before calculation.</p>
          {selectedEntry ? <div className="mt-3"><PayrollAttendanceBreakdown rows={selectedEntry.attendanceMoney} currency={selectedEntry.currency}/></div> : <p className="mt-2 text-sm text-slate-600">Attendance adjustment amounts will appear after generating the first draft. Verify complete attendance records before calculation.</p>}
          {selectedEarnings.length > 0 && manage && <div className="mt-4 space-y-2"><h4 className="text-sm font-bold">Incentives / Additional Pay</h4><PayrollIncentiveForm key={`${selectedEarnings[0].id}-${selectedEarnings[0].version}`} employee={selectedEarnings[0]} periodId={period.id}/><PayrollEarningsForm employees={selectedEarnings} periodId={period.id} /></div>}
          {selectedEarnings.length === 0 && manage && <p className="mt-2 text-sm text-amber-800">To add an incentive, verify the employee&apos;s statutory and payroll history under Payroll Settings first.</p>}
          {manage && <PayrollGenerationForm periods={[period]} selectedPeriodId={period.id} employeeId={selectedEmployee.id} />}
          
        </div>}
        <div className="rounded-xl border p-4">
          <h3 className="text-sm font-bold">3. Review earnings, statutory deductions and net pay</h3>
          {selectedEntry ? <div className="mt-3 space-y-3">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {([['Basic pay', selectedEntry.baseAmountFormatted], ['Gross earnings', selectedEntry.grossAmountFormatted], ['Total deductions', selectedEntry.totalDeductionsFormatted], ['Net pay', selectedEntry.netAmountFormatted]] as const).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="font-bold">{value}</dd></div>)}
            </dl>
            {selectedEntry.attendanceSummary && <p className="text-xs text-slate-600">Attendance snapshot: {selectedEntry.attendanceSummary.presentDays ?? 0} present · {selectedEntry.attendanceSummary.lateOccurrences ?? 0} late · {selectedEntry.attendanceSummary.absentDays ?? 0} absent. See the recorded undertime deduction below.</p>}
            {selectedEntry.additionalEarnings && <section className="rounded-lg bg-[#faf8f6] p-3"><h4 className="text-xs font-bold">Approved additions</h4>{selectedEntry.additionalEarnings.length ? <dl className="mt-2 space-y-1">{selectedEntry.additionalEarnings.map(item => <div className="flex items-center justify-between gap-2 text-xs" key={item.id}><dt>{item.description}</dt><dd className="font-bold tabular-nums">+ PHP {item.amount}</dd></div>)}</dl> : <p className="mt-1 text-xs text-slate-600">No additional earnings recorded.</p>}</section>}
            {selectedEntry.breakdown && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-bold">View statutory deduction calculation and employer contributions</summary><p className="mt-2 text-xs text-slate-600">Employee deductions use verified SSS, PhilHealth, Pag-IBIG and BIR schedules, allocated across cutoffs. Employer shares are not deducted from employee pay.</p><div className="mt-3"><PayrollDeductionBreakdown breakdown={selectedEntry.breakdown} currency={selectedEntry.currency} status={period.status} /></div></details>}
            {selectedEntry.issueMessage && <p role="alert" className="text-sm text-amber-900">{selectedEntry.issueMessage}</p>}
            {selectedEntry.canViewPayslip && <TenantLink className="inline-block text-sm font-semibold underline" href={`/dashboard/payroll/payslips/${selectedEntry.id}`}>View / Print Finalized Payslip</TenantLink>}
          </div> : <p className="mt-2 text-sm text-slate-600">No calculated entry yet. Check setup and select Calculate Selected Employee above.</p>}
          <p className="mt-3 text-xs text-slate-600">For safety, finalization checks the entire cutoff and all eligible employees. Calculate remaining employees or resolve their readiness issues before finalizing.</p>
          {manage && review && <PayrollReviewControls periodId={period.id} periodLabel={period.name} status={period.status} canFinalize={review.canFinalize} hasEntries={data.entries.length > 0} />}
        </div>
        <div className="rounded-xl border p-4">
          <h3 className="text-sm font-bold">4. Notify employee after finalization</h3>
          {manage && period.status === 'FINALIZED' && notification
            ? <PayrollNotifyForm periodId={period.id} token={notification.token} recipients={notification.recipients} skipped={notification.skipped} employeeId={selectedEmployee.id} />
            : <p className="mt-2 text-sm text-slate-600">After the cutoff is finalized, this employee’s payslip appears in ESS. Then you can send their in-app notification here.</p>}
        </div>
      </div> : <p className="text-sm text-slate-600">Select an employee and a payroll period to start. Payroll Settings is available for first-time salary and statutory setup.</p>}
    </section>
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
