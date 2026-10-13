import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData } from '@/lib/permissions/rbac';
import { AssessmentStatus, AssessmentType } from '@prisma/client';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  ASSESSMENT_STAGE_CONFIG,
  ASSESSMENT_TYPE_CONFIG,
} from '@/features/hiring/assessment-pipeline';
import {
  Award,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Calendar,
  User,
  Clock,
} from 'lucide-react';

interface AssessmentsPageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
    jobId?: string;
    search?: string;
  }>;
}

export default async function AssessmentsPage({ searchParams }: AssessmentsPageProps) {
  const user = await getSession();
  if (!user) return null;

  if (!canViewHiringData(user)) {
    return (
      <ErrorState
        title="Access Denied"
        message="You do not have permission to view organization assessments."
      />
    );
  }

  const params = await searchParams;
  const statusFilter = params.status;
  const typeFilter = params.type;
  const jobIdFilter = params.jobId;
  const searchQuery = params.search?.trim();

  // Multi-tenant isolated query: Derive assessments via Assessment -> Application -> Job -> Organization
  const assessments = await prisma.assessment.findMany({
    where: {
      application: {
        job: {
          organizationId: user.organizationId,
          id: jobIdFilter || undefined,
        },
        OR: searchQuery
          ? [
              { applicant: { firstName: { contains: searchQuery, mode: 'insensitive' } } },
              { applicant: { lastName: { contains: searchQuery, mode: 'insensitive' } } },
              { applicant: { email: { contains: searchQuery, mode: 'insensitive' } } },
              { job: { title: { contains: searchQuery, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      title: searchQuery && !searchQuery.includes('@') ? { contains: searchQuery, mode: 'insensitive' } : undefined,
      status:
        statusFilter && statusFilter !== 'ALL' ? (statusFilter as AssessmentStatus) : undefined,
      type:
        typeFilter && typeFilter !== 'ALL' ? (typeFilter as AssessmentType) : undefined,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      application: {
        include: {
          applicant: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          job: {
            select: { id: true, title: true, department: true },
          },
        },
      },
      evaluator: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  // Fetch jobs for filter options strictly for authenticated organization
  const organizationJobs = await prisma.job.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--wp-border)] pb-5">
        <div>
          <h1 className="wp-page-title text-xl font-semibold text-[var(--wp-text)] flex items-center gap-2">
            <Award className="h-5 w-5 text-[var(--wp-text)]" />
            Pre-Employment Assessment Center
          </h1>
          <p className="text-sm text-[var(--wp-text-muted)] mt-0.5">
            Monitor candidate technical tests, skill challenges, and evaluation outcomes
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-lg border border-[var(--wp-border)] bg-white p-5 space-y-4">
        <form method="GET" className="grid gap-3 sm:grid-cols-4 items-center">
          {statusFilter && <input type="hidden" aria-label="Status" name="status" value={statusFilter} />}

          {/* Search Box */}
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--wp-text-muted)]" />
            <input
              type="text"
              aria-label="Search records" name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search candidate or title..."
              className="w-full rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] pl-10 pr-3 py-2.5 text-sm font-semibold text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:bg-white focus:ring-1 focus:ring-[var(--tenant-accent)] transition"
            />
          </div>

          {/* Job Filter */}
          <div>
            <select
              aria-label="Job opening" name="jobId"
              defaultValue={jobIdFilter || ''}
              className="w-full rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)] transition"
            >
              <option value="">All Job Positions</option>
              {organizationJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              name="type"
              defaultValue={typeFilter || ''}
              className="w-full rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)] transition"
            >
              <option value="">All Assessment Types</option>
              {Object.values(AssessmentType).map((t) => (
                <option key={t} value={t}>
                  {ASSESSMENT_TYPE_CONFIG[t].label}
                </option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--tenant-primary)] px-5 py-2.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition"
            >
              Filter
            </button>
            <Link
              href="/dashboard/hiring/assessments"
              className="rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-4 py-2.5 text-sm font-bold text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-slate-100 transition"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-[var(--wp-border)]">
          {['ALL', ...Object.values(AssessmentStatus)].map((st) => {
            const isActive = (statusFilter || 'ALL') === st;
            return (
              <Link
                key={st}
                href={`/dashboard/hiring/assessments?${new URLSearchParams({
                  ...(searchQuery ? { search: searchQuery } : {}),
                  ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
                  ...(typeFilter ? { type: typeFilter } : {}),
                  status: st,
                }).toString()}`}
                className={`rounded-md px-4 py-1.5 text-sm font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] '
                    : 'bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-slate-100'
                }`}
              >
                {st.replace('_', ' ')}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Assessments Data Table */}
      <div className="rounded-lg border border-[var(--wp-border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 font-bold">Candidate</th>
                <th className="px-5 py-4 font-bold">Assessment Title</th>
                <th className="px-5 py-4 font-bold">Position</th>
                <th className="px-5 py-4 font-bold">Type</th>
                <th className="px-5 py-4 font-bold">Due Date</th>
                <th className="px-5 py-4 font-bold">Status</th>
                <th className="px-5 py-4 font-bold">Score / Result</th>
                <th className="px-5 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--wp-border)]">
              {assessments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[var(--wp-text-muted)]">
                    <Award className="mx-auto h-8 w-8 text-[var(--wp-text-muted)]" />
                    <p className="mt-2 text-sm font-semibold">No assessments found matching criteria.</p>
                  </td>
                </tr>
              ) : (
                assessments.map((a) => {
                  const statusCfg = ASSESSMENT_STAGE_CONFIG[a.status];
                  const typeCfg = ASSESSMENT_TYPE_CONFIG[a.type];
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-[#F8F9FA]/70 transition"
                    >
                      {/* Candidate */}
                      <td className="px-5 py-4 font-bold text-[var(--wp-text)]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] font-bold text-sm shrink-0">
                            {a.application.applicant.firstName[0]}
                            {a.application.applicant.lastName[0]}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/hiring/applicants/${a.application.id}`}
                              className="hover:underline"
                            >
                              {a.application.applicant.firstName}{' '}
                              {a.application.applicant.lastName}
                            </Link>
                            <p className="text-xs font-normal text-[var(--wp-text-muted)]">
                              {a.application.applicant.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Assessment Title */}
                      <td className="px-5 py-4 text-[var(--wp-text)] font-semibold max-w-xs truncate">
                        {a.title}
                      </td>

                      {/* Position */}
                      <td className="px-5 py-4 text-[var(--wp-text)]">
                        <p className="font-bold">{a.application.job.title}</p>
                        <p className="text-xs text-[var(--wp-text-muted)]">{a.application.job.department}</p>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${typeCfg.badgeBg} ${typeCfg.badgeText}`}
                        >
                          {typeCfg.label}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-4 text-[var(--wp-text-muted)] font-medium">
                        {a.dueDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-[var(--wp-text-muted)]" />
                            <span>{new Date(a.dueDate).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--wp-text-muted)]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-md px-3 py-1 text-xs font-semibold ${statusCfg.badgeBg} ${statusCfg.badgeText}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Score / Result */}
                      <td className="px-5 py-4">
                        {a.score !== null ? (
                          <div className="flex items-center gap-1.5 font-bold">
                            {a.status === AssessmentStatus.PASSED ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-rose-600" />
                            )}
                            <span className="text-[var(--wp-text)]">
                              {a.score} / {a.maxScore ?? 100} pts
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--wp-text-muted)] text-xs">Pending Score</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/dashboard/hiring/applicants/${a.application.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3.5 py-1.5 text-sm font-bold text-[var(--wp-text)] hover:bg-[var(--tenant-primary)] hover:text-[var(--tenant-primary-foreground)] transition"
                        >
                          <Eye className="h-3.5 w-3.5" /> Detail →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
