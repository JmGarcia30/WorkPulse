'use client';

import { useActionState, useState } from 'react';
import { changePayrollEarningAction } from '@/features/payroll/actions';
import type { StatutoryPayrollInput } from '@/features/payroll/statutory-inputs';

export type EarningsEmployee = { id: string; name: string; version: string; input: StatutoryPayrollInput; hasEntry: boolean };
const fieldClass = 'rounded-lg border bg-white px-3 py-2 text-sm';
const categories = [['OVERTIME', 'Overtime Pay'], ['BONUS', 'Bonus / Incentive'], ['COMMISSION', 'Commission'], ['ALLOWANCE', 'Fixed Allowance'], ['THIRTEENTH_MONTH', '13th Month Pay'], ['OTHER', 'Other — Specify']];
const classifications = [['OVERTIME', 'Taxable overtime'], ['TAXABLE_BONUS', 'Taxable bonus (reviewed)'], ['QUALIFYING_OTHER_BENEFIT', 'Qualifying other benefit (annual shared limit)'], ['COMMISSION', 'Taxable commission'], ['FIXED_ALLOWANCE', 'Taxable fixed allowance'], ['THIRTEENTH_MONTH', '13th month benefit (annual shared limit)'], ['RICE_SUBSIDY', 'Qualified rice subsidy'], ['CLOTHING_ALLOWANCE', 'Qualified clothing allowance'], ['LAUNDRY_ALLOWANCE', 'Qualified laundry allowance']];

