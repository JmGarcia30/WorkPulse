import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { submitApplicationAction } from '@/features/careers/actions';
import { JobStatus } from '@prisma/client';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { ApplicationForm } from '@/components/careers/ApplicationForm';

interface ApplyPageProps {
  params: Promise<{ organizationSlug: string; jobSlug: string }>;
  searchParams: Promise<{ success?: string; error?: string; appId?: string }>;
}

export async function generateMetadata({
  params,
}: ApplyPageProps): Promise<Metadata> {
  const { organizationSlug, jobSlug } = await params;

  const job = await prisma.job.findFirst({
    where: {
      slug: jobSlug,
      status: JobStatus.PUBLISHED,
      organization: {
        slug: organizationSlug,
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
  const { success, error, appId } = await searchParams;

  // Strict Multi-Tenant Security Check
  const org = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
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

  // If application submitted successfully
  if (success === 'true') {
    return (
      <div className="max-w-2xl mx-auto rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-xl dark:border-slate-800 dark:bg-slate-900 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="h-10 w-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Application Submitted Successfully!
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Thank you for applying to the position of <strong className="text-slate-900 dark:text-slate-100">{job.title}</strong> at {org.name}.
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/30 text-left space-y-2">
          <div className="font-bold flex items-center gap-1.5 text-indigo-950 dark:text-indigo-200">
            <span>Next Step: SAGA Institutional Credential Submission</span>
          </div>
          <p className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-relaxed">
            In accordance with the SAGA Institutional Hiring Policy, all candidates must submit required documents (TOR, Diploma, LET license, 3 Recommendation Letters, and NBI Clearance) for review by the Head of the Department.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
          {appId && (
            <Link
              href={`/careers/${org.slug}/portal/${appId}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-sm"
            >
              Access Candidate Document Portal &rarr;
            </Link>
          )}
          <Link
            href={`/careers/${org.slug}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
        href={`/careers/${org.slug}/${job.slug}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Position Details
      </Link>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div>
          <span className="inline-block rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {job.department}
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-2 dark:text-slate-100">
            Apply for {job.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {org.name} • {job.location}
          </p>
        </div>

        <ApplicationForm
          job={{ id: job.id, slug: job.slug, title: job.title }}
          org={{ slug: org.slug, name: org.name }}
          error={error}
          action={submitApplicationAction}
        />
      </div>
    </div>
  );
}

