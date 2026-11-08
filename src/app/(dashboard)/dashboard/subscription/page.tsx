import { Role } from '@prisma/client';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { requestWorkspacePath } from '@/lib/tenant/server';
import { isCurrentEntitlement } from '@/features/subscriptions/entitlements';
import { isXenditBillingConfigured } from '@/features/subscriptions/xendit';
import { beginPaidSubscriptionAction } from '@/features/subscriptions/actions';

function php(minor: number | null) {
  if (minor === null || minor <= 0) return 'To be announced';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(minor / 100);
}

export default async function OrganizationSubscriptionPage() {
  const actor = await requireBackOfficeContext();
  if (actor.role !== Role.ORGANIZATION_ADMIN && actor.role !== Role.HR_ADMIN) notFound();
  const [subscription, plans, orders] = await Promise.all([
    prisma.organizationSubscription.findUnique({ where: { organizationId: actor.organizationId },
      include: { plan: true } }),
    prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } }),
    prisma.subscriptionOrder.findMany({ where: { organizationId: actor.organizationId },
      select: { id: true, planTier: true, amountMinor: true, status: true, createdAt: true,
        interval: true }, take: 10, orderBy: { createdAt: 'desc' } }),
  ]);
  const active = isCurrentEntitlement(subscription);
  const billingReady = isXenditBillingConfigured();
  return <div className="mx-auto max-w-5xl space-y-6">
    <header><p className="wp-eyebrow">SaaS subscription</p>
      <h1 className="wp-page-title mt-2">Your WorkPulse Plan</h1>
      <p className="mt-2 text-sm text-[var(--wp-text-muted)]">Review your organization's current access, compare Basic and Pro, and choose an approved plan.</p>
    </header>
    <section className="wp-card p-5">
      <h2 className="text-lg font-bold">Current subscription</h2>
      <div className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
        <div><p className="text-xs text-[var(--wp-text-muted)]">Plan</p><p className="mt-1 font-bold">{subscription?.planTier ?? 'No plan assigned'}</p></div>
        <div><p className="text-xs text-[var(--wp-text-muted)]">Access</p><p className="mt-1 font-bold">{active ? 'Active' : subscription?.status ?? 'Pending selection'}</p></div>
        <div><p className="text-xs text-[var(--wp-text-muted)]">Expiration</p><p className="mt-1 font-bold">{subscription?.endsAt?.toISOString().slice(0,10) ?? 'Not assigned'}</p></div>
      </div>
      {subscription?.source === 'COMPLIMENTARY' && <p className="mt-4 text-sm">Complimentary access — no payment details required.</p>}
      {subscription?.source === 'LEGACY' && <p className="mt-4 text-sm">Existing organization access is preserved while billing is introduced.</p>}
    </section>
    <div className="grid gap-4 md:grid-cols-2">
      {plans.map(plan => <section key={plan.tier} className="wp-card p-5">
        <h2 className="text-xl font-bold">{plan.name}</h2>
        <p className="mt-2 text-sm text-[var(--wp-text-muted)]">{plan.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-[var(--wp-text-muted)]">Monthly</p><p className="mt-1 font-bold">{php(plan.monthlyPriceMinor)}</p></div>
          <div><p className="text-xs text-[var(--wp-text-muted)]">Yearly</p><p className="mt-1 font-bold">{php(plan.yearlyPriceMinor)}</p></div>
        </div>
        <ul className="mt-5 space-y-2 text-sm">
          <li>Core HR, recruitment, attendance, leave, payroll and ESS</li>
          <li>Employee limit: {plan.maxEmployees ?? 'Not restricted'}</li>
          {plan.aiResumeParsing && <li>AI resume parsing</li>}
          {plan.advancedAnalytics && <li>Advanced analytics</li>}
          {plan.gmailIntegration && <li>Gmail integration</li>}
          {plan.customBranding && <li>Custom branding</li>}
        </ul>
        {plan.active && billingReady && <div className="mt-5 flex gap-2">
          {(['MONTHLY','YEARLY'] as const).map(interval =>
            <form action={beginPaidSubscriptionAction} key={interval}>
              <input type="hidden" name="tier" value={plan.tier}/>
              <input type="hidden" name="interval" value={interval}/>
              <button type="submit" className="wp-button-primary">Choose {interval.toLowerCase()}</button>
            </form>)}
        </div>}
        {(!plan.active || !billingReady) && <p className="mt-5 rounded-lg bg-[#f7f3ef] p-3 text-xs leading-6">
          {!plan.active ? 'This plan is awaiting approved pricing and activation by WorkPulse.' : 'Secure payment checkout will be enabled when the payment provider is connected.'}
        </p>}
      </section>)}
    </div>
    <section className="wp-card p-5">
      <h2 className="text-lg font-bold">Order history</h2>
      <p className="mt-1 text-xs text-[var(--wp-text-muted)]">Only this organization's orders are shown. Payment is verified by the gateway; returning from checkout does not prove payment.</p>
      <div className="mt-4 overflow-x-auto"><table className="wp-table"><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>{orders.map(order => <tr key={order.id}>
          <td>{order.createdAt.toISOString().slice(0,10)}</td><td>{order.planTier} · {order.interval}</td><td>{php(order.amountMinor)}</td><td>{order.status}</td>
        </tr>)}</tbody>
      </table>{orders.length === 0 && <p className="py-5 text-sm text-[var(--wp-text-muted)]">No subscription orders yet.</p>}</div>
    </section>
    <p className="text-xs text-[var(--wp-text-muted)]">Checkout is one paid monthly or annual term. It does not authorize automatic recurring charges. Existing employee and payroll records are retained if a subscription expires.</p>
  </div>;
}
