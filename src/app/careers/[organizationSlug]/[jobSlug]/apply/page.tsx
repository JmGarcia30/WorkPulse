import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { submitApplicationAction } from '@/features/careers/actions';
import { JobStatus } from '@prisma/client';
import {
  ArrowLeft,
  CheckCircle2,
  Upload,
  Send,
  AlertCircle,
} from 'lucide-react';

interface ApplyPageProps {
  params: Promise<{ organizationSlug: string; jobSlug: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
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
  const { success, error } = await searchParams;

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

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950">
          Your profile and resume have been securely registered in our HR operations system. Our hiring team will review your application.
        </div>

        <div className="pt-4 flex justify-center gap-3">
          <Link
            href={`/careers/${org.slug}`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
          >
            Explore Other Careers at {org.name}
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

        {error && (
          <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form action={submitApplicationAction} className="space-y-6">
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="organizationSlug" value={org.slug} />
          <input type="hidden" name="jobSlug" value={job.slug} />

          {/* Personal Information */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 dark:text-slate-100 dark:border-slate-800">
              1. Personal Information
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  required
                  placeholder="e.g. Maria"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  required
                  placeholder="e.g. Santos"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="maria.santos@gmail.com"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="+63 917 123 4567"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Application Cover Letter */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 dark:text-slate-100 dark:border-slate-800">
              2. Cover Letter & Statement
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Cover Letter *
              </label>
              <textarea
                name="coverLetter"
                required
                rows={5}
                placeholder="Introduce yourself and explain why you are an ideal candidate for this position..."
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Resume Upload */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 dark:text-slate-100 dark:border-slate-800">
              3. Resume / Curriculum Vitae Upload
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Resume File (PDF, DOC, DOCX up to 5MB)
              </label>
              <div className="mt-1 flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-indigo-400 transition dark:border-slate-700">
                <div className="space-y-2">
                  <Upload className="mx-auto h-8 w-8 text-slate-400" />
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <label className="relative cursor-pointer rounded-md font-bold text-indigo-600 focus-within:outline-hidden hover:text-indigo-500 dark:text-indigo-400">
                      <span>Upload a file</span>
                      <input
                        type="file"
                        name="resume"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="sr-only"
                      />
                    </label>
                    <span> or drag and drop</span>
                  </div>
                  <p className="text-[10px] text-slate-400">PDF, DOC, or DOCX up to 5MB</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 transition"
            >
              <Send className="h-4 w-4" /> Submit Application
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
