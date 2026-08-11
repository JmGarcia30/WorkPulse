import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { JobStatus } from '@prisma/client';
import {
  MapPin,
  Briefcase,
  Calendar,
  CheckCircle2,
  ArrowLeft,
  Send,
} from 'lucide-react';

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
        slug: organizationSlug,
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
    where: { slug: organizationSlug },
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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back Link */}
      <Link
        href={`/careers/${org.slug}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {org.name} Careers
      </Link>

      {/* Header Info */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-100 pb-6 dark:border-slate-800">
          <div>
            <span className="inline-block rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {job.department}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 dark:text-slate-100">
              {job.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{org.name}</p>
          </div>

          <Link
            href={`/careers/${org.slug}/${job.slug}/apply`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition shrink-0"
          >
            <Send className="h-4 w-4" /> Apply for Position
          </Link>
        </div>

        {/* Metadata pills */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>{job.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>{job.employmentType}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
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
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Key Qualification Requirements
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {job.structuredReqs.map((req) => (
              <div
                key={req.id}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-indigo-600 shrink-0 dark:text-indigo-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {req.name}
                    </span>
                    <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {req.type}
                    </span>
                  </div>
                  {req.description && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
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
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider dark:text-slate-100">
            Position Overview
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line dark:text-slate-300">
            {job.description}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider dark:text-slate-100">
            Responsibilities
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line dark:text-slate-300">
            {job.responsibilities}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider dark:text-slate-100">
            Qualifications & Experience
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line dark:text-slate-300">
            {job.qualifications}
          </p>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-center">
          <Link
            href={`/careers/${org.slug}/${job.slug}/apply`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 transition"
          >
            <Send className="h-4 w-4" /> Apply for Position
          </Link>
        </div>
      </div>
    </div>
  );
}
