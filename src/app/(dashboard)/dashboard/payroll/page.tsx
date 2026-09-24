import { notFound } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canViewPayroll } from '@/lib/permissions/rbac';
import { getPayrollFoundation } from '@/features/payroll/queries';
import { CompensationForm, PayrollPeriodForm } from '@/components/payroll/PayrollSetupForms';

const dateLabel = (date: Date) => new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);

export default async function PayrollPage() {
  const user = await requireBackOfficeContext();
  if (!canViewPayroll(user)) notFound();
  const { employees, compensations, periods } = await getPayrollFoundation(user.organizationId);
  return <div className="space-y-7">
    <header><h1 className="text-2xl font-bold tracking-tight">Payroll</h1><p className="mt-1 text-sm text-slate-500">Manage employee compensation and payroll periods.</p></header>
    <section className="rounded-3xl border bg-white p-6 shadow-sm"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Employee Compensation</p><p className="mt-1 text-sm text-slate-600">Effective-dated base compensation records. Existing history is preserved.</p></div>
      <CompensationForm employees={employees} />
      <div className="mt-5 overflow-x-auto">{compensations.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No compensation records have been configured yet.</p> : <table className="w-full text-left text-xs"><thead className="border-b text-slate-500"><tr>{['Employee', 'Type', 'Base rate', 'Frequency', 'Effective', 'Status'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y">{compensations.map(record => <tr key={record.id}><td className="px-3 py-3 font-semibold">{record.employee.firstName} {record.employee.lastName}<span className="block font-normal text-slate-500">{record.employee.employeeNumber}</span></td><td className="px-3 py-3">{record.compensationType}</td><td className="px-3 py-3">{record.currency} {record.baseRate.toFixed(2)}</td><td className="px-3 py-3">{record.payFrequency}</td><td className="px-3 py-3">{dateLabel(record.effectiveFrom)}{record.effectiveTo ? ` – ${dateLabel(record.effectiveTo)}` : ' onward'}</td><td className="px-3 py-3 font-semibold">{record.status}</td></tr>)}</tbody></table>}</div>
    </section>
    <section className="rounded-3xl border bg-white p-6 shadow-sm"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Payroll Periods</p><p className="mt-1 text-sm text-slate-600">Create payroll cutoffs before calculation and review.</p></div>
      <PayrollPeriodForm />
      <div className="mt-5 overflow-x-auto">{periods.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No payroll periods have been created yet.</p> : <table className="w-full text-left text-xs"><thead className="border-b text-slate-500"><tr>{['Period', 'Coverage', 'Pay date', 'Status'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y">{periods.map(period => <tr key={period.id}><td className="px-3 py-3 font-semibold">{period.name}</td><td className="px-3 py-3">{dateLabel(period.periodStart)} – {dateLabel(period.periodEnd)}</td><td className="px-3 py-3">{dateLabel(period.payDate)}</td><td className="px-3 py-3 font-semibold">{period.status}</td></tr>)}</tbody></table>}</div>
    </section>
  </div>;
}
