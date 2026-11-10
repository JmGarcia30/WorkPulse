import type { PayrollAttendanceMoneyRow } from '@/features/payroll/attendance-money';

const pesos = (amount: string | null, currency: string) =>
  amount === null ? 'Not recorded' :
    new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount));

export function PayrollAttendanceBreakdown({ rows, currency = 'PHP' }: { rows: PayrollAttendanceMoneyRow[]; currency?: string }) {
  return <div className="overflow-x-auto rounded-xl border border-[#e8e7e6]">
    <table className="min-w-full text-left text-xs sm:text-sm">
      <thead className="bg-[#faf8f6] text-[#5c5d65]">
        <tr><th scope="col" className="p-3">Attendance</th><th scope="col" className="p-3">Recorded quantity</th><th scope="col" className="p-3">Policy rate</th><th scope="col" className="p-3 text-right">Deduction</th></tr>
      </thead>
      <tbody className="divide-y divide-[#e8e7e6]">
        {rows.map(row => <tr key={row.label}>
          <th scope="row" className="p-3 font-medium text-[#282934]">{row.label}</th>
          <td className="p-3">{row.quantity === null ? 'Not recorded' : `${row.quantity} ${row.unit}`}</td>
          <td className="p-3">{row.rate === null ? row.method : `${pesos(row.rate, currency)} ${row.rateUnit ?? ''}`}</td>
          <td className="p-3 text-right font-semibold tabular-nums">{row.amount === null ? 'Not recorded' : `−${pesos(row.amount, currency)}`}</td>
        </tr>)}
      </tbody>
    </table>
    <p className="border-t bg-[#faf8f6] p-3 text-xs text-[#636471]">Recorded deductions come from the saved payroll calculation. Quantities and rates are evidence, not editable overrides. Historical payroll may not contain all quantity details.</p>
  </div>;
}
