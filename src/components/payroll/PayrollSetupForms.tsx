'use client';

import { useActionState } from 'react';
import { createCompensationAction, createPayrollPeriodAction, type PayrollActionState } from '@/features/payroll/actions';

const initialState: PayrollActionState = {};

function StatusMessage({ state }: { state: PayrollActionState }) {
  if (!state.error && !state.success) return null;
  return <p role={state.error ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-xs ${state.error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{state.error ?? state.success}</p>;
}

export function CompensationForm({ employees }: { employees: Array<{ id: string; employeeNumber: string; firstName: string; lastName: string }> }) {
  const [state, action, pending] = useActionState(createCompensationAction, initialState);
  return <form action={action} className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-3">
    <div className="md:col-span-2 xl:col-span-3"><StatusMessage state={state} /></div>
    <label className="grid gap-1 text-xs font-semibold">Employee<select name="employeeId" required className="rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="">Select an employee</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.employeeNumber} — {employee.firstName} {employee.lastName}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-semibold">Compensation type<select name="compensationType" className="rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="MONTHLY">Monthly</option><option value="DAILY">Daily</option></select></label>
    <label className="grid gap-1 text-xs font-semibold">Base rate<input name="baseRate" type="number" min="0.01" step="0.01" required className="rounded-xl border bg-white px-3 py-2.5 font-normal" /></label>
    <label className="grid gap-1 text-xs font-semibold">Pay frequency<select name="payFrequency" className="rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="MONTHLY">Monthly</option><option value="BIWEEKLY">Biweekly</option><option value="WEEKLY">Weekly</option><option value="ANNUAL">Annual</option></select></label>
    <label className="grid gap-1 text-xs font-semibold">Currency<input name="currency" defaultValue="PHP" maxLength={3} required className="rounded-xl border bg-white px-3 py-2.5 font-normal uppercase" /></label>
    <label className="grid gap-1 text-xs font-semibold">Effective date<input name="effectiveFrom" type="date" required className="rounded-xl border bg-white px-3 py-2.5 font-normal" /></label>
    <button disabled={pending || employees.length === 0} className="self-end rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Add Compensation'}</button>
  </form>;
}

export function PayrollPeriodForm() {
  const [state, action, pending] = useActionState(createPayrollPeriodAction, initialState);
  return <form action={action} className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
    <div className="md:col-span-2 xl:col-span-4"><StatusMessage state={state} /></div>
    <label className="grid gap-1 text-xs font-semibold">Period name<input name="name" required maxLength={120} placeholder="September 2026" className="rounded-xl border bg-white px-3 py-2.5 font-normal" /></label>
    <label className="grid gap-1 text-xs font-semibold">Period start<input name="periodStart" type="date" required className="rounded-xl border bg-white px-3 py-2.5 font-normal" /></label>
    <label className="grid gap-1 text-xs font-semibold">Period end<input name="periodEnd" type="date" required className="rounded-xl border bg-white px-3 py-2.5 font-normal" /></label>
    <label className="grid gap-1 text-xs font-semibold">Pay date<input name="payDate" type="date" required className="rounded-xl border bg-white px-3 py-2.5 font-normal" /></label>
    <button disabled={pending} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white md:col-span-2 xl:col-span-4">{pending ? 'Saving…' : 'Create Payroll Period'}</button>
  </form>;
}
