import Link from 'next/link';
import { ArrowRight, Building2, BriefcaseBusiness, CalendarDays, FlaskConical, Plus, ShieldCheck } from 'lucide-react';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { prisma } from '@/lib/db/prisma';

const syntheticFilter = { OR: [{ slug: { startsWith: 'syn-a-' } }, { slug: { startsWith: 'syn-b-' } }] } as const;
export default async function PlatformOverview() {
  const administrator = await requirePlatformAdministrator();
  const [total, synthetic, careersEnabled, recentCount, organizations, recentAudits] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: syntheticFilter }),
    prisma.organization.count({ where: { careersEnabled: true, NOT: syntheticFilter } }),
    prisma.organization.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) }, NOT: syntheticFilter } }),
    prisma.organization.findMany({
      where: { NOT: syntheticFilter },
      select: { id: true, name: true, slug: true, careersEnabled: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 5,
    }),
    prisma.platformOrganizationAudit.findMany({
      select: { id: true, action: true, createdAt: true, organization: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 4,
    }),
  ]);
  const real = total - synthetic;
  const greeting = administrator.name.trim().split(/\s+/)[0] || 'Administrator';
  return <div className="platform-section-gap">
    <div className="platform-page-heading">
      <div><p className="platform-eyebrow">Platform Overview</p><h1 className="platform-title">Welcome back, {greeting}.</h1>
        <p className="platform-description">Manage your organization's workspaces, recruitment portals, and platform activity from one place.</p>
      </div>
    </div>
    <section className="platform-hero" aria-label="Organization management">
      <div className="platform-hero-content">
        <p className="platform-hero-eyebrow">WORKPULSE SAAS ADMINISTRATION</p>
        <h2 className="platform-hero-title">All your workspaces. One platform.</h2>
        <p className="platform-hero-description">Review registered organizations, manage their public career portals, and keep platform operations organized without accessing private employee data.</p>
      </div>
      <div className="platform-hero-actions">
        <Link className="platform-hero-button" href="/platform/organizations/new"><Plus size={16} aria-hidden="true"/> Add organization</Link>
        <Link className="platform-hero-button platform-hero-button-outline" href="/platform/organizations">View workspaces <ArrowRight size={16} aria-hidden="true"/></Link>
      </div>
    </section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { value: real, label: 'Organizations', hint: 'Excludes synthetic test tenants', icon: Building2, variant: '' },
        { value: careersEnabled, label: 'Career portals enabled', hint: 'Among non-synthetic workspaces', icon: BriefcaseBusiness, variant: '' },
        { value: recentCount, label: 'New this month', hint: 'Registered in the past 30 days', icon: CalendarDays, variant: 'navy' },
        { value: synthetic, label: 'Test organizations', hint: 'Kept separate from real workspaces', icon: FlaskConical, variant: 'amber' },
      ].map(item => <section className="platform-card platform-stat" key={item.label}>
        <div><p className="platform-stat-label">{item.label}</p><p className="platform-stat-value">{item.value}</p><p className="platform-stat-hint">{item.hint}</p></div>
        <div className={'platform-stat-icon ' + (item.variant ? 'platform-stat-icon-' + item.variant : '')}><item.icon size={19} aria-hidden="true"/></div>
      </section>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(290px,.85fr)]">
      <section className="platform-card min-w-0">
        <div className="platform-card-header"><div><h2 className="platform-card-title">Recent organizations</h2><p className="platform-card-description">Registered workspaces excluding synthetic test data</p></div><Link href="/platform/organizations" className="platform-soft-link">View all <ArrowRight size={14}/></Link></div>
        <div className="platform-table-scroll">
          <table className="platform-simple-table"><thead><tr><th scope="col">Organization</th><th scope="col">Career portal</th><th scope="col">Manage</th></tr></thead>
            <tbody>{organizations.map(org => <tr key={org.id}>
              <td><p className="font-semibold">{org.name}</p><p className="mt-1 break-all text-[11px] text-slate-500">/w/{org.slug === 'st-aloysius' ? 'saga' : org.slug}</p></td>
              <td><span className={'platform-status ' + (org.careersEnabled ? 'platform-status-on' : 'platform-status-off')}>{org.careersEnabled ? 'Enabled' : 'Disabled'}</span></td>
              <td><Link className="platform-soft-link" href={'/platform/organizations/' + org.id}>Open <ArrowRight size={13}/></Link></td>
            </tr>)}</tbody></table>
          {organizations.length === 0 && <div className="platform-empty">No organizations have been registered yet.</div>}
        </div>
      </section>
      <section className="platform-card">
        <div className="platform-card-header"><div><h2 className="platform-card-title">Platform activity</h2><p className="platform-card-description">Latest organization administration events</p></div><Link href="/platform/audit-logs" className="platform-soft-link">Audit logs <ArrowRight size={14}/></Link></div>
        <div className="space-y-0 px-6 pb-5">
          {recentAudits.map(event => <div className="flex items-start gap-3 border-b border-[#eef0ef] py-4 last:border-b-0" key={event.id}>
            <div className="platform-stat-icon h-9 w-9 shrink-0"><ShieldCheck size={16}/></div>
            <div className="min-w-0"><p className="text-xs font-semibold">{event.action.replaceAll('_', ' ').toLowerCase()}</p><p className="mt-1 text-[11px] text-slate-500">{event.organization.name}</p><time dateTime={event.createdAt.toISOString()} className="mt-1 block text-[10px] text-slate-400">{event.createdAt.toISOString().slice(0,16).replace('T',' ')} UTC</time></div>
          </div>)}
          {recentAudits.length === 0 && <div className="platform-muted-box mt-3">No recent organization administration events. Actions such as organization creation and invitations appear here.</div>}
          <div className="platform-muted-box mt-4"><strong>Privacy by design.</strong> System Admin manages platform metadata; private employee, applicant and payroll records stay inside each organization's HR workspace.</div>
        </div>
      </section>
    </div>
  </div>;
}
