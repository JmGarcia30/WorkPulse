'use client';

import { useState, useTransition } from 'react';
import type { CompanyProbationPolicy } from '@/features/employees/probation-policy';
import { saveOrganizationProbationPolicy } from '@/features/employees/probation-policy-actions';

export function ProbationPolicySettings({ policy }: { policy: { TEACHING: CompanyProbationPolicy; NON_TEACHING: CompanyProbationPolicy } | null }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  return <form className="space-y-5" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const configuration = Object.fromEntries(['TEACHING', 'NON_TEACHING'].map(category => [category, {
      durationMonths: Number(form.get(`${category}.durationMonths`)),
      maxRenewals: Number(form.get(`${category}.maxRenewals`)), renewalMonths: Number(form.get(`${category}.renewalMonths`)),
      evaluationRequired: form.get(`${category}.evaluationRequired`) === 'on', evaluationCriteria: String(form.get(`${category}.evaluationCriteria`) ?? ''),
    }]));
    startTransition(async () => { const result = await saveOrganizationProbationPolicy(configuration); setMessage('error' in result ? result.error ?? 'Policy could not be saved.' : 'Policy saved for new offers. Existing agreed terms and employee records are unchanged.'); });
  }}>
    <p className="text-sm text-slate-600">Set the standards that will be communicated at engagement. Initial probation plus all permitted renewals must fit within six months. Renewals require written employee consent and HR legal review at the agreed period end. Longer exceptional arrangements require separate legal review and are not configurable here.</p>
    {(['TEACHING', 'NON_TEACHING'] as const).map(category => <fieldset key={category} className="space-y-4 rounded-xl border bg-white p-5">
      <legend className="px-2 font-bold">{category === 'TEACHING' ? 'Teaching roles' : 'Non-Teaching roles'}</legend>
      <div className="grid gap-4 sm:grid-cols-3">{([{ key: 'durationMonths', label: 'Initial duration (months)', min: 1, max: 6, fallback: 6 }, { key: 'maxRenewals', label: 'Permitted renewals', min: 0, max: 2, fallback: 0 }, { key: 'renewalMonths', label: 'Months per renewal', min: 0, max: 5, fallback: 0 }] as const).map(field => <label key={field.key} className="text-sm">{field.label}<input required name={`${category}.${field.key}`} type="number" min={field.min} max={field.max} step="1" defaultValue={policy?.[category][field.key] ?? field.fallback} className="mt-1 block w-full rounded-lg border p-2" /></label>)}</div>
      <label className="block text-sm">Evaluation standards communicated at engagement<textarea name={`${category}.evaluationCriteria`} required minLength={10} maxLength={4000} defaultValue={policy?.[category].evaluationCriteria ?? ''} className="mt-1 min-h-24 w-full rounded-lg border p-2" /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" name={`${category}.evaluationRequired`} defaultChecked={policy?.[category].evaluationRequired ?? true} />Require documented evaluation before every probation decision</label>
    </fieldset>)}
    {message && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
    <button disabled={pending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save probation policy'}</button>
  </form>;
}
