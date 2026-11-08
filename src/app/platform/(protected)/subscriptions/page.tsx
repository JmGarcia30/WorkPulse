import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { isCurrentEntitlement } from '@/features/subscriptions/entitlements';
import { SubscriptionPlanEditor, ComplimentarySagaForm } from '@/features/subscriptions/plan-editor';
import { isXenditBillingConfigured } from '@/features/subscriptions/xendit';

export default async function PlatformSubscriptionsPage() {
  await requirePlatformAdministrator();
  const [plans, subscriptions, saga] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } }),
    prisma.organizationSubscription.findMany({
      include: { organization: { select: { name: true, slug: true } } },
      orderBy: { updatedAt: 'desc' }, take: 100,
    }),
    prisma.organization.findUnique({ where: { slug: 'st-aloysius' },
      include: { subscription: true } }),
  ]);
  const sagaActive = !!saga?.subscription && isCurrentEntitlement(saga.subscription) &&
    saga.subscription.source === 'COMPLIMENTARY';
  return <div className="platform-section-gap">
    <div className="platform-page-heading">
      <div><p className="platform-eyebrow">SaaS platform billing</p><h1 className="platform-title">Subscriptions</h1>
        <p className="platform-description">Configure approved Basic and Pro offerings, review tenant entitlements, and manage complimentary pilot access.</p></div>
      <Link className="platform-soft-link" href="/platform">Back to overview</Link>
    </div>
    <p className="platform-muted-box">
      Payment provider: <strong>{isXenditBillingConfigured() ? 'Xendit enabled' : 'Not configured for live billing'}</strong>.
      Plan pricing is not public until an administrator approves and activates it. Paid access requires independent provider verification; payment simulation never activates subscriptions.
    </p>
    <div className="grid gap-5 lg:grid-cols-2">{plans.map(plan =>
      <SubscriptionPlanEditor key={plan.tier} plan={plan}/>)}</div>
    <section className="platform-card p-6">
      <h2 className="platform-card-title">Pilot agreement — SAGA</h2>
      <p className="platform-card-description mt-2">Complimentary Pro for 2 years. No checkout, charge, or automatic renewal.</p>
      <p className="mt-3 text-sm">Current entitlement: {saga?.subscription ? saga.subscription.planTier + ' / ' + saga.subscription.status + ' / ' + saga.subscription.source : 'Not assigned'}</p>
      {saga?.subscription?.endsAt && <p className="mt-1 text-sm">Expires: {saga.subscription.endsAt.toISOString().slice(0,10)}</p>}
      <ComplimentarySagaForm active={sagaActive}/>
    </section>
    <section className="platform-card">
      <div className="platform-card-header"><div><h2 className="platform-card-title">Organization subscriptions</h2><p className="platform-card-description">Current subscription records (most recently updated first)</p></div></div>
      <div className="platform-table-scroll">
        <table className="platform-simple-table"><thead><tr><th>Organization</th><th>Plan</th><th>Status</th><th>Source</th><th>Expiration</th></tr></thead>
          <tbody>{subscriptions.map(subscription => <tr key={subscription.organizationId}>
            <td>{subscription.organization.name}<span className="mt-1 block text-xs text-slate-500">{subscription.organization.slug}</span></td>
            <td>{subscription.planTier}</td><td>{isCurrentEntitlement(subscription) ? 'ACTIVE' : subscription.status === 'ACTIVE' ? 'EXPIRED' : subscription.status}</td>
            <td>{subscription.source}</td>
            <td>{subscription.endsAt?.toISOString().slice(0,10) ?? 'No fixed date'}</td>
          </tr>)}</tbody>
        </table>
        {subscriptions.length === 0 && <p className="platform-empty">No subscriptions assigned yet. Configure plans or grant SAGA complimentary Pro.</p>}
      </div>
    </section>
  </div>;
}
