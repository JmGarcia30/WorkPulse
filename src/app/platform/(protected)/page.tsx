import Link from 'next/link';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { prisma } from '@/lib/db/prisma';

const syntheticFilter = { OR: [{ slug: { startsWith: 'syn-a-' } }, { slug: { startsWith: 'syn-b-' } }] };
const date = (value: Date) => value.toISOString().slice(0, 10);

export default async function PlatformDashboard({ searchParams }: { searchParams: Promise<{ page?: string; view?: string }> }) {
  await requirePlatformAdministrator();
  const params = await searchParams;
  const page = /^\d{1,6}$/.test(params.page ?? '') ? Math.min(100000, Math.max(1, Number(params.page))) : 1;
  const view = params.view === 'synthetic' || params.view === 'all' ? params.view : 'other';
  const filter = view === 'synthetic' ? syntheticFilter : view === 'other' ? { NOT: syntheticFilter } : {};
  const [total, synthetic, careersEnabled, filtered, organizations, recent] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: syntheticFilter }),
    prisma.organization.count({ where: { careersEnabled: true } }),
    prisma.organization.count({ where: filter }),
    prisma.organization.findMany({
      where: filter,
      select: { id: true, name: true, slug: true, careersEnabled: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * 25, take: 25,
    }),
    prisma.organization.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
  ]);
  const link = (v: string, p: number) => `/platform?view=${v}&page=${p}`;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="wp-page-title">Organizations</h1><p className="mt-2 text-sm text-slate-600">Manage registered workspaces and their career portals. Synthetic test tenants are separated by default.</p></div>
      <Link className="wp-button-primary" href="/platform/organizations/new">Create organization</Link>
    </header>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[[total, 'All registered'], [total - synthetic, 'Other organizations'], [synthetic, 'Synthetic test tenants'], [recent, 'Registrations (last 30 days)']].map(([count, label]) =>
        <div className="wp-card p-5" key={label}><p className="text-3xl font-semibold">{count}</p><p className="mt-2 text-sm">{label}</p></div>)}
    </div>
    <p className="text-sm text-slate-600">{careersEnabled} career portals enabled, {total - careersEnabled} disabled across all organizations. Counts include synthetic tenants unless otherwise noted.</p>
    <nav aria-label="Filter organizations" className="flex flex-wrap gap-3 text-sm">
      {[['other', 'Other organizations'], ['all', 'All organizations'], ['synthetic', 'Synthetic test tenants']].map(([value, label]) =>
        <Link key={value} aria-current={view === value ? 'page' : undefined} className={view === value ? 'wp-button-primary' : 'wp-button-secondary'} href={link(value, 1)}>{label}</Link>)}
    </nav>
    {view === 'synthetic' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">These records match the legacy synthetic test-script workspace prefixes. They are not deleted or hidden from audit history. Some have associated payroll and other test records.</p>}
    <div className="wp-table-wrap">
      <table className="wp-table"><thead><tr><th>Organization</th><th>Workspace slug</th><th>Career portal</th><th>Registered</th><th>Action</th></tr></thead>
        <tbody>{organizations.map(org => <tr key={org.id}>
          <td><Link className="font-semibold underline" href={`/platform/organizations/${org.id}`}>{org.name}</Link></td>
          <td className="break-all">{org.slug}</td><td>{org.careersEnabled ? 'Enabled' : 'Disabled'}</td><td>{date(org.createdAt)}</td>
          <td><Link className="underline" href={`/platform/organizations/${org.id}`}>Manage</Link></td>
        </tr>)}</tbody></table>
      {!organizations.length && <p className="p-5 text-sm">No organizations match this filter.</p>}
    </div>
    <nav aria-label="Organization pages" className="flex items-center gap-4 text-sm">
      <span>Page {page} of {Math.max(1, Math.ceil(filtered / 25))} · {filtered} organizations</span>
      {page > 1 && <Link className="underline" href={link(view, page - 1)}>Previous</Link>}
      {page * 25 < filtered && <Link className="underline" href={link(view, page + 1)}>Next</Link>}
    </nav>
  </div>;
}
