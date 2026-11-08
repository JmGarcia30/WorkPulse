'use client';

import { useActionState } from 'react';
import { configureSubscriptionPlanAction, grantSagaComplimentaryProAction } from './actions';

type Plan = {
  tier: 'BASIC'|'PRO'; name: string; description: string; monthlyPriceMinor: number|null;
  yearlyPriceMinor: number|null; maxEmployees: number|null; active: boolean;
  aiResumeParsing: boolean; advancedAnalytics: boolean; gmailIntegration: boolean; customBranding: boolean;
};
const pesoInput = (minor: number | null) => minor === null ? '0' : (minor / 100).toFixed(2);
export function SubscriptionPlanEditor({ plan }: { plan: Plan }) {
  const [state, act, pending] = useActionState(configureSubscriptionPlanAction, {});
  return <section className="platform-card p-5">
    <h2 className="platform-card-title">{plan.name} plan</h2>
    <p className="platform-card-description mt-1">{plan.description}</p>
    <form action={act} className="mt-5 space-y-4">
      <input type="hidden" name="tier" value={plan.tier}/>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="wp-label">Monthly price (PHP)
          <input className="wp-input mt-2" name="monthly" inputMode="decimal" defaultValue={pesoInput(plan.monthlyPriceMinor)} required/>
        </label>
        <label className="wp-label">Yearly price (PHP)
          <input className="wp-input mt-2" name="yearly" inputMode="decimal" defaultValue={pesoInput(plan.yearlyPriceMinor)} required/>
        </label>
      </div>
      <p className="text-xs text-[#71808b]">Employee limits are not enforced in this release and will be configured after the approved plan rules are finalized.</p>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Included Pro-level capabilities</legend>
        {([['aiResumeParsing','AI resume parsing'],['advancedAnalytics','Advanced analytics'],['gmailIntegration','Gmail integration'],['customBranding','Custom branding']] as const).map(([field,label]) =>
          <label className="flex items-center gap-2 text-sm" key={field}><input type="checkbox" name={field} value="yes" defaultChecked={plan[field]}/>{label}</label>)}
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="active" value="yes" defaultChecked={plan.active}/>
        <span>Make plan available for purchases after pricing is approved. This does not enable a payment provider.</span>
      </label>
      {state.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700" role="status">{state.success}</p>}
      <button type="submit" className="wp-button-primary" disabled={pending}>{pending ? 'Saving...' : 'Save plan'}</button>
    </form>
  </section>;
}
export function ComplimentarySagaForm({ active }: { active: boolean }) {
  const [state, act, pending] = useActionState(grantSagaComplimentaryProAction, {});
  return <form action={act} className="mt-4 space-y-3">
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmation" value="CONFIRM_SAGA_PRO" required/>
      I authorize two years of complimentary Pro access for SAGA with no payment or automatic renewal.
    </label>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}
    <button type="submit" disabled={active || pending} className="wp-button-primary">
      {active ? 'Complimentary Pro already active' : pending ? 'Recording...' : 'Grant SAGA Pro for 2 years'}
    </button>
  </form>;
}
