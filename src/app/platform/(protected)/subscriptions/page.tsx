import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { effectiveSubscriptionStatus, isCurrentEntitlement } from '@/features/subscriptions/domain';
import { SubscriptionPlanEditor, ComplimentarySagaForm, ReviewSubscriptionForm, ActivateSubscriptionForm, ExpireSubscriptionForm } from '@/features/subscriptions/plan-editor';

export default async function PlatformSubscriptionsPage({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  await requirePlatformAdministrator();
  const selected = (await searchParams).organizationId;
  const organizationId = typeof selected === 'string' && selected.length <= 200 ? selected : undefined;
  const [plans, organizations, requests, events, saga] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } }),
    prisma.organization.findMany({ where: organizationId ? { id: organizationId } : {}, include: { subscription: true }, orderBy: { name: 'asc' }, take: 100 }),
    prisma.subscriptionRequest.findMany({ where: { ...(organizationId ? { organizationId } : {}), status: 'PENDING' }, include: { organization: { select: { name: true } } }, orderBy: { createdAt: 'asc' }, take: 100 }),
    prisma.subscriptionEvent.findMany({ where: organizationId ? { organizationId } : {}, include: { organization: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.organization.findUnique({ where: { slug: 'st-aloysius' }, include: { subscription: true } }),
  ]);
  const sagaActive = !!saga?.subscription && isCurrentEntitlement(saga.subscription) && saga.subscription.source === 'COMPLIMENTARY';
  return <div className="platform-section-gap">
    <div className="platform-page-heading"><div><p className="platform-eyebrow">SaaS subscriptions</p><h1 className="platform-title">Subscriptions</h1>
      <p className="platform-description">Configure Basic and Pro, review requests, and manage organization subscription terms.</p></div><Link className="platform-soft-link" href="/platform">Back to overview</Link></div>
    <p className="platform-muted-box">Administrator approvals and complimentary grants activate access without recording payment. Final prices, feature inclusions and employee limits can be supplied later.</p>
    <div className="grid gap-5 lg:grid-cols-2">{plans.map(plan => <SubscriptionPlanEditor key={plan.tier} plan={plan}/>)}</div>
    <section className="platform-card p-6"><h2 className="platform-card-title">SAGA complimentary agreement</h2>
      <p className="platform-card-description mt-2">Pro for two calendar years from grant. No payment or automatic renewal.</p>
      {saga ? <><p className="mt-3 text-sm">Current: {saga.subscription?.planTier ?? 'Unassigned'} / {effectiveSubscriptionStatus(saga.subscription)}. Expiration: {saga.subscription?.endsAt?.toISOString().slice(0,10) ?? 'No fixed date'}</p>
        <ComplimentarySagaForm active={sagaActive} organizationId={saga.id}/></> : <p className="mt-3 text-sm">SAGA organization was not found.</p>}</section>
    <section className="platform-card p-5"><h2 className="platform-card-title">Filter organization records</h2>
      <form className="mt-3 flex flex-wrap items-end gap-3"><label className="wp-label">Immutable organization ID<input className="wp-input mt-1" name="organizationId" defaultValue={organizationId ?? ''}/></label><button className="wp-button-primary">Filter</button><Link className="platform-soft-link" href="/platform/subscriptions">Clear filter</Link></form></section>
    <section className="platform-card p-6"><h2 className="platform-card-title">Pending requests</h2>
      <p className="platform-card-description mt-1">Oldest 100 pending requests{organizationId ? ' for the selected organization' : ''}.</p>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">{requests.map(request => <article key={request.id} className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-bold">{request.organization.name} — {request.planTier}</h3><p className="mt-1 text-xs text-slate-500">Requested: {request.createdAt.toISOString()}. Organization ID: {request.organizationId}</p>
        <ReviewSubscriptionForm organizationId={request.organizationId} requestId={request.id}/></article>)}</div>
      {!requests.length && <p className="mt-4 text-sm">No pending requests.</p>}</section>
    <section className="platform-card"><div className="platform-card-header"><div><h2 className="platform-card-title">Organization subscriptions</h2><p className="platform-card-description">Up to 100 organizations. Existing tenant access remains preserved.</p></div></div>
      <div className="platform-table-scroll"><table className="platform-simple-table"><thead><tr><th>Organization / ID</th><th>Plan</th><th>Status</th><th>Source</th><th>Expiration</th><th>Manage</th></tr></thead>
        <tbody>{organizations.map(organization => <tr key={organization.id}><td>{organization.name}<span className="mt-1 block text-xs text-slate-500">{organization.id}</span><Link className="platform-soft-link" href={`/platform/subscriptions?organizationId=${encodeURIComponent(organization.id)}`}>View history</Link></td>
          <td>{organization.subscription?.planTier ?? 'Unassigned'}</td><td>{effectiveSubscriptionStatus(organization.subscription)}{organization.subscription?.legacyAccess && <span className="block text-xs">Legacy access preserved</span>}</td><td>{organization.subscription?.source ?? '-'}</td><td>{organization.subscription?.endsAt?.toISOString().slice(0,10) ?? 'No fixed date'}</td>
          <td><details><summary className="cursor-pointer">Activate / extend term</summary><ActivateSubscriptionForm organizationId={organization.id}/></details><ExpireSubscriptionForm organizationId={organization.id}/></td></tr>)}</tbody></table></div></section>
    <section className="platform-card p-6"><h2 className="platform-card-title">Subscription audit history</h2><p className="platform-card-description mt-1">Latest 100 events. Configuration events are global; grants and requests are tied to immutable organization IDs.</p>
      <ul className="mt-4 space-y-4">{events.map(event => <li key={event.id} className="border-b border-slate-100 pb-3 text-sm"><p className="font-semibold">{event.organization?.name ?? 'Global plan configuration'} — {event.action.replaceAll('_',' ')}</p>
        <p className="mt-1 text-xs text-slate-500">{event.createdAt.toISOString()} / Actor: {event.actorAdministratorId ?? event.actorUserId ?? 'System'} / Request: {event.requestId ?? '-'}</p>
        {event.details && <details className="mt-2"><summary className="cursor-pointer">Review recorded details</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{JSON.stringify(event.details,null,2)}</pre></details>}</li>)}</ul>
      {!events.length && <p className="mt-3 text-sm">No subscription events yet.</p>}</section>
  </div>;
}
