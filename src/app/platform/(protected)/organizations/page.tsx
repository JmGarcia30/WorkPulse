import Link from 'next/link';
import { ArrowRight, Building2, Plus } from 'lucide-react';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';

const synthetic = { OR: [{ slug: { startsWith: 'syn-a-' } }, { slug: { startsWith: 'syn-b-' } }] } as const;
export default async function PlatformOrganizations({ searchParams }: { searchParams: Promise<{ view?: string; page?: string; q?: string }> }) {
  await requirePlatformAdministrator();
  const params = await searchParams;
  const view = params.view === 'all' || params.view === 'synthetic' ? params.view : 'other';
  const page = /^[1-9]\d{0,4}$/.test(params.page ?? '') ? Number(params.page) : 1;
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const where: Prisma.OrganizationWhereInput = {
    ...(view === 'synthetic' ? synthetic : view === 'other' ? { NOT: synthetic } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  const [matched, total, syntheticCount, organizations] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.count(),
    prisma.organization.count({ where: synthetic }),
    prisma.organization.findMany({
      where, select: { id: true, name: true, slug: true, careersEnabled: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20,
    }),
  ]);
  const url = (v: string, p = 1) => '/platform/organizations?' + new URLSearchParams({ view: v, page: String(p), ...(q ? { q } : {}) }).toString();
  const maxPage = Math.max(1, Math.ceil(matched / 20));
  return <div className="platform-section-gap">
    <Link href="/platform" className="platform-page-back">← Back to overview</Link>
    <div className="platform-page-heading">
      <div><p className="platform-eyebrow">Workspace management</p><h1 className="platform-title">Organizations</h1><p className="platform-description">Find a workspace, check career portal access, or open its administrative settings.</p></div>
      <Link href="/platform/organizations/new" className="wp-button-primary"><Plus size={16} aria-hidden="true"/> Add organization</Link>
    </div>
    <section className="platform-card">
      <div className="platform-card-header">
        <div><h2 className="platform-card-title">Organization directory</h2><p className="platform-card-description">{total - syntheticCount} regular organization records · {syntheticCount} synthetic test records</p></div>
        <div className="flex items-center gap-1 rounded-xl bg-[#f6f8f7] p-1">
          {[['other','Organizations'], ['synthetic','Test data'], ['all','All']].map(([value,label]) => <Link key={value} href={url(value)} className="platform-filter-link" aria-current={view === value ? 'page' : undefined}>{label}</Link>)}
        </div>
      </div>
      <form action="/platform/organizations" method="GET" className="flex flex-wrap gap-2 px-6 pb-4">
        <input type="hidden" name="view" value={view}/>
        <label htmlFor="organization-search" className="sr-only">Search organizations by name or workspace slug</label>
        <input id="organization-search" name="q" defaultValue={q} placeholder="Search by name or workspace URL..." className="wp-input w-full max-w-md"/>
        <button type="submit" className="wp-button-secondary">Search</button>
        {q && <Link className="platform-filter-link" href={url(view)}>Clear</Link>}
      </form>
      {view === 'synthetic' && <p className="mx-6 mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">These organizations match legacy synthetic test prefixes. Some contain test payroll history. Their records are not deleted, and they are excluded from the default directory.</p>}
      <div className="platform-table-scroll">
        <table className="platform-simple-table">
          <thead><tr><th scope="col">Organization</th><th scope="col">Workspace URL</th><th scope="col">Career portal</th><th scope="col">Registered</th><th scope="col">Action</th></tr></thead>
          <tbody>{organizations.map(org => <tr key={org.id}>
            <td><div className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#edf3f4] text-[#17324d]"><Building2 size={17}/></div><span className="font-semibold">{org.name}</span></div></td>
            <td className="max-w-[280px] break-all text-[#71808b]">{org.slug === 'st-aloysius' ? '/saga' : '/w/' + org.slug}</td>
            <td><span className={'platform-status ' + (org.careersEnabled ? 'platform-status-on' : 'platform-status-off')}>{org.careersEnabled ? 'Enabled' : 'Disabled'}</span></td>
            <td>{org.createdAt.toISOString().slice(0,10)}</td>
            <td><Link className="platform-soft-link" href={'/platform/organizations/' + org.id}>Manage <ArrowRight size={13}/></Link></td>
          </tr>)}</tbody>
        </table>
        {organizations.length === 0 && <div className="platform-empty">No organizations match your search. Try a different name or category.</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ef] px-6 py-4 text-xs text-[#72808a]">
        <span>{matched} matches · Page {Math.min(page,maxPage)} of {maxPage}</span>
        <div className="flex items-center gap-3">
          {page > 1 && <Link className="platform-soft-link" href={url(view,page-1)}>Previous</Link>}
          {page < maxPage && <Link className="platform-soft-link" href={url(view,page+1)}>Next <ArrowRight size={13}/></Link>}
        </div>
      </div>
    </section>
  </div>;
}
