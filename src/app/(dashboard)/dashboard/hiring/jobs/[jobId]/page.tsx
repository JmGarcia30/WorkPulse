import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canManageJobs } from '@/lib/permissions/rbac';
import { JobStatus } from '@prisma/client';
import {
  ArrowLeft,
  Edit,
  CheckCircle,
  XCircle,
  Users,
  MapPin,
  Clock,
  Briefcase,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { publishJobAction, closeJobAction } from '@/features/hiring/actions';

interface JobDetailPageProps {
  params: Promise<{ jobId: string }>;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const user = await getSession();
  if (!user) return null;

  const { jobId } = await params;

  // Multi-tenant check: Verify job belongs to user's Organization
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      organizationId: user.organizationId,
    },
    include: {
      structuredReqs: true,
      _count: {
        select: { applications: true },
      },
    },
  });

  if (!job) {
    notFound();
  }

  const canEdit = canManageJobs(user);

  async function handlePublish() {
    'use server';
    await publishJobAction(jobId);
  }

  async function handleClose() {
    'use server';
    await closeJobAction(jobId);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/hiring/jobs"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {job.title}
              </h1>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                  job.status === JobStatus.PUBLISHED
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : job.status === JobStatus.DRAFT
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {job.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {job.department} • {job.employmentType} • {job.location}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/hiring/jobs/${job.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <Edit className="h-3.5 w-3.5" /> Edit Job
            </Link>

            {job.status === JobStatus.DRAFT && (
              <form action={handlePublish}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-xs"
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Publish Job
                </button>
              </form>
            )}

            {job.status === JobStatus.PUBLISHED && (
              <form action={handleClose}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                >
                  <XCircle className="h-3.5 w-3.5" /> Close Posting
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center gap-3">
          <div className="rounded-lg bg-[#F8F9FA] border border-[#E8EAED] p-2.5 text-[#181A1C] dark:bg-slate-800 dark:border-slate-700 dark:text-white">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Applications Submitted</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {job._count.applications}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Published Date</p>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {job.publishedAt ? new Date(job.publishedAt).toLocaleDateString() : 'Not published'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex items-center gap-3">
          <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <ExternalLink className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Public Careers Link</p>
            <Link
              href={`/careers/${job.slug}`}
              target="_blank"
              className="text-xs font-bold text-[#181A1C] hover:underline dark:text-slate-200 mt-0.5 block truncate max-w-[180px]"
            >
              /careers/{job.slug}
            </Link>
          </div>
        </div>
      </div>

      {/* Structured Requirements Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 pb-2 dark:border-slate-800">
          Structured Requirement Criteria
        </h2>
        {job.structuredReqs.length === 0 ? (
          <p className="text-xs text-slate-500">No structured requirement tags added.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {job.structuredReqs.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {req.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-[#F8F9FA] border border-[#E8EAED] px-1.5 py-0.5 text-[9px] font-bold text-[#181A1C] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                      {req.type}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${
                        req.isRequired
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {req.isRequired ? 'Required' : 'Preferred'}
                    </span>
                  </div>
                </div>
                {req.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{req.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Description & Responsibilities */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
            Description
          </h3>
          <p className="mt-2 text-xs text-slate-700 leading-relaxed whitespace-pre-line dark:text-slate-300">
            {job.description}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
            Key Responsibilities
          </h3>
          <p className="mt-2 text-xs text-slate-700 leading-relaxed whitespace-pre-line dark:text-slate-300">
            {job.responsibilities}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
            Qualifications
          </h3>
          <p className="mt-2 text-xs text-slate-700 leading-relaxed whitespace-pre-line dark:text-slate-300">
            {job.qualifications}
          </p>
        </div>
      </div>
    </div>
  );
}
