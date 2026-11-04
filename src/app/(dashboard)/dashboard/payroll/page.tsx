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
import { EmployeePayrollEntriesTable } from '@/components/payroll/EmployeePayrollEntriesTable';
import { PayrollEarningsForm, PayrollRecalculateForm } from '@/components/payroll/PayrollEarningsForm';
import { PayrollNotifyForm } from '@/components/payroll/PayrollNotifyForm';

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string; tab?: string }> }) {
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
  const notification = manage && period?.status === 'FINALIZED' ? await previewPayrollNotifications(scope) : null;
  const configurationCompensations = compensations.map(record => ({ ...record, baseRate: record.baseRate.toFixed(2) }));
  const configurationPolicies = policies.map(policy => ({ id: policy.id, version: policy.version, effectiveFrom: policy.effectiveFrom, effectiveTo: policy.effectiveTo, status: policy.status, dailyPayBasis: policy.dailyPayBasis, lateDeductionRule: policy.lateDeductionRule, absenceDeductionRule: policy.absenceDeductionRule, undertimeDeductionRule: policy.undertimeDeductionRule, roundingRule: policy.roundingRule, createdBy: policy.createdBy }));
  const card = 'rounded-2xl border bg-white p-4 sm:p-6 space-y-4';
  return <div className="space-y-5 bg-[#FAF8F6] text-[#282934]">
    <header><h1 className="text-2xl font-bold">Payroll</h1><p className="mt-1 text-sm text-slate-600">Select a period, manage earnings, review payroll, and notify employees.</p></header>
    <ol aria-label="Payroll workflow" className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">{['1. Select period', '2. Earnings & generation', '3. Review & finalize', '4. Notify employees'].map(label => <li className="rounded-lg border bg-white p-3 font-semibold" key={label}>{label}</li>)}</ol>
    <section className={card} aria-labelledby="payroll-period"><h2 id="payroll-period" className="font-semibold">1. Select Payroll Period</h2>
      <form method="get" className="flex flex-wrap items-end gap-3"><label className="grid flex-1 gap-1 text-xs font-semibold">Payroll period<select name="period" defaultValue={period?.id ?? ''} className="min-w-0 rounded-lg border px-3 py-2 text-sm">{!periods.length && <option value="">No periods yet</option>}{periods.map(row => <option key={row.id} value={row.id}>{row.name} · {row.status}</option>)}</select></label><button className="wp-button-secondary">Select period</button></form>
      {period && <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[['Start date', formatPayrollDate(period.periodStart)], ['End date', formatPayrollDate(period.periodEnd)], ['Scheduled pay date', formatPayrollDate(period.payDate)], ['Status', period.status]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>}
      {manage && <details><summary className="cursor-pointer text-sm font-semibold">Create a payroll period</summary><p className="mt-2 text-xs text-slate-600">Use your configured pay frequency and cutoff dates. Semi-monthly periods use 1–15 or 16–month-end.</p><PayrollPeriodForm /></details>}
    </section>
    <section className={card} aria-labelledby="payroll-generate"><h2 id="payroll-generate" className="font-semibold">2. Manage Earnings and Generate Payroll</h2>
      {editable ? <>
        <p className="text-sm text-slate-600">{employees.length} eligible employees. Approved attendance and leave are checked during generation.</p>
        {readiness && <PayrollReadinessTable rows={readiness.readiness} />}
        <PayrollEarningsForm employees={earningsEmployees} periodId={period.id} />
        <PayrollGenerationForm key={period.id} periods={[period]} selectedPeriodId={period.id} />
        {readiness?.setup && <details><summary className="cursor-pointer text-sm font-semibold">Reuse verified employee setup</summary><PayrollReuseSetup rows={readiness.setup} periodId={period.id} /></details>}
      </> : <p className="text-sm text-slate-600">{period?.status === 'FINALIZED' ? 'This payroll is finalized. Earnings and calculations are locked.' : 'Select or create a period to prepare payroll.'}</p>}
    </section>
    <section className={card} aria-labelledby="payroll-review"><h2 id="payroll-review" className="font-semibold">3. Review and Finalize</h2>
      <EmployeePayrollEntriesTable entries={data.entries} selectedPeriodName={period?.name} isPeriodFinalized={period?.status === 'FINALIZED'} />
      {review && period?.status !== 'FINALIZED' && review.issues.length > 0 && <details open><summary className="cursor-pointer font-semibold text-amber-900">Resolve {review.issues.length} items before finalization</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{review.issues.map((issue, index) => <li key={index}>{issue.employeeName ? `${issue.employeeName}: ` : ''}{issue.message}</li>)}</ul></details>}
      {manage && period && review && <PayrollReviewControls periodId={period.id} periodLabel={period.name} status={period.status} canFinalize={review.canFinalize} hasEntries={data.entries.length > 0} />}
      {editable && <details><summary className="cursor-pointer text-sm font-semibold">Recalculate an unfinished employee entry</summary>{earningsEmployees.filter(row => row.hasEntry).map(row => <details key={row.id} className="mt-3"><summary className="cursor-pointer text-sm">{row.name}</summary><PayrollRecalculateForm employee={row} periodId={period.id} /></details>)}</details>}
    </section>
    <section className={card} aria-labelledby="payroll-notify"><h2 id="payroll-notify" className="font-semibold">4. Notify Employees</h2>{notification && period ? <PayrollNotifyForm periodId={period.id} token={notification.token} recipients={notification.recipients} skipped={notification.skipped} /> : <p className="text-sm text-slate-600">Notifications become available after finalization. Finalized payslips are available in ESS immediately.</p>}</section>
    {manage && <details id="advanced-payroll" className={card} open={params.tab === 'configuration'}><summary className="cursor-pointer font-semibold">Advanced Settings</summary><PayrollConfigurationTab employees={employees} compensations={configurationCompensations} policies={configurationPolicies} currentPolicy={configurationPolicies.find(row => row.id === currentPolicy?.id) ?? null} leaveTypes={leaveTypes} statutorySetup={readiness?.setup ?? null} selectedPeriod={period} /></details>}
  </div>;
}
