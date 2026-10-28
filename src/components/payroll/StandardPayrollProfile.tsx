'use client';

import { useActionState, useState } from 'react';
import type { PayrollStatutorySetupRow } from '@/features/payroll/setup-queries';
import { saveStandardPayrollProfileAction } from '@/features/payroll/actions';
import { StatusMessage } from './PayrollSetupForms';

function Profile({ row, periodId }: { row: PayrollStatutorySetupRow; periodId: string }) {
  const [state, action, pending] = useActionState(saveStandardPayrollProfileAction, {});
  const [basicOnly, setBasicOnly] = useState(false);
  return <form action={action} aria-busy={pending} className="space-y-4 rounded-xl border bg-slate-50 p-4">
    <input type="hidden" name="employeeId" value={row.id} /><input type="hidden" name="payrollPeriodId" value={periodId} />
    <input type="hidden" name="compensationId" value={row.compensation?.id ?? ''} /><input type="hidden" name="expectedBaseRate" value={row.compensation?.baseRate ?? ''} />
    <p className="text-sm">Full monthly salary: <strong>PHP {row.compensation?.baseRate}</strong>. WorkPulse calculates the cutoff pay and government deductions.</p>
    <fieldset disabled={pending} className="space-y-3 text-xs leading-relaxed">
      <legend className="mb-3 font-bold">Review employee coverage and classification</legend>
      <label className="flex items-start gap-2"><input type="checkbox" name="confirmed" value="basicOnly" checked={basicOnly} onChange={event => setBasicOnly(event.target.checked)} required className="mt-1" /><span>I verified this is a full-month, basic-salary-only employee. Basic salary is the entire SSS remuneration and Pag-IBIG Fund Salary. There are no additional cash earnings, allowances, union dues, loans or other net deductions this period.</span></label>
      {basicOnly && <p className="rounded-lg border bg-white p-3">Review derived monthly bases: SSS remuneration PHP {row.compensation?.baseRate}; PhilHealth basic PHP {row.compensation?.baseRate}; Pag-IBIG Fund Salary PHP {row.compensation?.baseRate}. Different remuneration requires Advanced Payroll Setup.</p>}
      <label className="flex items-start gap-2"><input type="checkbox" name="confirmed" value="coverage" required className="mt-1" /><span>I verified mandatory employee coverage for SSS, PhilHealth and Pag-IBIG. There are no coverage exemptions.</span></label>
      <label className="flex items-start gap-2"><input type="checkbox" name="confirmed" value="taxProfile" required className="mt-1" /><span>I verified a resident citizen or resident alien, private rank-and-file, single-employer employee who is not minimum-wage exempt; no previous employer this tax year, cumulative method, annualization or final payment applies.</span></label>
      <label className="flex items-start gap-2"><input type="checkbox" name="confirmed" value="contributionHistory" required className="mt-1" /><span>I verified there are no untracked contributions for this contribution month. Any earlier cutoff is in the WorkPulse ledger.</span></label>
      <label className="grid gap-1 font-semibold">Attendance deduction treatment<select name="deductionTreatment" required defaultValue="" className="wp-input"><option value="">Select the verified treatment</option><option value="SALARY_REDUCTION">Salary not earned (reduces taxable compensation)</option><option value="NET_DEDUCTION">Net deduction (does not reduce taxable compensation)</option></select></label>
      <label className="grid gap-1 font-semibold">Supporting evidence or review reference<input name="evidenceReference" required className="wp-input" placeholder="Verified employment and coverage records" /></label>
      <p className="text-slate-600">Opening tax and benefit history is recorded separately in Advanced Payroll Setup. Historical balances are never assumed to be zero.</p>
      <StatusMessage state={state} /><button disabled={pending} className="wp-button-primary">{pending ? 'Saving...' : 'Save standard payroll profile'}</button>
    </fieldset>
  </form>;
}

export function StandardPayrollProfile({ rows, periodId }: { rows: PayrollStatutorySetupRow[]; periodId: string }) {
  const eligible = rows.filter(row => !row.input && !row.reusable && !row.inputLocked && row.compensation?.compensationType === 'MONTHLY' && row.compensation.currency === 'PHP' && ['MONTHLY', 'SEMI_MONTHLY'].includes(row.compensation.payFrequency));
  const [employeeId, setEmployeeId] = useState(eligible[0]?.id ?? '');
  const row = eligible.find(item => item.id === employeeId) ?? eligible[0];
  if (!eligible.length) return null;
  return <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-base font-bold">Review government coverage</h2><p className="text-sm text-slate-600">For standard basic-only employees, review plain-language statements once instead of completing the technical statutory form. Any exception belongs in Advanced Payroll Setup.</p><label className="grid gap-1 text-xs font-semibold">Employee<select value={row?.id ?? ''} onChange={event => setEmployeeId(event.target.value)} className="wp-input">{eligible.map(item => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select></label>{row && <Profile key={row.id + ':' + row.compensation?.id + ':' + row.compensation?.baseRate} row={row} periodId={periodId} />}</section>;
}
