'use client';

import { useActionState } from 'react';
import { reusePayrollSetupAction } from '@/features/payroll/actions';
import type { PayrollStatutorySetupRow } from '@/features/payroll/setup-queries';
import { StatusMessage } from './PayrollSetupForms';

function ReuseEmployee({ row, periodId }: { row: PayrollStatutorySetupRow; periodId: string }) {
  const [state, action, pending] = useActionState(reusePayrollSetupAction, {});
  const source = row.reusable;
  if (!source) return null;
  const p = source.payload;
  return <form action={action} className="space-y-3 rounded-xl border bg-white p-4" aria-busy={pending}>
    <h3 className="text-sm font-bold">{row.firstName} {row.lastName}</h3>
    <p className="text-xs text-slate-600">Verified in {source.periodName}. Same salary record and payment year.</p>
    <dl className="grid gap-2 text-xs sm:grid-cols-3">{[['SSS remuneration', p.monthlySssRemuneration], ['PhilHealth monthly basic', p.monthlyPhilHealthBasic], ['Pag-IBIG Fund Salary', p.monthlyPagIbigFundSalary]].map(([label, value]) => <div key={label}><dt className="text-slate-600">{label}</dt><dd className="font-semibold">PHP {value}</dd></div>)}</dl>
    <p className="text-xs">Coverage: SSS {p.coverage.SSS.status.toLowerCase()}, PhilHealth {p.coverage.PHILHEALTH.status.toLowerCase()}, Pag-IBIG {p.coverage.PAGIBIG.status.toLowerCase()}. Tax: resident, private rank-and-file, single employer, not minimum-wage exempt; no previous employer, cumulative method, annualization or final payment.</p>
    <p className="text-xs">Additional earnings: {p.additionalEarnings.map(e => `${e.kind.replaceAll('_', ' ')} PHP ${e.amount}`).join('; ') || 'None recorded'}. Other net deductions: {p.otherNetDeductions.map(d => `${d.id} PHP ${d.amount}`).join('; ') || 'None recorded'}. Union dues: PHP {p.unionDues.amount}.</p>
    <p className="text-xs">Attendance treatment: {Object.entries(p.companyDeductionTreatment).map(([key, value]) => `${key}: ${value.replaceAll('_', ' ').toLowerCase()}`).join('; ')}.</p>
    <input type="hidden" name="employeeId" value={row.id} /><input type="hidden" name="payrollPeriodId" value={periodId} /><input type="hidden" name="sourceId" value={source.sourceId} />
    <label className="flex items-start gap-2 text-xs leading-relaxed"><input type="checkbox" name="confirmed" value="CONFIRMED" required className="mt-1" />I verified these bases, coverage, tax classification, deduction treatments and all amounts remain correct for this period. Earnings and deductions are complete, and there are no untracked contributions this month. Use Advanced Payroll Setup for any change.</label>
    <StatusMessage state={state} /><button disabled={pending} className="wp-button-primary">{pending ? 'Saving…' : 'Use verified setup for this period'}</button>
  </form>;
}

export function PayrollReuseSetup({ rows, periodId }: { rows: PayrollStatutorySetupRow[]; periodId: string }) {
  const reusable = rows.filter(row => row.reusable && !row.input);
  const reused = rows.filter(row => row.input && row.inputEvidence.startsWith('Reconfirmed from '));
  if (!reusable.length && !reused.length) return null;
  return <section className="space-y-3"><h2 className="text-base font-bold">Review saved employee setup</h2><p className="text-sm text-slate-600">Confirm unchanged information without re-entering technical fields. Verified opening history is reused separately through the ledger.</p>{reused.length > 0 && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Verified setup reused for this period. {reused.map(row => `${row.firstName} ${row.lastName}`).join(', ')}: review readiness, then generate payroll.</p>}{reusable.map(row => <ReuseEmployee key={row.id} row={row} periodId={periodId} />)}</section>;
}
