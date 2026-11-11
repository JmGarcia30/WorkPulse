'use client';

import { useActionState, useId, useState } from 'react';
import { changePayrollEarningAction } from '@/features/payroll/actions';

export function PayrollOvertimeApprovalForm({ employeeId, periodId, expectedVersion, input, hasEntry }: {
  employeeId: string; periodId: string; expectedVersion: string; hasEntry: boolean;
  input: { monthlySssRemuneration: string; monthlyPagIbigFundSalary: string };
}) {
  const [state, action, pending] = useActionState(changePayrollEarningAction, {});
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [hours, setHours] = useState('');
  const [rate, setRate] = useState('');
  const amount = Number(hours) > 0 && Number(rate) > 0 ? (Number(hours) * Number(rate)).toFixed(2) : '';
  return <form action={action} className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
    <input type="hidden" name="operation" value="SAVE"/><input type="hidden" name="employeeId" value={employeeId}/><input type="hidden" name="payrollPeriodId" value={periodId}/><input type="hidden" name="expectedVersion" value={expectedVersion}/><input type="hidden" name="earningId" value={`overtime-${id}`}/><input type="hidden" name="category" value="OVERTIME"/><input type="hidden" name="kind" value="OVERTIME"/><input type="hidden" name="description" value="Approved overtime pay"/><input type="hidden" name="amount" value={amount}/><input type="hidden" name="monthlySssRemuneration" value={input.monthlySssRemuneration}/><input type="hidden" name="monthlyPagIbigFundSalary" value={input.monthlyPagIbigFundSalary}/>
    <p className="text-xs font-semibold sm:col-span-2">Approved overtime pay</p>
    <label className="grid gap-1 text-xs font-semibold">Approved overtime hours<input value={hours} onChange={e=>setHours(e.target.value)} type="number" min="0.01" max="744" step="0.01" required className="rounded-xl border px-3 py-2.5"/></label>
    <label className="grid gap-1 text-xs font-semibold">Approved hourly rate (₱)<input value={rate} onChange={e=>setRate(e.target.value)} type="number" min="0.01" step="0.01" required className="rounded-xl border px-3 py-2.5"/></label>
    <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><span className="text-xs text-slate-500">Calculated overtime earning</span><p className="text-lg font-bold tabular-nums">₱{amount || '0.00'}</p><p className="text-xs text-slate-500">Hours × HR-approved hourly rate. Only approved amounts are included; raw RFID overtime is not automatically paid.</p></div>
    <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Approval / supporting reference<input name="supportingReference" required maxLength={300} placeholder="Approved overtime request / signed authority reference" className="rounded-xl border px-3 py-2.5"/></label>
    <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Approval evidence reference<input name="qualificationReference" required maxLength={500} placeholder="Document or HR approval record" className="rounded-xl border px-3 py-2.5"/></label>
    <label className="grid gap-1 text-xs font-semibold sm:col-span-2">SSS / Pag-IBIG contribution basis review reference<input name="agencyBasisReference" required maxLength={500} placeholder="Reviewed monthly contribution bases including overtime" className="rounded-xl border px-3 py-2.5"/></label>
    <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Reason<input name="reason" required minLength={5} maxLength={500} placeholder="Approved overtime for this payroll cutoff" className="rounded-xl border px-3 py-2.5"/></label>
    {hasEntry && <label className="flex gap-2 text-xs sm:col-span-2"><input type="checkbox" name="confirmRecalculation" value="CONFIRMED" required/>I confirm the unfinished payroll calculation will be retained in the audit history and regenerated for review.</label>}
    <div className="text-xs sm:col-span-2" aria-live="polite">{state.error && <p role="alert" className="text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-emerald-700">{state.success}</p>}</div>
    <button disabled={pending || !amount} className="rounded-xl bg-[#282934] px-4 py-2.5 text-xs font-bold text-white sm:col-span-2">{pending ? 'Saving…' : 'Save Approved Overtime'}</button>
  </form>;
}
