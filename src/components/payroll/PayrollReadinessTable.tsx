import type { PayrollReadinessRow } from '@/features/payroll/readiness';
import { TenantLink } from '@/components/ui/TenantLink';

export function PayrollReadinessTable({ rows, periodId }: { rows: PayrollReadinessRow[]; periodId?: string }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="readiness-heading">
    <h2 id="readiness-heading" className="text-base font-bold text-slate-900">Check Employee Readiness</h2>
    <p className="mt-1 mb-4 text-sm text-slate-600">Resolve setup before generation. Final calculation, earnings and ledger checks still run for every employee.</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><caption className="sr-only">Payroll readiness and required actions by employee</caption>
      <thead className="bg-slate-50 text-slate-700"><tr>{['Employee', 'Status', 'Next action'].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.employeeId} className="border-t align-top"><th scope="row" className="p-3">{row.employeeName}</th><td className={`p-3 font-bold ${row.ready ? 'text-emerald-800' : 'text-amber-900'}`}>{row.status}</td><td className="p-3"><p>{row.action}</p>{!row.ready && <TenantLink className="mt-2 inline-block font-semibold underline" href={`/dashboard/payroll/settings?period=${encodeURIComponent(periodId ?? '')}&employee=${encodeURIComponent(row.employeeId)}`}>Fix Setup<span className="sr-only"> for {row.employeeName}</span></TenantLink>}<details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer">View setup checks</summary><dl className="mt-2 space-y-2">{[['Salary', row.salary], ['Government coverage', row.government], ['Verified history', row.history], ['Attendance', row.attendance]].map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}</dl></details></td></tr>)}</tbody>
    </table></div>{!rows.length && <p className="py-4 text-sm text-slate-600">No active employees. This period cannot advance to Review until valid entries exist.</p>}
  </section>;
}
