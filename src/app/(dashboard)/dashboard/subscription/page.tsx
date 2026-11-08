import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { effectiveSubscriptionStatus, hasFeature, paidFeatureLabels, type PaidFeature } from '@/features/subscriptions/domain';
import { readOrganizationSubscriptions } from '@/features/subscriptions/service';
import { SubscriptionRequestForm } from '@/features/subscriptions/plan-editor';

const php = (minor: number | null) => minor === null ? 'Not set' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(minor / 100);
export default async function OrganizationSubscriptionPage() {
  const actor = await requireBackOfficeContext();
  if (actor.role !== 'ORGANIZATION_ADMIN' && actor.role !== 'HR_ADMIN') notFound();
  const { subscription, plans, requests, events } = await readOrganizationSubscriptions(prisma, actor.organizationId);
  const pending = requests.some(request => request.status === 'PENDING');
  return <div className="mx-auto max-w-5xl space-y-6">
    <header><p className="wp-eyebrow">SaaS subscription</p><h1 className="wp-page-title mt-2">Your WorkPulse Plan</h1>
      <p className="mt-2 text-sm text-[var(--wp-text-muted)]">Compare plans and request administrator approval. Requests do not change your current access.</p></header>
    <section className="wp-card p-5"><h2 className="text-lg font-bold">Current subscription</h2>
      <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
        <div><dt>Plan</dt><dd className="font-bold">{subscription?.planTier ?? 'No plan assigned'}</dd></div>
        <div><dt>Status</dt><dd className="font-bold">{effectiveSubscriptionStatus(subscription)}</dd></div>
        <div><dt>Expiration</dt><dd className="font-bold">{subscription?.endsAt?.toISOString().slice(0,10) ?? 'No fixed date'}</dd></div>
      </dl>
      {subscription && <p className="mt-3 text-sm">Source: {subscription.source}. {subscription.source === 'MANUAL' || subscription.source === 'COMPLIMENTARY' ? 'Administrator grant; no payment recorded.' : ''}</p>}
      {subscription?.legacyAccess && <p className="mt-3 text-sm">Your existing tenant feature access is preserved during transition.</p>}
      <h3 className="mt-4 font-semibold">Available features</h3><ul className="mt-2 space-y-1 text-sm"><li>Core HR, recruitment, attendance / RFID, leave, payroll and ESS</li>
        {(Object.entries(paidFeatureLabels) as [PaidFeature,string][]).filter(([key]) => hasFeature(subscription, key)).map(([key,label]) => <li key={key}>{label}</li>)}</ul>
    </section>
    {pending && <p role="status" className="wp-card p-4 text-sm">A subscription request is pending administrator review. Your current access stays in effect.</p>}
    <div className="grid gap-4 md:grid-cols-2">{plans.map(plan => <section key={plan.tier} className="wp-card p-5">
      <h2 className="text-xl font-bold">{plan.name}</h2><p className="mt-2 text-sm">{plan.description}</p>
      <p className="mt-4 text-sm">Monthly: {php(plan.monthlyPriceMinor)} / Yearly: {php(plan.yearlyPriceMinor)}</p>
      <p className="mt-2 text-sm">Employee limit: {plan.maxEmployees ?? 'Awaiting definition'} (enforcement pending final rules)</p>
      <ul className="mt-4 space-y-1 text-sm"><li>Core workforce features remain available during transition.</li>
        {(Object.entries(paidFeatureLabels) as [PaidFeature,string][]).filter(([key]) => plan[key]).map(([key,label]) => <li key={key}>{label}</li>)}</ul>
      {!plan.active && <p className="mt-3 text-sm">Requests for this plan are currently paused.</p>}
      <SubscriptionRequestForm tier={plan.tier} disabled={!plan.active || pending}/>
    </section>)}</div>
    <section className="wp-card p-5"><h2 className="text-lg font-bold">Request history</h2>
      <div className="mt-4 overflow-x-auto"><table className="wp-table"><thead><tr><th>Requested</th><th>Plan</th><th>Status</th><th>Approved duration</th><th>Expiration</th><th>Review note</th></tr></thead>
        <tbody>{requests.map(request => <tr key={request.id}><td>{request.createdAt.toISOString().slice(0,10)}</td><td>{request.planTier}</td><td>{request.status}</td>
          <td>{request.durationMonths ? `${request.durationMonths} months` : '-'}</td><td>{request.endsAt?.toISOString().slice(0,10) ?? '-'}</td><td>{request.reviewNote ?? '-'}</td></tr>)}</tbody></table>
        {!requests.length && <p className="py-4 text-sm">No requests yet.</p>}</div></section>
    <section className="wp-card p-5"><h2 className="text-lg font-bold">Subscription history</h2>
      <ul className="mt-3 space-y-2 text-sm">{events.map(event => <li key={event.id}>{event.createdAt.toISOString()} — {event.action.replaceAll('_',' ')}</li>)}</ul>
      {!events.length && <p className="mt-3 text-sm">No events yet.</p>}</section>
    <p className="text-xs text-[var(--wp-text-muted)]">Pricing and final plan definitions are awaiting approval. Requests and grants do not create charges or automatic renewals. Employee and payroll records are retained after expiration.</p>
  </div>;
}
