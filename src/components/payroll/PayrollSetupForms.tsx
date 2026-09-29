'use client';

import { useActionState, useState } from 'react';
import { createCompensationAction, createPayrollPeriodAction, createPayrollPolicyAction, finalizePayrollAction, generatePayrollAction, movePayrollToReviewAction, type PayrollActionState } from '@/features/payroll/actions';

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

export function PayrollGenerationForm({ periods, selectedPeriodId, disabled = false }: { periods: Array<{ id: string; name: string }>; selectedPeriodId?: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(generatePayrollAction, initialState);
  return <form action={action} className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
    <div className="md:col-span-2"><StatusMessage state={state} /></div>
    {state.setupErrors?.length ? <div role="alert" className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
      <p className="font-bold">Setup required for {state.setupErrors.length} {state.setupErrors.length === 1 ? 'employee' : 'employees'}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">{state.setupErrors.map(item => <li key={`${item.employeeNumber}-${item.message}`}><span className="font-semibold">{item.employeeNumber} · {item.employeeName}:</span> {item.message}</li>)}</ul>
    </div> : null}
    <label className="grid gap-1 text-xs font-semibold">Payroll period<select name="payrollPeriodId" required defaultValue={selectedPeriodId} className="rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="">Select a period</option>{periods.map(period => <option key={period.id} value={period.id}>{period.name}</option>)}</select></label>
    <button disabled={pending || periods.length === 0 || disabled} className="self-end rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{pending ? 'Generating…' : 'Generate / Recalculate Payroll'}</button>
  </form>;
}

export function PayrollReviewControls({ periodId, periodLabel, status, canFinalize }: { periodId: string; periodLabel: string; status: string; canFinalize: boolean }) {
  const [reviewState, reviewAction, reviewPending] = useActionState(movePayrollToReviewAction, initialState);
  const [finalizeState, finalizeAction, finalizePending] = useActionState(finalizePayrollAction, initialState);
  if (status === 'FINALIZED') return null;
  return <div className="mt-4 grid gap-3 lg:grid-cols-2">
    {status === 'DRAFT' ? <form action={reviewAction} className="rounded-2xl border bg-slate-50 p-4"><StatusMessage state={reviewState} /><input type="hidden" name="payrollPeriodId" value={periodId} /><p className="mb-3 text-xs text-slate-600">Move generated entries into controlled HR review.</p><button disabled={reviewPending} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{reviewPending ? 'Moving…' : 'Move to Review'}</button></form> : null}
    {status === 'REVIEW' ? <form action={finalizeAction} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><StatusMessage state={finalizeState} /><input type="hidden" name="payrollPeriodId" value={periodId} /><p className="text-sm font-bold">Finalize {periodLabel} payroll?</p><p className="mt-1 text-xs text-amber-900">Entries will be locked. Future policy or compensation changes will not alter this official payroll record.</p><label className="mt-3 flex items-start gap-2 text-xs font-semibold"><input type="checkbox" name="confirmation" value="FINALIZE" required className="mt-0.5" /> I understand and explicitly confirm finalization.</label><button disabled={finalizePending || !canFinalize} className="mt-3 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{finalizePending ? 'Finalizing…' : 'Finalize Payroll'}</button>{!canFinalize ? <p className="mt-2 text-xs font-semibold text-red-700">Resolve every setup and calculation issue before finalization.</p> : null}</form> : null}
  </div>;
}

export function PayrollPolicyForm({ leaveTypes }: { leaveTypes: Array<{ id: string; code: string; name: string; isPaid: boolean }> }) {
  const [state, action, pending] = useActionState(createPayrollPolicyAction, initialState);
  const [lateRule, setLateRule] = useState('NONE');
  const [absenceRule, setAbsenceRule] = useState('NONE');
  const [undertimeRule, setUndertimeRule] = useState('NONE');
  const selectClass = 'rounded-xl border bg-white px-3 py-2.5 font-normal';
  return <form action={action} className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-3">
    <div className="md:col-span-2 xl:col-span-3"><StatusMessage state={state} /></div>
    <label className="grid gap-1 text-xs font-semibold">Effective from<input name="effectiveFrom" type="date" required className={selectClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Effective to (optional)<input name="effectiveTo" type="date" className={selectClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Daily pay basis<select name="dailyPayBasis" className={selectClass}><option value="SCHEDULED_PAYABLE_DAYS">Scheduled payable days</option><option value="ACTUAL_PRESENT_DAYS">Actual present days</option><option value="PRESENT_PLUS_PAID_LEAVE">Present plus paid leave</option></select></label>
    <label className="grid gap-1 text-xs font-semibold">Late deduction<select name="lateDeductionRule" value={lateRule} onChange={event => setLateRule(event.target.value)} className={selectClass}><option value="NONE">None</option><option value="PER_MINUTE">Per minute</option><option value="FIXED_PER_OCCURRENCE">Fixed per occurrence</option></select></label>
    <label className="grid gap-1 text-xs font-semibold">Late parameter<input name="lateDeductionParameter" type="number" min="0.0001" step="0.0001" required={lateRule !== 'NONE'} disabled={lateRule === 'NONE'} className={selectClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Absence deduction<select name="absenceDeductionRule" value={absenceRule} onChange={event => setAbsenceRule(event.target.value)} className={selectClass}><option value="NONE">None</option><option value="DAILY_RATE_PER_ABSENT_DAY">Daily rate per absent day</option><option value="FIXED_PER_ABSENCE">Fixed per absence</option></select></label>
    <label className="grid gap-1 text-xs font-semibold">Absence parameter<input name="absenceDeductionParameter" type="number" min="0.0001" step="0.0001" required={absenceRule === 'FIXED_PER_ABSENCE'} disabled={absenceRule !== 'FIXED_PER_ABSENCE'} className={selectClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Undertime deduction<select name="undertimeDeductionRule" value={undertimeRule} onChange={event => setUndertimeRule(event.target.value)} className={selectClass}><option value="NONE">None</option><option value="PER_MINUTE">Per minute</option><option value="FIXED_PER_OCCURRENCE">Fixed per occurrence</option></select></label>
    <label className="grid gap-1 text-xs font-semibold">Undertime parameter<input name="undertimeDeductionParameter" type="number" min="0.0001" step="0.0001" required={undertimeRule !== 'NONE'} disabled={undertimeRule === 'NONE'} className={selectClass} /></label>
    <label className="grid gap-1 text-xs font-semibold">Rounding<select name="roundingRule" className={selectClass}><option value="STANDARD_2_DECIMAL">Standard 2 decimal</option></select></label>
    {leaveTypes.length ? <fieldset className="grid gap-3 rounded-xl border bg-white p-3 md:col-span-2 xl:col-span-3"><legend className="px-1 text-xs font-bold">Leave payroll treatment</legend><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{leaveTypes.map(type => <label key={type.id} className="grid gap-1 text-xs font-semibold">{type.name} <span className="font-normal text-slate-500">({type.code})</span><select name={`leaveTreatment:${type.id}`} defaultValue={type.code.toUpperCase() === 'STUDY' ? 'UNPAID' : type.isPaid ? 'PAID' : 'UNPAID'} className={selectClass} disabled={type.code.toUpperCase() === 'STUDY'}><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option><option value="NO_PAYROLL_EFFECT">No payroll effect</option></select>{type.code.toUpperCase() === 'STUDY' ? <input type="hidden" name={`leaveTreatment:${type.id}`} value="UNPAID" /> : null}</label>)}</div></fieldset> : null}
    <button disabled={pending} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white md:col-span-2 xl:col-span-3">{pending ? 'Creating version…' : 'Create Policy Version'}</button>
  </form>;
}
