import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { submitApplicationAction } from '@/features/careers/actions';
import { JobStatus } from '@prisma/client';
import { ArrowLeft, CheckCircle2, ArrowRight } from 'lucide-react';
import { ApplicationForm } from '@/components/careers/ApplicationForm';
import { databaseSlugForTenant, classifyRequestHost } from '@/lib/tenant/host';
import { candidatePortalMatchesRequestTenant } from '@/features/hiring/document-access';

interface ApplyPageProps {
  params: Promise<{ organizationSlug: string; jobSlug: string }>;
  searchParams: Promise<{ success?: string; error?: string; appId?: string }>;
}

export async function generateMetadata({
  params,
}: ApplyPageProps): Promise<Metadata> {
  const { organizationSlug, jobSlug } = await params;
  if (!await candidatePortalMatchesRequestTenant(organizationSlug)) notFound();

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
    return { title: 'Application Form | WorkPulse Careers' };
  }

  return {
    title: `Apply for ${job.title} — ${job.organization.name}`,
    description: `Submit your candidate application and resume for ${job.title} at ${job.organization.name}.`,
  };
}

export default async function ApplyPage({ params, searchParams }: ApplyPageProps) {
  const { organizationSlug, jobSlug } = await params;
  if (!await candidatePortalMatchesRequestTenant(organizationSlug)) notFound();
  const { success, error, appId } = await searchParams;

  // Strict Multi-Tenant Security Check
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
      organizationId: org.id,
      status: JobStatus.PUBLISHED,
    },
  });

  if (!job) {
    notFound();
  }

  const isSaga = organizationSlug === 'saga' || organizationSlug === 'st-aloysius';
  const requestHeaders = await headers();
  const parsed = classifyRequestHost(requestHeaders);
  const openingsHref = isSaga
    ? (parsed.kind === 'tenant' ? '/#careers' : '/saga#careers')
    : `/careers/${organizationSlug}`;

  // If application submitted successfully
  if (success === 'true') {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-[#E8E2D6] bg-white p-8 sm:p-12 shadow-sm text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FAF8F2] border border-[rgba(217,169,40,0.3)] text-[#D9A928]">
          <CheckCircle2 className="h-10 w-10 text-[#D9A928]" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#111111]">
            Application request received
          </h1>
          <p className="text-xs text-[#6B6B6B] max-w-md mx-auto leading-relaxed">
            If your request is eligible, check your application email for a verification link. You must verify your email before accessing candidate documents.
          </p>
        </div>

        <div className="rounded-xl border border-[rgba(217,169,40,0.3)] bg-[#FAF8F2] p-5 text-xs text-[#111111] text-left space-y-2">
          <div className="font-bold flex items-center gap-2 text-[#9A7415]">
            <span className="h-2 w-2 rounded-full bg-[#D9A928]" />
            <span>{org.slug === 'st-aloysius' ? 'Next Step: SAGA Institutional Credential Submission' : 'Next Step: Email verification and document submission'}</span>
          </div>
          <p className="text-[11px] text-[#6B6B6B] leading-relaxed">
            {org.slug === 'st-aloysius' ? 'In accordance with the SAGA Institutional Hiring Policy, candidates must submit the required credentials for their position for review by the Head of the Department.' : 'Verify your application email to view the documents requested by this organization and upload them securely.'}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
          {appId && (
            <Link
              href={`/careers/${organizationSlug}/portal/${appId}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#111111] hover:bg-[#282828] px-6 py-2.5 text-xs font-bold text-white transition shadow-sm"
            >
              <span>Access Candidate Document Portal</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#D9A928]" />
            </Link>
          )}
          <Link
            href={openingsHref}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E8E2D6] bg-white px-5 py-2.5 text-xs font-semibold text-[#111111] hover:bg-[#FAF8F2] transition"
          >
            Explore Other Openings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Link */}
      <Link
        href={`/careers/${organizationSlug}/${job.slug}`}
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B6B6B] hover:text-[#111111] transition-colors"
      >
        <ArrowLeft className="h-4 w-4 text-[#D9A928]" />
        <span>Back to Position Details</span>
      </Link>

      <div className="rounded-2xl border border-[#E8E2D6] bg-white p-6 sm:p-10 shadow-xs space-y-6">
        <div>
          <span className="inline-block rounded-full bg-[#FAF8F2] border border-[rgba(217,169,40,0.3)] px-3 py-1 text-[11px] font-bold text-[#9A7415] uppercase tracking-wider">
            {job.department}
          </span>
          <h1 className="text-2xl font-extrabold text-[#111111] mt-2.5">
            Apply for {job.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1 font-medium">
            {org.name} &bull; {job.location}
          </p>
        </div>

        <ApplicationForm
          job={{ id: job.id, slug: job.slug, title: job.title }}
          org={{ slug: organizationSlug, name: org.name }}
          error={error}
          action={submitApplicationAction}
        />
      </div>
    </div>
  );
}
