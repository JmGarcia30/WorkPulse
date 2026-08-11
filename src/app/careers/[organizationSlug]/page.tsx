import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { JobStatus } from '@prisma/client';
import { OrganizationHeader } from '@/components/layout/OrganizationHeader';
import { Search, MapPin, Briefcase, Calendar, ArrowRight } from 'lucide-react';

interface OrganizationCareersPageProps {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ search?: string }>;
}

export async function generateMetadata({
  params,
}: OrganizationCareersPageProps): Promise<Metadata> {
  const { organizationSlug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
    select: { name: true, description: true, careersEnabled: true },
  });

  if (!org || !org.careersEnabled) {
    return {
      title: 'Organization Not Found | WorkPulse Careers',
    };
  }

  return {
    title: `${org.name} Careers & Job Openings`,
    description: org.description || `Explore current career opportunities at ${org.name}.`,
  };
}

export default async function OrganizationCareersPage({
  params,
  searchParams,
}: OrganizationCareersPageProps) {
  const { organizationSlug } = await params;
  const { search } = await searchParams;
  const searchQuery = search?.trim();

  // Query organization
  const org = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
  });

  if (!org || !org.careersEnabled) {
    notFound();
  }

  // Multi-tenant check: Query ONLY published jobs belonging to THIS organization
  const jobs = await prisma.job.findMany({
    where: {
      organizationId: org.id,
      status: JobStatus.PUBLISHED,
      OR: searchQuery
        ? [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { department: { contains: searchQuery, mode: 'insensitive' } },
          ]
        : undefined,
    },
    orderBy: { publishedAt: 'desc' },
  });

  return (
    <div className="space-y-8">
      {/* Reusable Organization Header Branding */}
      <OrganizationHeader
        name={org.name}
        slug={org.slug}
        description={org.description}
        logoUrl={org.logoUrl}
      />

      {/* Search & Job List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Open Positions ({jobs.length})
          </h2>

          <form method="GET" className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                name="search"
                defaultValue={searchQuery || ''}
                placeholder="Search openings..."
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Search
            </button>
          </form>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <Briefcase className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              No Active Openings
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              There are currently no active published jobs for {org.name}. Please check back later!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-3">
                  <div>
                    <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {job.department}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1 dark:text-slate-100">
                      {job.title}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                      <span>{job.employmentType}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {job.closingDate
                        ? `Closes ${new Date(job.closingDate).toLocaleDateString()}`
                        : 'Open until filled'}
                    </span>
                  </div>

                  <Link
                    href={`/careers/${org.slug}/${job.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    View Opening <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
