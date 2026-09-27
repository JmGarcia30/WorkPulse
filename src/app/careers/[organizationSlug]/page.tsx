import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { JobStatus } from '@prisma/client';
import { OrganizationHeader } from '@/components/layout/OrganizationHeader';
import { Search, MapPin, Briefcase, Calendar, ArrowRight } from 'lucide-react';
import { getOrganizationBranding } from '@/features/organization-branding/read-model';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { databaseSlugForTenant, parsePlatformHost } from '@/lib/tenant/host';

interface OrganizationCareersPageProps {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ search?: string }>;
}

export async function generateMetadata({
  params,
}: OrganizationCareersPageProps): Promise<Metadata> {
  const { organizationSlug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug: databaseSlugForTenant(organizationSlug) },
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

  // If SAGA, seamlessly redirect to the official SAGA institutional workspace landing page (#careers section)
  if (organizationSlug === 'saga' || organizationSlug === 'st-aloysius') {
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '';
    const parsed = parsePlatformHost(host);
    redirect(parsed.kind === 'tenant' ? '/#careers' : '/saga#careers');
  }

  // Query organization
  const org = await prisma.organization.findUnique({
    where: { slug: databaseSlugForTenant(organizationSlug) },
  });

  if (!org || !org.careersEnabled) {
    notFound();
  }
  const branding = await getOrganizationBranding(org.id);
  if (!branding) notFound();

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
    <TenantTheme branding={branding}>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Reusable Organization Header Branding */}
        <OrganizationHeader branding={branding} />

        {/* Search & Job List */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#E8E2D6] pb-4">
            <h2 className="text-xl font-bold text-[#111111]">
              Open Positions ({jobs.length})
            </h2>

            <form method="GET" className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#9A9A9A]" />
                <input
                  type="text"
                  name="search"
                  defaultValue={searchQuery || ''}
                  placeholder="Search openings..."
                  className="w-full rounded-lg border border-[#E8E2D6] bg-white pl-10 pr-3.5 py-2.5 text-xs text-[#111111] focus:border-[#D9A928] focus:ring-1 focus:ring-[#D9A928] outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-[#111111] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#282828] transition"
              >
                Search
              </button>
            </form>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-[#E8E2D6] bg-white p-12 text-center">
              <Briefcase className="mx-auto h-10 w-10 text-[#D9A928]" />
              <h3 className="mt-3 text-sm font-semibold text-[#111111]">
                No Active Openings
              </h3>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                There are currently no active published jobs for {org.name}. Please check back later!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E8E2D6] bg-white p-6 hover:border-[#D9A928] transition shadow-xs"
                >
                  <div className="space-y-3">
                    <div>
                      <span className="inline-block rounded-full bg-[#FAF8F2] border border-[rgba(217,169,40,0.3)] px-2.5 py-0.5 text-[10px] font-bold text-[#9A7415] uppercase tracking-wider">
                        {job.department}
                      </span>
                      <h3 className="text-base font-bold text-[#111111] mt-1.5">
                        {job.title}
                      </h3>
                    </div>

                    <p className="text-xs text-[#6B6B6B] line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B6B6B] pt-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-[#D9A928]" />
                        <span>{job.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-[#D9A928]" />
                        <span>{job.employmentType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#E8E2D6] flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-[#9A9A9A]">
                      <Calendar className="h-3.5 w-3.5 text-[#D9A928]" />
                      <span>
                        {job.closingDate
                          ? `Closes ${new Date(job.closingDate).toLocaleDateString()}`
                          : 'Open until filled'}
                      </span>
                    </div>

                    <Link
                      href={`/careers/${organizationSlug}/${job.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#111111] hover:text-[#9A7415] transition"
                    >
                      View Opening <ArrowRight className="h-3.5 w-3.5 text-[#D9A928]" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TenantTheme>
  );
}
