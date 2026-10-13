import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData } from '@/lib/permissions/rbac';
import { InterviewStatus, InterviewType, EvaluationRecommendation } from '@prisma/client';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Calendar,
  Search,
  Users,
  Eye,
  Star,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Briefcase,
  User,
} from 'lucide-react';

interface InterviewsPageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
    jobId?: string;
    interviewerId?: string;
    search?: string;
  }>;
}

export default async function InterviewsPage({ searchParams }: InterviewsPageProps) {
  const user = await getSession();
  if (!user) return null;

  if (!canViewHiringData(user)) {
    return (
      <ErrorState
        title="Access Denied"
        message="You do not have permission to view organization interviews."
      />
    );
  }

  const params = await searchParams;
  const statusFilter = params.status;
  const typeFilter = params.type;
  const jobIdFilter = params.jobId;
  const interviewerIdFilter = params.interviewerId;
  const searchQuery = params.search?.trim();

  // Multi-tenant isolated query: Strictly derive interviews through Interview -> Application -> Job -> Organization
  const interviews = await prisma.interview.findMany({
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
            ]
          : undefined,
      },
      interviewerId: interviewerIdFilter || undefined,
      status:
        statusFilter && statusFilter !== 'ALL' ? (statusFilter as InterviewStatus) : undefined,
      type:
        typeFilter && typeFilter !== 'ALL' ? (typeFilter as InterviewType) : undefined,
    },
    orderBy: { scheduledAt: 'desc' },
    include: {
      application: {
        include: {
          applicant: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
          job: {
            select: { id: true, title: true, department: true },
          },
        },
      },
      interviewer: {
        select: { id: true, name: true, email: true, role: true },
      },
      evaluation: {
        select: {
          id: true,
          overallScore: true,
          recommendation: true,
          createdAt: true,
        },
      },
    },
  });

  // Fetch filter options strictly for authenticated organization
  const [organizationJobs, organizationInterviewers] = await Promise.all([
    prisma.job.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const statusBadge = (status: InterviewStatus) => {
    switch (status) {
      case InterviewStatus.SCHEDULED:
        return (
          <span className="rounded-md bg-[var(--wp-surface-subtle)] border border-[var(--wp-border)] px-2 py-0.5 text-xs font-bold text-[var(--wp-text)]">
            Scheduled
          </span>
        );
      case InterviewStatus.COMPLETED:
        return (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
            Completed
          </span>
        );
      case InterviewStatus.CANCELLED:
        return (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
            Cancelled
          </span>
        );
      case InterviewStatus.NO_SHOW:
        return (
          <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
            No Show
          </span>
        );
    }
  };

  const recBadge = (rec: EvaluationRecommendation) => {
    switch (rec) {
      case EvaluationRecommendation.STRONGLY_RECOMMEND:
        return (
          <span className="text-xs font-bold text-emerald-600">
            Strongly Recommend
          </span>
        );
      case EvaluationRecommendation.RECOMMEND:
        return (
          <span className="text-xs font-bold text-[var(--wp-text)]">
            Recommend
          </span>
        );
      case EvaluationRecommendation.MAYBE:
        return (
          <span className="text-xs font-bold text-amber-600">
            Hold
          </span>
        );
      case EvaluationRecommendation.DO_NOT_RECOMMEND:
        return (
          <span className="text-xs font-bold text-rose-600">
            Do Not Recommend
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--wp-border)] pb-5">
        <div>
          <h1 className="wp-page-title text-xl font-semibold text-[var(--wp-text)] flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[var(--wp-text)]" />
            Interview Management Center
          </h1>
          <p className="text-sm text-[var(--wp-text-muted)] mt-0.5">
            Coordinate candidate interviews, review schedules, and track evaluation outcomes
          </p>
        </div>
      </div>

      {/* Search & Multi-criteria Filters */}
      <div className="rounded-lg border border-[var(--wp-border)] bg-white p-5 space-y-4">
        <form method="GET" className="grid gap-3 sm:grid-cols-4 items-center">
          {statusFilter && <input type="hidden" aria-label="Status" name="status" value={statusFilter} />}
          {typeFilter && <input type="hidden" name="type" value={typeFilter} />}

          {/* Search Box */}
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--wp-text-muted)]" />
            <input
              type="text"
              aria-label="Search records" name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search candidate name or email..."
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

          {/* Interviewer Filter */}
          <div>
            <select
              name="interviewerId"
              defaultValue={interviewerIdFilter || ''}
              className="w-full rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)] transition"
            >
              <option value="">All Interviewers</option>
              {organizationInterviewers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--tenant-primary)] px-5 py-2.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition"
            >
              Filter
            </button>
            <Link
              href="/dashboard/hiring/interviews"
              className="rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-4 py-2.5 text-sm font-bold text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-slate-100 transition"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-[var(--wp-border)]">
          {['ALL', 'SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'].map((st) => {
            const isActive = (statusFilter || 'ALL') === st;
            return (
              <Link
                key={st}
                href={`/dashboard/hiring/interviews?${new URLSearchParams({
                  ...(searchQuery ? { search: searchQuery } : {}),
                  ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
                  ...(interviewerIdFilter ? { interviewerId: interviewerIdFilter } : {}),
                  ...(typeFilter ? { type: typeFilter } : {}),
                  status: st,
                }).toString()}`}
                className={`rounded-md px-4 py-1.5 text-sm font-bold transition-all ${
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

      {/* Interviews Data Table */}
      <div className="rounded-lg border border-[var(--wp-border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 font-bold">Candidate</th>
                <th className="px-5 py-4 font-bold">Position</th>
                <th className="px-5 py-4 font-bold">Interview Type</th>
                <th className="px-5 py-4 font-bold">Date & Time</th>
                <th className="px-5 py-4 font-bold">Interviewer</th>
                <th className="px-5 py-4 font-bold">Status</th>
                <th className="px-5 py-4 font-bold">Evaluation</th>
                <th className="px-5 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--wp-border)]">
              {interviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Calendar className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-medium">No interviews found matching criteria.</p>
                  </td>
                </tr>
              ) : (
                interviews.map((iv) => {
                  const scheduledDate = new Date(iv.scheduledAt);
                  return (
                    <tr
                      key={iv.id}
                      className="hover:bg-[#F8F9FA]/70 transition"
                    >
                      {/* Candidate */}
                      <td className="px-5 py-4 font-bold text-[var(--wp-text)]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] font-bold text-sm shrink-0">
                            {iv.application.applicant.firstName[0]}
                            {iv.application.applicant.lastName[0]}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/hiring/applicants/${iv.application.id}`}
                              className="hover:underline"
                            >
                              {iv.application.applicant.firstName}{' '}
                              {iv.application.applicant.lastName}
                            </Link>
                            <p className="text-xs font-normal text-[var(--wp-text-muted)]">
                              {iv.application.applicant.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="px-5 py-4 text-[var(--wp-text)]">
                        <p className="font-bold">{iv.application.job.title}</p>
                        <p className="text-xs text-[var(--wp-text-muted)]">{iv.application.job.department}</p>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-4 text-[var(--wp-text)] font-semibold">
                        {iv.type.replace('_', ' ')}
                      </td>

                      {/* Date & Time */}
                      <td className="px-5 py-4 text-[var(--wp-text-muted)]">
                        <p className="font-bold text-[var(--wp-text)]">
                          {scheduledDate.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-[var(--wp-text-muted)]">
                          {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                          ({iv.durationMinutes}m)
                        </p>
                      </td>

                      {/* Interviewer */}
                      <td className="px-5 py-4 text-[var(--wp-text)]">
                        <p className="font-bold">{iv.interviewer.name}</p>
                        <p className="text-xs text-[var(--wp-text-muted)]">
                          {iv.interviewer.role.replace('_', ' ')}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {statusBadge(iv.status)}
                      </td>

                      {/* Evaluation */}
                      <td className="px-5 py-4">
                        {iv.evaluation ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              <span className="font-semibold text-[var(--wp-text)] text-sm">
                                {iv.evaluation.overallScore.toFixed(1)} / 5.0
                              </span>
                            </div>
                            <div className="mt-0.5">
                              {recBadge(iv.evaluation.recommendation)}
                            </div>
                          </div>
                        ) : iv.status === InterviewStatus.COMPLETED ? (
                          <span className="text-xs font-bold text-amber-600">
                            Awaiting Evaluation
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--wp-text-muted)]">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/dashboard/hiring/applicants/${iv.application.id}`}
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
