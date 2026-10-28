import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { submitApplicationAction } from '@/features/careers/actions';
import { JobStatus } from '@prisma/client';
import { ArrowLeft, CheckCircle2, ArrowRight } from 'lucide-react';
import { ApplicationForm } from '@/components/careers/ApplicationForm';
import styles from '@/components/careers/ApplicationForm.module.css';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { getOrganizationBranding } from '@/features/organization-branding/read-model';
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

  const branding = await getOrganizationBranding(org.id);
  if (!branding) notFound();

  const isSaga = organizationSlug === 'saga' || organizationSlug === 'st-aloysius';
  const requestHeaders = await headers();
  const parsed = classifyRequestHost(requestHeaders);
  const appearanceClass = [styles.appearance, styles.shell, isSaga ? styles.sagaLight : ''].filter(Boolean).join(' ');
  const openingsHref = isSaga
    ? (parsed.kind === 'tenant' ? '/#careers' : '/saga#careers')
    : `/careers/${organizationSlug}`;

  // If application submitted successfully
  if (success === 'true') {
    return (
      <TenantTheme branding={branding} className={appearanceClass}>
      <div className={styles.card + ' text-center space-y-6'}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border text-[var(--tenant-accent)]">
          <CheckCircle2 className="h-10 w-10" />
        </div>

        <div className="space-y-2">
          <h1 className={styles.title}>
            Application request received
          </h1>
          <p className={styles.hint + ' max-w-md mx-auto'}>
            If your request is eligible, check your application email for a verification link. You must verify your email before accessing candidate documents.
          </p>
        </div>

        <div className="rounded-xl border p-5 text-xs text-left space-y-2">
          <div className="font-bold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--tenant-accent)]" />
            <span>{org.slug === 'st-aloysius' ? 'Next Step: SAGA Institutional Credential Submission' : 'Next Step: Email verification and document submission'}</span>
          </div>
          <p className={styles.hint}>
            {org.slug === 'st-aloysius' ? 'In accordance with the SAGA Institutional Hiring Policy, candidates must submit the required credentials for their position for review by the Head of the Department.' : 'Verify your application email to view the documents requested by this organization and upload them securely.'}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
          {appId && (
            <Link
              href={`/careers/${organizationSlug}/portal/${appId}`}
              className={isSaga ? styles.sagaPrimary : 'wp-button-primary'}
            >
              <span>Access Candidate Document Portal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <Link
            href={openingsHref}
            className={styles.back}
          >
            Explore Other Openings
          </Link>
        </div>
      </div>
      </TenantTheme>
    );
  }

  return (
    <TenantTheme branding={branding} className={appearanceClass}>
      {/* Back Link */}
      <Link
        href={`/careers/${organizationSlug}/${job.slug}`}
        className={styles.back}
      >
        <ArrowLeft className="h-4 w-4 text-[#D9A928]" />
        <span>Back to Position Details</span>
      </Link>

      <div className={styles.card + ' space-y-7'}>
        <div>
          <span className={styles.badge}>
            {job.department}
          </span>
          <h1 className={styles.title}>
            Apply for {job.title}
          </h1>
          <p className={styles.hint}>
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
    </TenantTheme>
  );
}
