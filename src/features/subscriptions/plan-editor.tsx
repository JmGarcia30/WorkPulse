'use client';

import { useActionState } from 'react';
import { configureSubscriptionPlanAction, grantSagaComplimentaryProAction, requestSubscriptionAction, reviewSubscriptionRequestAction, activateSubscriptionAction, expireSubscriptionAction } from './actions';

type Plan = {
  tier: 'BASIC'|'PRO'; name: string; description: string; monthlyPriceMinor: number|null;
  yearlyPriceMinor: number|null; maxEmployees: number|null; active: boolean;
  aiResumeParsing: boolean; advancedAnalytics: boolean; gmailIntegration: boolean; customBranding: boolean;
};
function Feedback({ state }: { state: { error?: string; success?: string } }) {
  return <>{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}</>;
}
const pesoInput = (minor: number | null) => minor === null ? '' : (minor / 100).toFixed(2);
export function SubscriptionPlanEditor({ plan }: { plan: Plan }) {
  const [state, act, pending] = useActionState(configureSubscriptionPlanAction, {});
  return <section className="platform-card p-5">
    <h2 className="platform-card-title">{plan.name} plan</h2>
    <form action={act} className="mt-5 space-y-4">
      <input type="hidden" name="tier" value={plan.tier}/>
      <label className="wp-label block">Approved description<textarea className="wp-input mt-2" name="description" value={plan.description} readOnly/></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="wp-label">Monthly price (PHP)<input className="wp-input mt-2" name="monthly" inputMode="decimal" defaultValue={pesoInput(plan.monthlyPriceMinor)} placeholder="Not set"/></label>
        <label className="wp-label">Yearly price (PHP)<input className="wp-input mt-2" name="yearly" inputMode="decimal" defaultValue={pesoInput(plan.yearlyPriceMinor)} placeholder="Not set"/></label>
      </div>
      <p className="text-sm">No employee limits. Active job postings: {plan.tier === 'BASIC' ? '5' : 'Unlimited'}.</p>
      <p className="text-xs text-slate-500">Leave prices blank until decided. Both plans include core HR, payroll, attendance, leave, ESS, exit management, manual recruitment, standard reports and Gmail.</p>
      <fieldset className="space-y-3"><legend className="text-sm font-semibold">Approved plan features</legend>
        {([['aiResumeParsing','AI resume parsing'],['advancedAnalytics','Advanced analytics'],['gmailIntegration','Gmail integration'],['customBranding','Custom branding']] as const).map(([field,label]) =>
          <label className="flex items-center gap-2 text-sm" key={field}><input type="checkbox" name={field} value="yes" checked={plan[field]} disabled readOnly/>{label}</label>)}
      </fieldset>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="active" value="yes" defaultChecked={plan.active}/>Accept requests for this plan</label>
      <p className="text-xs text-slate-500">Approved feature inclusions are enforced on the server. Legacy tenant access is preserved. Pro includes the existing analytics PDF report/export.</p>
      <Feedback state={state}/><button type="submit" className="wp-button-primary" disabled={pending}>{pending ? 'Saving...' : 'Save plan'}</button>
    </form>
  </section>;
}
export function SubscriptionRequestForm({ tier, disabled }: { tier: 'BASIC'|'PRO'; disabled: boolean }) {
  const [state, action, pending] = useActionState(requestSubscriptionAction, {});
  return <form action={action} className="mt-5 space-y-3"><input type="hidden" name="tier" value={tier}/>
    <Feedback state={state}/><button type="submit" className="wp-button-primary" disabled={disabled || pending}>{pending ? 'Submitting...' : `Request ${tier === 'PRO' ? 'Pro' : 'Basic'}`}</button>
  </form>;
}
export function ReviewSubscriptionForm({ organizationId, requestId }: { organizationId: string; requestId: string }) {
  const [state, action, pending] = useActionState(reviewSubscriptionRequestAction, {});
  return <form action={action} className="mt-3 grid gap-3">
    <input type="hidden" name="organizationId" value={organizationId}/><input type="hidden" name="requestId" value={requestId}/>
    <label className="wp-label">Decision<select className="wp-input mt-1" name="decision" defaultValue="" required><option value="" disabled>Select a decision</option><option value="APPROVED">Approve and activate</option><option value="REJECTED">Reject</option></select></label>
    <label className="wp-label">Duration in months (required for approval)<input className="wp-input mt-1" type="number" min="1" max="120" name="durationMonths" placeholder="Select 1 to 120 months"/></label>
    <label className="wp-label">Reason / review note (required for rejection)<textarea className="wp-input mt-1" name="reviewNote" maxLength={1000}/></label>
    <p className="text-xs text-slate-500">Approval activates the requested plan now. Same-plan terms extend from their current expiration; a plan change replaces the current term. Approval records no payment.</p>
    <Feedback state={state}/><button className="wp-button-primary" disabled={pending}>{pending ? 'Saving...' : 'Record decision'}</button>
  </form>;
}
export function ActivateSubscriptionForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(activateSubscriptionAction, {});
  return <form action={action} className="mt-3 space-y-3"><input type="hidden" name="organizationId" value={organizationId}/>
    <label className="wp-label block">Plan<select className="wp-input mt-1" name="tier" defaultValue="" required><option value="" disabled>Select plan</option><option value="BASIC">Basic</option><option value="PRO">Pro</option></select></label>
    <label className="wp-label block">Duration in months<input className="wp-input mt-1" type="number" name="durationMonths" min="1" max="120" required/></label>
    <label className="wp-label block">Grant reason<textarea className="wp-input mt-1" name="reviewNote" maxLength={1000} required/></label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmation" value="CONFIRM_TERM" required/>I authorize this term. Same-plan terms extend the existing expiration; changing plans replaces the current term. No payment is recorded.</label>
    <Feedback state={state}/><button className="wp-button-primary" disabled={pending}>{pending ? 'Saving...' : 'Activate / extend term'}</button>
  </form>;
}
export function ExpireSubscriptionForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(expireSubscriptionAction, {});
  return <form action={action} className="mt-3 space-y-2"><input type="hidden" name="organizationId" value={organizationId}/><Feedback state={state}/>
    <button className="platform-soft-link" disabled={pending}>{pending ? 'Checking...' : 'Record elapsed expiration'}</button></form>;
}
export function ComplimentarySagaForm({ active, organizationId }: { active: boolean; organizationId: string }) {
  const [state, act, pending] = useActionState(grantSagaComplimentaryProAction, {});
  return <form action={act} className="mt-4 space-y-3"><input type="hidden" name="organizationId" value={organizationId}/>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmation" value="CONFIRM_SAGA_PRO" required/>
      I authorize two years of complimentary Pro access for SAGA with no payment or automatic renewal.
    </label><Feedback state={state}/>
    <button type="submit" disabled={active || pending} className="wp-button-primary">{active ? 'Complimentary Pro already active' : pending ? 'Recording...' : 'Grant SAGA Pro for 2 years'}</button>
  </form>;
}
