'use client';

import { useState, useTransition } from 'react';
import { grantCycleEntitlementsAction } from '@/features/leave/hr-actions';

interface BalanceType { id: string; name: string; balanceTracked: boolean; defaultGrantUnits: number | null; requiresEligibilityVerification: boolean; cycles: Array<{ id: string; name: string }> }
interface BalanceEmployee { id: string; employeeNumber: string; firstName: string; lastName: string }

const friendlyOutcome = (status?: string) => status === 'GRANTED'
  ? 'Entitlement granted successfully.'
  : status === 'SKIPPED_DUPLICATE'
    ? 'This employee already has this entitlement for the selected leave cycle.'
    : 'The entitlement could not be granted.';

export function LeaveBalancesPanel({ types, employees }: { types: BalanceType[]; employees: BalanceEmployee[] }) {
  const [typeId, setTypeId] = useState(types.find((item) => item.balanceTracked)?.id ?? '');
  const [message, setMessage] = useState<string | null | undefined>(null);
  const [pending, startTransition] = useTransition();
  const type = types.find((item) => item.id === typeId);
  return <section className="rounded-3xl border bg-white p-6"><h2 className="font-bold">Advanced Entitlement Grant</h2><p className="mt-1 text-sm text-slate-500">Use for exceptional or administrative balance setup. Normal Sick/Personal and verified Solo Parent workflows initialize defaults automatically.</p>{message && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}<form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (!type) return; if (!window.confirm('Confirm HR verified this entitlement grant.')) return; startTransition(async () => { const result = await grantCycleEntitlementsAction({ leaveTypeId: type.id, leaveCycleId: String(form.get('cycle')), employeeIds: [String(form.get('employee'))], reason: String(form.get('reason')), confirmed: true, eligibilityConfirmed: true }); setMessage('error' in result ? result.error : friendlyOutcome(result.outcomes[0]?.status)); }); }}><label className="text-sm">Leave Type<select name="type" value={typeId} onChange={(event) => setTypeId(event.target.value)} className="mt-1 w-full rounded-xl border p-3">{types.filter((item) => item.balanceTracked).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.defaultGrantUnits ?? 'not configured'})</option>)}</select></label><label className="text-sm">Cycle<select name="cycle" required className="mt-1 w-full rounded-xl border p-3">{type?.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></label><label className="text-sm">Employee<select name="employee" required className="mt-1 w-full rounded-xl border p-3">{employees.map((item) => <option key={item.id} value={item.id}>{item.employeeNumber} · {item.firstName} {item.lastName}</option>)}</select></label><label className="text-sm">Reason<input name="reason" required className="mt-1 w-full rounded-xl border p-3" /></label><button disabled={pending} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white md:col-span-2">{pending ? 'Granting…' : 'Grant Entitlement'}</button></form></section>;
}
