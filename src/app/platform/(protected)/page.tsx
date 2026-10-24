import Link from 'next/link';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { prisma } from '@/lib/db/prisma';
import { listPlatformOrganizations } from '@/features/platform-admin/service';

export default async function PlatformDashboard({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePlatformAdministrator();
  const query = await searchParams;
  const page = /^\d{1,6}$/.test(query.page ?? '') ? Math.max(1, Number(query.page)) : 1;
  const [total, careersEnabled, organizations] = await Promise.all([
    prisma.organization.count(), prisma.organization.count({ where: { careersEnabled: true } }), listPlatformOrganizations(prisma, page),
  ]);
  return <>
    <h1 className="wp-page-title">Organizations</h1>
    <Link className="wp-button-primary" href="/platform/organizations/new">Create organization</Link>
    <div className="grid gap-4 sm:grid-cols-3">
      {[[total, 'Registered organizations'], [careersEnabled, 'Career portals enabled'], [total - careersEnabled, 'Career portals disabled']].map(([count, label]) => <div className="wp-card p-5" key={label}><p className="text-3xl font-semibold">{count}</p><p className="mt-2 text-sm">{label}</p></div>)}
    </div>
    <p className="text-sm text-[var(--wp-text-muted)]">Status below refers to the career portal. Organization suspension is outside this phase.</p>
    <div className="wp-table-wrap"><table className="wp-table"><thead><tr><th>Organization</th><th>Slug</th><th>Career portal status</th><th>Registered</th></tr></thead>
      <tbody>{organizations.map(org => <tr key={org.id}><td><Link className="font-semibold underline" href={`/platform/organizations/${org.id}`}>{org.name}</Link></td><td>{org.slug}</td><td>{org.careersEnabled ? 'Enabled' : 'Disabled'}</td><td>{org.createdAt.toISOString().slice(0, 10)}</td></tr>)}</tbody>
    </table>{organizations.length === 0 && <p className="wp-empty">No organizations on this page.</p>}</div>
    <nav aria-label="Organization pages" className="flex gap-4 text-sm"><span>Page {page}</span>{page > 1 && <Link className="underline" href={`/platform?page=${page - 1}`}>Previous</Link>}{page * 25 < total && <Link className="underline" href={`/platform?page=${page + 1}`}>Next</Link>}</nav>
  </>;
}
