import type { PayrollSnapshotBreakdown } from '@/features/payroll/snapshot-breakdown';

function RecordedAmount({ value, currency }: { value: string | null; currency: string }) {
  return <>{value === null ? 'Not recorded' : new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value))}</>;
}

export function PayrollDeductionBreakdown({ breakdown, currency, status = 'FINALIZED' }: { breakdown: PayrollSnapshotBreakdown; currency: string; status?: string }) {
  const { employee, allocation } = breakdown;
  return <div className="min-w-0 space-y-4 text-xs">
    {breakdown.format === 'LEGACY' && <p className="rounded-lg bg-slate-50 p-3 text-slate-600">Historical payslip: statutory details were not recorded in this snapshot. Missing amounts are not assumed to be zero.</p>}
    {breakdown.format === 'UNAVAILABLE' && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">Statutory details are unavailable in the stored snapshot. Ask HR to review the record; amounts have not been recalculated.</p>}
    {allocation && <p className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-teal-950">{allocation.frequency === 'MONTHLY' ? 'Monthly allocation' : allocation.slot === 'FIRST' ? 'First cutoff · monthly contribution portion' : 'Second cutoff · remaining monthly contribution'} · {allocation.month}. {status === 'FINALIZED' ? 'Finalized allocation.' : 'Reserved allocation; pending finalization.'} Amounts below belong to this payroll only. Employer amounts are paid separately.</p>}
    <section><h3 className="font-bold text-slate-800">Employee deductions</h3><dl className="mt-2 divide-y divide-slate-100">
      {([['SSS employee share', employee.sss], ['PhilHealth employee share', employee.philHealth], ['Pag-IBIG employee share', employee.pagIbig], ['BIR withholding tax', employee.bir], ['Late', employee.late], ['Absence', employee.absence], ['Undertime', employee.undertime], ['Union dues', employee.unionDues]] as const).map(([label, amount]) => <div key={label} className="flex justify-between gap-3 py-2"><dt>{label}</dt><dd className="shrink-0 tabular-nums"><RecordedAmount value={amount} currency={currency} /></dd></div>)}
      {employee.otherNetDeductions.map((item, index) => <div key={`${item.id}-${index}`} className="flex justify-between gap-3 py-2"><dt>Other deduction · {item.id}</dt><dd className="shrink-0 tabular-nums"><RecordedAmount value={item.amount} currency={currency} /></dd></div>)}
    </dl></section>
    <p className="flex justify-between gap-3"><span>Taxable compensation</span><span className="tabular-nums"><RecordedAmount value={breakdown.taxableCompensation} currency={currency} /></span></p>
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3"><h3 className="font-bold text-slate-800">Employer contributions — paid by the employer</h3><p className="mt-1 text-slate-500">These amounts are excluded from employee deductions and net-pay deductions.</p><dl className="mt-2 divide-y divide-slate-200">{breakdown.employer.map(item => <div key={item.agency} className="py-2"><div className="flex justify-between gap-3"><dt>{item.agency === 'PHILHEALTH' ? 'PhilHealth' : item.agency === 'PAGIBIG' ? 'Pag-IBIG' : 'SSS'} counterpart</dt><dd className="tabular-nums"><RecordedAmount value={item.counterpart} currency={currency} /></dd></div><div className="mt-1 flex justify-between gap-3 text-slate-600"><dt>{item.agency === 'SSS' ? 'Employer-only EC' : 'Employer-only charges'}</dt><dd className="tabular-nums"><RecordedAmount value={item.employerOnly} currency={currency} /></dd></div></div>)}</dl></section>
  </div>;
}