function EarningEditor({ employee, periodId, row }: { employee: EarningsEmployee; periodId: string; row?: StatutoryPayrollInput['additionalEarnings'][number] }) {
  const [state, action, pending] = useActionState(changePayrollEarningAction, {});
  const [id] = useState(() => row?.id ?? `custom-${employee.version}`);
  return <form action={action} className="grid gap-3 rounded-xl border bg-[#FAF8F6] p-4 sm:grid-cols-2" aria-busy={pending}>
    <input type="hidden" name="employeeId" value={employee.id} /><input type="hidden" name="payrollPeriodId" value={periodId} /><input type="hidden" name="expectedVersion" value={employee.version} /><input type="hidden" name="earningId" value={id} />
    <div className="sm:col-span-2" aria-live="polite">{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-sm text-emerald-800">{state.success}</p>}</div>
    <label className="grid gap-1 text-xs font-semibold">Earning type<select name="category" defaultValue={row?.category ?? 'OTHER'} required className={fieldClass}>{categories.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-semibold">Description<input name="description" defaultValue={row?.description ?? ''} required maxLength={200} className={fieldClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Amount in PHP<input name="amount" type="number" min="0.01" max="9999999999.99" step="0.01" defaultValue={row?.amount} required className={fieldClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Unique supporting payment reference<input name="supportingReference" defaultValue={row?.supportingReference} required maxLength={300} className={fieldClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Approved payroll classification<select name="kind" required defaultValue={row?.kind ?? ''} className={fieldClass}><option value="">Select verified classification</option>{classifications.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-semibold">Classification approval / qualification evidence<input name="qualificationReference" defaultValue={row?.qualificationReference} required maxLength={500} className={fieldClass} /></label>
    <p className="text-xs text-slate-600 sm:col-span-2">Reverify monthly contribution bases including these earnings. Benefit exemptions require approved qualification and complete benefit history. Reimbursements require separate review.</p>
    <label className="grid gap-1 text-xs font-semibold">Reviewed monthly SSS remuneration<input name="monthlySssRemuneration" type="number" min="0" step="0.01" required defaultValue={employee.input.monthlySssRemuneration} className={fieldClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Reviewed monthly Pag-IBIG fund salary<input name="monthlyPagIbigFundSalary" type="number" min="0" step="0.01" required defaultValue={employee.input.monthlyPagIbigFundSalary} className={fieldClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Contribution basis review reference<input name="agencyBasisReference" required className={fieldClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Reason for this change<input name="reason" required className={fieldClass} /></label>
    {employee.hasEntry && <label className="flex gap-2 text-xs sm:col-span-2"><input name="confirmRecalculation" type="checkbox" value="CONFIRMED" required />I confirm this employee’s unfinished calculation will be retained in the audit history and must be generated and reviewed again.</label>}
    <div className="flex flex-wrap gap-2 sm:col-span-2"><button name="operation" value="SAVE" disabled={pending || !!state.success} className="wp-button-primary">{pending ? 'Saving…' : row ? 'Save earning changes' : 'Add Earnings'}</button>{row && <button name="operation" value="REMOVE" disabled={pending || !!state.success} className="wp-button-secondary">Remove earning</button>}</div>
  </form>;
}

/** A simplified, conservatively taxable incentive. Other classifications remain in advanced settings. */
export function PayrollIncentiveForm({ employee, periodId }: { employee: EarningsEmployee | null; periodId: string }) {
  const [state, action, pending] = useActionState(changePayrollEarningAction, {});
  const [reference, setReference] = useState('');
  if (!employee) return <div className="rounded-xl bg-[#faf8f6] p-4 text-sm text-[#636471]">
    Verify the employee's statutory setup in Payroll Settings to add approved incentives.
  </div>;
  return <form action={action} aria-busy={pending} className="space-y-3 rounded-xl border border-[#e8e7e6] bg-white p-4">
    <input type="hidden" name="employeeId" value={employee.id}/>
    <input type="hidden" name="payrollPeriodId" value={periodId}/>
    <input type="hidden" name="expectedVersion" value={employee.version}/>
    <input type="hidden" name="earningId" value={`incentive-${employee.version}`}/>
    <input type="hidden" name="category" value="BONUS"/>
    <input type="hidden" name="kind" value="TAXABLE_BONUS"/>
    <input type="hidden" name="qualificationReference" value={reference}/>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-semibold">Incentive description
        <input name="description" placeholder="Performance incentive" className={fieldClass} maxLength={200} required/>
      </label>
      <label className="grid gap-1 text-xs font-semibold">Approved amount (PHP)
        <input name="amount" type="number" min="0.01" max="9999999999.99" step="0.01" className={fieldClass} required/>
      </label>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Unique approval/payment reference
        <input name="supportingReference" value={reference} onChange={event => setReference(event.target.value)} placeholder="Signed approval reference" className={fieldClass} maxLength={300} required/>
      </label>
    </div>
    <details open className="rounded-lg bg-[#faf8f6] p-3">
      <summary className="cursor-pointer text-xs font-semibold">Review statutory contribution bases</summary>
      <p className="mt-2 text-xs text-[#636471]">This incentive uses the taxable bonus classification. Review the employee&apos;s SSS remuneration and Pag-IBIG fund salary including applicable incentive amounts before saving. Do not assume the existing bases remain correct.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold">Reviewed monthly SSS remuneration
          <input name="monthlySssRemuneration" type="number" min="0.01" step="0.01" defaultValue={employee.input.monthlySssRemuneration} required className={fieldClass}/>
        </label>
        <label className="grid gap-1 text-xs font-semibold">Reviewed monthly Pag-IBIG fund salary
          <input name="monthlyPagIbigFundSalary" type="number" min="0.01" step="0.01" defaultValue={employee.input.monthlyPagIbigFundSalary} required className={fieldClass}/>
        </label>
        <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Contribution basis evidence
          <input name="agencyBasisReference" required maxLength={300} className={fieldClass} placeholder="Reference for updated contribution bases"/>
        </label>
      </div>
    </details>
    <label className="grid gap-1 text-xs font-semibold">Change reason
      <input name="reason" required className={fieldClass} placeholder="Approved incentive for this cutoff"/>
    </label>
    {employee.hasEntry && <label className="flex gap-2 text-xs"><input name="confirmRecalculation" type="checkbox" value="CONFIRMED" required/>I understand the previous unfinished draft must be regenerated and reviewed.</label>}
    <button name="operation" value="SAVE" disabled={pending || !!state.success} className="wp-button-primary">
      {pending ? 'Saving incentive…' : 'Add approved incentive'}
    </button>
    <p className="text-xs text-[#636471]">Saving an incentive does not finalize or notify payroll. Regenerate the draft and review the updated deductions first.</p>
  </form>;
}

export function PayrollEarningsForm({ employees, periodId }: { employees: EarningsEmployee[]; periodId: string }) {
  const [selected, select] = useState(employees[0]?.id ?? '');
  const employee = employees.find(row => row.id === selected);
  return <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">Add Additional Earnings</summary>
    {!employees.length ? <p className="mt-3 text-sm">Use Fix Setup to verify employee coverage and history first.</p> : <div className="mt-4 space-y-4">
      <label className="grid gap-1 text-sm">Employee<select className={fieldClass} value={selected} onChange={e => select(e.target.value)}>{employees.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {employee && <div key={`${employee.id}-${employee.version}`} className="space-y-3">
        {employee.input.additionalEarnings.map(row => <details key={row.id} className="rounded-xl border p-3"><summary className="cursor-pointer text-sm">{row.description ?? row.kind.replaceAll('_', ' ')} · PHP {row.amount} · Edit or remove</summary><div className="mt-3"><EarningEditor employee={employee} periodId={periodId} row={row} /></div></details>)}
        <EarningEditor employee={employee} periodId={periodId} />
      </div>}
    </div>}
  </details>;
}

export function PayrollRecalculateForm({ employee, periodId }: { employee: EarningsEmployee; periodId: string }) {
  const [state, action, pending] = useActionState(changePayrollEarningAction, {});
  return <form action={action} className="mt-4 space-y-2 text-xs"><input type="hidden" name="employeeId" value={employee.id} /><input type="hidden" name="payrollPeriodId" value={periodId} /><input type="hidden" name="expectedVersion" value={employee.version} /><input type="hidden" name="operation" value="RECALCULATE" />
    <label className="grid gap-1">Reason for recalculation<input name="reason" required className={fieldClass} /></label><label className="flex gap-2"><input type="checkbox" name="confirmRecalculation" value="CONFIRMED" required />Retain the old draft in audit history and require generation and review again.</label>
    <button disabled={pending || !!state.success} className="wp-button-secondary">Prepare recalculation</button>{state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
  </form>;
}
