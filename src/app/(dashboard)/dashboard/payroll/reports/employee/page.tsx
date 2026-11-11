import { notFound } from 'next/navigation';
import { CalendarDays, FileText, Wallet } from 'lucide-react';
import { TenantLink } from '@/components/ui/TenantLink';
import { PayrollAttendanceBreakdown } from '@/components/payroll/PayrollAttendanceBreakdown';
import { PayrollDeductionBreakdown } from '@/components/payroll/PayrollDeductionBreakdown';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canViewPayroll } from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { payrollAttendanceMoney } from '@/features/payroll/attendance-money';
import { payrollEarningsBreakdown } from '@/features/payroll/earnings-breakdown';
import { payrollSnapshotBreakdown } from '@/features/payroll/snapshot-breakdown';

type RecordedAttendance = {
  date: string;
  status: string;
  disposition: string;
  lateSeconds: number;
  undertimeSeconds: number;
  overtimeSeconds: number;
};
const money = (value: string | number, currency = 'PHP') =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(value));
const dateLabel = (value: Date | string) =>
  new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(typeof value === 'string' ? new Date(value + 'T00:00:00.000Z') : value);
const duration = (seconds: number) => (seconds / 60).toFixed(2) + ' min';
const positive = (seconds: unknown): seconds is number => typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0;

