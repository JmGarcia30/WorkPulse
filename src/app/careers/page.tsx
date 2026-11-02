import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { Building2, ArrowRight, Briefcase } from 'lucide-react';

// The directory is database-backed and must never make deployment builds depend on Neon availability.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Careers Portal Directory | WorkPulse SaaS',
  description: 'Explore active institutional and enterprise career portals hosted on the WorkPulse SaaS platform.',
};

export default async function CareersDirectoryPage() {
  // Query organizations with active careers portals
  const organizations = await prisma.organization.findMany({
    where: { careersEnabled: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      _count: {
        select: {
          jobs: {
            where: { status: 'PUBLISHED' },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center space-y-3">
        <span className="inline-block rounded-full bg-[var(--tenant-tint)] px-3.5 py-1 text-xs font-bold text-[var(--tenant-primary)]">
          WorkPulse SaaS Multi-Tenant Platform
        </span>
        <h1 className="text-3xl font-extrabold text-[var(--wp-text)]">
          Organization Career Portals
        </h1>
        <p className="text-xs sm:text-sm text-[var(--wp-text-muted)] max-w-xl mx-auto">
          Select an organization portal below to explore active career opportunities and submit applications.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {organizations.map((org) => (
          <Link
            key={org.id}
            href={`/careers/${org.slug}`}
            className="flex flex-col justify-between rounded-2xl border border-[var(--wp-border)] bg-[var(--wp-surface)] p-6 shadow-xs hover:border-[var(--tenant-primary)] hover:shadow-md transition "
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tenant-tint)] p-2 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--wp-text)]">
                    {org.name}
                  </h2>
                  <p className="text-[11px] text-[var(--wp-text-muted)]">/careers/{org.slug}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-[var(--wp-text-muted)] line-clamp-2 leading-relaxed">
                {org.description || 'Institutional career opportunities portal.'}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--wp-border)] flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Briefcase className="h-3.5 w-3.5 text-[var(--tenant-primary)]" />
                <span>{org._count.jobs} Open Positions</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--tenant-primary)]">
                Explore <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
