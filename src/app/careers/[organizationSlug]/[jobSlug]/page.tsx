import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { JobStatus } from '@prisma/client';
import {
  MapPin,
  Briefcase,
  Calendar,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { databaseSlugForTenant, parsePlatformHost } from '@/lib/tenant/host';

interface JobOpeningPageProps {
  params: Promise<{ organizationSlug: string; jobSlug: string }>;
}

export async function generateMetadata({
  params,
}: JobOpeningPageProps): Promise<Metadata> {
  const { organizationSlug, jobSlug } = await params;

  const job = await prisma.job.findFirst({
    where: {
      slug: jobSlug,
      status: JobStatus.PUBLISHED,
      organization: {
        slug: databaseSlugForTenant(organizationSlug),
        careersEnabled: true,
      },
    },
    include: {
      organization: { select: { name: true } },
    },
  });

  if (!job) {
    return { title: 'Position Not Found | WorkPulse Careers' };
  }

  return {
    title: `${job.title} — ${job.organization.name} Careers`,
    description: `Apply for ${job.title} (${job.department}) at ${job.organization.name} in ${job.location}.`,
  };
}

export default async function JobOpeningPage({ params }: JobOpeningPageProps) {
  const { organizationSlug, jobSlug } = await params;

  // Strict Multi-Tenant Security Check: Verify Organization & Job Ownership
  const org = await prisma.organization.findUnique({
    where: { slug: databaseSlugForTenant(organizationSlug) },
    select: { id: true, name: true, slug: true, careersEnabled: true },
  });

  if (!org || !org.careersEnabled) {
    notFound();
  }

  const job = await prisma.job.findFirst({
    where: {
      slug: jobSlug,
      organizationId: org.id, // Strict tenant ownership match
      status: JobStatus.PUBLISHED, // Only published jobs
    },
    include: {
      structuredReqs: true,
    },
  });

  if (!job) {
    notFound();
  }

  // Determine intelligent back route: always take user back to SAGA landing page careers section
  const isSaga = organizationSlug === 'saga' || organizationSlug === 'st-aloysius';
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '';
  const parsed = parsePlatformHost(host);
  const backHref = isSaga
    ? (parsed.kind === 'tenant' ? '/#careers' : '/saga#careers')
    : `/careers/${organizationSlug}`;
  const backLabel = isSaga
    ? 'Back to SAGA Institutional Workspace'
    : `Back to ${org.name} Careers`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B6B6B] hover:text-[#111111] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[#D9A928]" />
          <span>{backLabel}</span>
        </Link>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-[#9A7415] bg-[#FAF8F2] border border-[rgba(217,169,40,0.3)] px-3 py-1 rounded-full">
          <ShieldCheck className="h-3.5 w-3.5 text-[#D9A928]" />
          <span>Official Institutional Opening</span>
        </div>
      </div>

      {/* Main Header Info Card */}
      <div className="rounded-2xl border border-[#E8E2D6] bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 border-b border-[#E8E2D6] pb-6">
          <div>
            <span className="inline-block rounded-full bg-[#FAF8F2] border border-[rgba(217,169,40,0.3)] px-3 py-1 text-[11px] font-bold text-[#9A7415] uppercase tracking-wider">
              {job.department}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight mt-3">
              {job.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1 font-medium">{org.name}</p>
          </div>

          <Link
            href={`/careers/${organizationSlug}/${job.slug}/apply`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#111111] hover:bg-[#282828] px-6 py-3 text-xs font-bold text-white transition shadow-sm shrink-0"
          >
            <span>Apply for Position</span>
            <ArrowRight className="h-4 w-4 text-[#D9A928]" />
          </Link>
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-[#6B6B6B]">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#D9A928]" />
            <span>{job.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-[#D9A928]" />
            <span>{job.employmentType}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#D9A928]" />
            <span>
              {job.closingDate
                ? `Closing Date: ${new Date(job.closingDate).toLocaleDateString()}`
                : 'Applications Open'}
            </span>
          </div>
        </div>
      </div>

      {/* Structured Requirements Checklist */}
      {job.structuredReqs.length > 0 && (
        <div className="rounded-2xl border border-[#E8E2D6] bg-white p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-1 bg-[#D9A928] rounded-full" />
            <h2 className="text-base sm:text-lg font-bold text-[#111111]">
              Key Qualification Requirements
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {job.structuredReqs.map((req) => (
              <div
                key={req.id}
                className="flex items-start gap-3.5 rounded-xl border border-[#E8E2D6] bg-[#FAF8F2] p-4 hover:border-[#D9A928] transition"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#D9A928] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#111111]">
                      {req.name}
                    </span>
                    <span className="rounded bg-white border border-[#E8E2D6] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#9A7415]">
                      {req.type}
                    </span>
                  </div>
                  {req.description && (
                    <p className="mt-1 text-xs text-[#6B6B6B] leading-relaxed">
                      {req.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description & Responsibilities */}
      <div className="rounded-2xl border border-[#E8E2D6] bg-white p-6 sm:p-8 shadow-xs space-y-8">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9A7415]">
            Position Overview
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-[#333333] leading-relaxed whitespace-pre-line">
            {job.description}
          </p>
        </div>

        {job.responsibilities && (
          <div className="border-t border-[#E8E2D6] pt-6">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9A7415]">
              Responsibilities
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-[#333333] leading-relaxed whitespace-pre-line">
              {job.responsibilities}
            </p>
          </div>
        )}

        {job.qualifications && (
          <div className="border-t border-[#E8E2D6] pt-6">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9A7415]">
              Qualifications &amp; Experience
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-[#333333] leading-relaxed whitespace-pre-line">
              {job.qualifications}
            </p>
          </div>
        )}

        {/* Bottom CTA Banner */}
        <div className="pt-6 border-t border-[#E8E2D6] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-[#111111]">Ready to join the SAGA faculty &amp; staff?</p>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">Submit your curriculum vitae and academic credentials.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-lg border border-[#E8E2D6] px-5 py-3 text-xs font-semibold text-[#111111] hover:bg-[#FAF8F2] transition flex-1 sm:flex-initial"
            >
              Return to Openings
            </Link>
            <Link
              href={`/careers/${organizationSlug}/${job.slug}/apply`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#111111] hover:bg-[#282828] px-6 py-3 text-xs font-bold text-white transition shadow-sm flex-1 sm:flex-initial"
            >
              <span>Apply for Position</span>
              <ArrowRight className="h-4 w-4 text-[#D9A928]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
