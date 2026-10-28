import type { PayrollReadinessRow } from '@/features/payroll/readiness';

export function PayrollReadinessTable({ rows }: { rows: PayrollReadinessRow[] }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="readiness-heading">
    <h2 id="readiness-heading" className="text-base font-bold text-slate-900">Check Employee Readiness</h2>
    <p className="mt-1 mb-4 text-sm text-slate-600">Resolve setup before generation. Final calculation, earnings and ledger checks still run for every employee.</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><caption className="sr-only">Payroll readiness and required actions by employee</caption>
      <thead className="bg-slate-50 text-slate-700"><tr>{['Employee', 'Salary configuration', 'Government deduction setup', 'Opening history', 'Attendance', 'Overall readiness', 'Specific action required'].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.employeeId} className="border-t align-top"><th scope="row" className="p-3">{row.employeeName}</th><td className="p-3">{row.salary}</td><td className="p-3">{row.government}</td><td className="p-3">{row.history}</td><td className="p-3">{row.attendance}</td><td className={`p-3 font-bold ${row.ready ? 'text-emerald-800' : 'text-amber-900'}`}>{row.ready ? 'Ready to calculate' : 'Action required'}</td><td className="p-3">{row.action}</td></tr>)}</tbody>
    </table></div>{!rows.length && <p className="py-4 text-sm text-slate-600">No active employees. This period cannot advance to Review until valid entries exist.</p>}
  </section>;
}
