import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { canManageJobs } from '@/lib/permissions/rbac';
import { JobStatus } from '@prisma/client';
import {
  ArrowLeft,
  Edit,
  CheckCircle,
  XCircle,
  Users,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { publishJobAction, closeJobAction } from '@/features/hiring/actions';
import { HiringPageHeader } from '@/components/hiring/HiringPageHeader';

interface JobDetailPageProps {
  params: Promise<{ jobId: string }>;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const user = await requireBackOfficeContext();

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
    <div className="min-w-0 max-w-4xl mx-auto space-y-6 [overflow-wrap:anywhere]">
      {/* Header Bar with Breadcrumb and Title */}
      <HiringPageHeader
        breadcrumbs={[
          { label: 'Hiring', href: '/dashboard/hiring/pipeline' },
          { label: 'Job Openings', href: '/dashboard/hiring/jobs' },
          { label: job.title },
        ]}
        title={
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/dashboard/hiring/jobs"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
              aria-label="Back to Job Openings"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="min-w-0 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {job.title}
            </h1>
          </div>
        }
        badge={
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold ${job.status === JobStatus.PUBLISHED
                ? 'bg-emerald-50 text-emerald-700 '
                : job.status === JobStatus.DRAFT
                  ? 'bg-amber-50 text-amber-700 '
                  : 'bg-slate-100 text-slate-600 '
              }`}
          >
            {job.status}
          </span>
        }
        description={`${job.department} • ${job.employmentType} • ${job.location}`}
        actions={
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/hiring/jobs/${job.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Edit className="h-3.5 w-3.5" /> Edit Job
              </Link>

              {job.status === JobStatus.DRAFT && (
                <form action={handlePublish}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Publish Job
                  </button>
                </form>
              )}

              {job.status === JobStatus.PUBLISHED && (
                <form action={handleClose}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Close Posting
                  </button>
                </form>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Metrics Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4 flex items-center gap-3">
          <div className="rounded-lg bg-[var(--wp-surface-subtle)] border border-[var(--wp-border)] p-2.5 text-[var(--wp-text)]">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-500">Applications Submitted</p>
            <p className="text-lg font-bold text-slate-900">
              {job._count.applications}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-500">Published Date</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">
              {job.publishedAt ? new Date(job.publishedAt).toLocaleDateString() : 'Not published'}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 flex items-center gap-3">
          <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600">
            <ExternalLink className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-500">Public Careers Link</p>
            <Link
              href={`/careers/${job.slug}`}
              target="_blank"
              className="text-sm font-bold text-[var(--wp-text)] hover:underline mt-0.5 block truncate max-w-[180px]"
            >
              /careers/{job.slug}
            </Link>
          </div>
        </div>
      </div>

      {/* Structured Requirements Section */}
      <div className="rounded-md border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Structured Requirement Criteria
        </h2>
        {job.structuredReqs.length === 0 ? (
          <p className="text-sm text-slate-500">No structured requirement tags added.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {job.structuredReqs.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3.5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    {req.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-[var(--wp-surface-subtle)] border border-[var(--wp-border)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wp-text)]">
                      {req.type}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${req.isRequired
                          ? 'bg-rose-50 text-rose-700 '
                          : 'bg-slate-200 text-slate-700 '
                        }`}
                    >
                      {req.isRequired ? 'Required' : 'Preferred'}
                    </span>
                  </div>
                </div>
                {req.description && (
                  <p className="text-sm text-slate-500">{req.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Description & Responsibilities */}
      <div className="rounded-md border border-slate-200 bg-white p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Description
          </h3>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {job.description}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Key Responsibilities
          </h3>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {job.responsibilities}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Qualifications
          </h3>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {job.qualifications}
          </p>
        </div>
      </div>
    </div>
  );
}