export default async function EmployeePayrollCalculationReport({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; employee?: string }>;
}) {
  const user = await requireBackOfficeContext();
  if (!canViewPayroll(user)) notFound();
  const params = await searchParams;
  if (!params.period || !params.employee) notFound();

  const entry = await prisma.payrollEntry.findFirst({
    where: {
      organizationId: user.organizationId,
      payrollPeriodId: params.period,
      employeeId: params.employee,
    },
    include: {
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
      payrollPeriod: { select: { name: true, periodStart: true, periodEnd: true, status: true } },
      employeeCompensation: { select: { baseRate: true, currency: true } },
    },
  });
  if (!entry) return <div className="space-y-4 text-[#282934]">
    <h1 className="text-2xl font-bold">Employee Calculation Report</h1>
    <p className="rounded-xl bg-white p-5 text-sm">No calculated payroll entry exists for the selected employee and cutoff. Generate payroll first.</p>
    <TenantLink href={'/dashboard/payroll?period=' + encodeURIComponent(params.period) + '&employee=' + encodeURIComponent(params.employee)} className="text-sm font-semibold underline">Back to Payroll</TenantLink>
  </div>;

  const currency = entry.employeeCompensation.currency;
  const breakdown = payrollSnapshotBreakdown(entry.calculationSnapshot);
  const moneyRows = payrollAttendanceMoney(entry.calculationSnapshot);
  const additional = payrollEarningsBreakdown(entry.calculationSnapshot);
  const snapshot = entry.calculationSnapshot && typeof entry.calculationSnapshot === 'object' && !Array.isArray(entry.calculationSnapshot)
    ? entry.calculationSnapshot as Record<string, unknown> : {};
  const rawDaily = snapshot.attendanceDailyRecords;
  const daily: RecordedAttendance[] | null = Array.isArray(rawDaily) &&
    rawDaily.every(row => row && typeof row === 'object' && !Array.isArray(row) &&
      typeof row.date === 'string' && typeof row.status === 'string' &&
      typeof row.disposition === 'string' && positive(row.lateSeconds) &&
      positive(row.undertimeSeconds) && positive(row.overtimeSeconds))
    ? rawDaily as RecordedAttendance[] : null;

  const card = 'rounded-2xl border border-[#e8e7e6] bg-white p-4 sm:p-5';
  return <div className="space-y-5 text-[#282934]">
    <header className="space-y-2">
      <TenantLink className="text-xs font-semibold underline underline-offset-2" href={'/dashboard/payroll?period=' + encodeURIComponent(params.period) + '&employee=' + encodeURIComponent(params.employee)}>Back to Payroll</TenantLink>
      <h1 className="text-2xl font-bold">Employee Calculation Report</h1>
      <p className="text-sm text-[#626271]">Saved attendance quantities, peso rates, statutory deductions, gross pay, and net pay. This report reads the payroll calculation snapshot; it does not recalculate historical figures.</p>
    </header>
    <div className="grid gap-4 sm:grid-cols-2">
      <section className={card}><div className="flex items-center gap-2 font-bold"><FileText className="h-5 w-5" /> Employee</div><p className="mt-3 text-lg font-semibold">{entry.employee.firstName} {entry.employee.lastName}</p><p className="text-xs text-[#626271]">{entry.employee.employeeNumber}</p></section>
      <section className={card}><div className="flex items-center gap-2 font-bold"><CalendarDays className="h-5 w-5" /> Payroll Coverage</div><p className="mt-3 text-sm font-semibold">{entry.payrollPeriod.name}</p><p className="mt-1 text-xs text-[#626271]">{dateLabel(entry.payrollPeriod.periodStart)} – {dateLabel(entry.payrollPeriod.periodEnd)} · {entry.payrollPeriod.status}</p></section>
    </div>
    <section className={card}>
      <h2 className="mb-3 text-lg font-bold">Attendance adjustments</h2>
      <PayrollAttendanceBreakdown rows={moneyRows} currency={currency} />
      <p className="mt-3 text-xs text-[#626271]">The saved quantities and rates explain the payroll amounts, including overtime pay. Recorded money amounts are authoritative.</p>
    </section>
    <section className={card}>
      <h2 className="mb-3 text-lg font-bold">Attendance records used</h2>
      {daily ? <div className="overflow-x-auto"><table className="min-w-full text-left text-xs">
        <thead className="bg-[#faf8f6]"><tr><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Late</th><th className="p-3">Undertime</th><th className="p-3">Overtime</th></tr></thead>
        <tbody className="divide-y divide-[#ece9e6]">{daily.map(row => <tr key={row.date}><td className="p-3">{dateLabel(row.date)}</td><td className="p-3">{row.status.replaceAll('_', ' ')}{row.disposition === 'APPROVED_LEAVE' ? ' · approved leave' : ''}</td><td className="p-3">{duration(row.lateSeconds)}</td><td className="p-3">{duration(row.undertimeSeconds)}</td><td className="p-3">{duration(row.overtimeSeconds)}</td></tr>)}</tbody>
      </table></div> : <p className="text-sm text-[#626271]">Day-by-day attendance was not included in this historical payroll snapshot. Saved totals remain available above; later attendance edits are not treated as original payroll evidence.</p>}
    </section>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={card}><h2 className="mb-3 text-lg font-bold">Statutory and other deductions</h2><PayrollDeductionBreakdown breakdown={breakdown} currency={currency} status={entry.status} /></section>
      <section className={card}><div className="mb-3 flex items-center gap-2"><Wallet className="h-5 w-5" /><h2 className="text-lg font-bold">Payroll calculation</h2></div>
        <dl className="divide-y divide-[#ece9e6] text-sm">
          <div className="flex justify-between gap-3 py-3"><dt>Monthly Base Salary</dt><dd className="font-semibold">{money(entry.employeeCompensation.baseRate.toFixed(2), currency)}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt>Cutoff Base Pay</dt><dd className="font-semibold">{money(entry.baseAmount.toFixed(2), currency)}</dd></div>
          {additional?.map(row => <div key={row.id} className="flex justify-between gap-3 py-3 text-emerald-700"><dt>{row.description}</dt><dd className="font-semibold">+{money(row.amount, currency)}</dd></div>)}
          <div className="flex justify-between gap-3 py-3"><dt>Gross Pay</dt><dd className="font-semibold">{money(entry.grossAmount.toFixed(2), currency)}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt>Total Deductions</dt><dd className="font-semibold">{money(entry.totalDeductions.toFixed(2), currency)}</dd></div>
        </dl>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#fff3d1] p-4"><strong>Net Pay</strong><strong className="text-xl">{money(entry.netAmount.toFixed(2), currency)}</strong></div>
        <p className="mt-3 text-xs text-[#626271]">Finalization locks the official payslip. Only finalized amounts appear as official employee payslips in ESS.</p>
      </section>
    </div>
  </div>;
}
