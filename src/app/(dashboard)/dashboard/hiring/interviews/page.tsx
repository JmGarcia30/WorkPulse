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
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            Scheduled
          </span>
        );
      case InterviewStatus.COMPLETED:
        return (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            Completed
          </span>
        );
      case InterviewStatus.CANCELLED:
        return (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Cancelled
          </span>
        );
      case InterviewStatus.NO_SHOW:
        return (
          <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            No Show
          </span>
        );
    }
  };

  const recBadge = (rec: EvaluationRecommendation) => {
    switch (rec) {
      case EvaluationRecommendation.STRONGLY_RECOMMEND:
        return (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            Strongly Recommend
          </span>
        );
      case EvaluationRecommendation.RECOMMEND:
        return (
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
            Recommend
          </span>
        );
      case EvaluationRecommendation.MAYBE:
        return (
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
            Hold
          </span>
        );
      case EvaluationRecommendation.DO_NOT_RECOMMEND:
        return (
          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
            Do Not Recommend
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Interview Management Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Coordinate candidate interviews, review schedules, and track evaluation outcomes
          </p>
        </div>
      </div>

      {/* Search & Multi-criteria Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <form method="GET" className="grid gap-3 sm:grid-cols-4 items-center">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          {typeFilter && <input type="hidden" name="type" value={typeFilter} />}

          {/* Search Box */}
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search candidate name or email..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          {/* Job Filter */}
          <div>
            <select
              name="jobId"
              defaultValue={jobIdFilter || ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Filter
            </button>
            <Link
              href="/dashboard/hiring/interviews"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800">
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
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {st.replace('_', ' ')}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Interviews Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Candidate</th>
                <th className="px-4 py-3.5 font-semibold">Position</th>
                <th className="px-4 py-3.5 font-semibold">Interview Type</th>
                <th className="px-4 py-3.5 font-semibold">Date & Time</th>
                <th className="px-4 py-3.5 font-semibold">Interviewer</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Evaluation</th>
                <th className="px-4 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {interviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Calendar className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
                    <p className="mt-2 text-xs font-medium">No interviews found matching criteria.</p>
                  </td>
                </tr>
              ) : (
                interviews.map((iv) => {
                  const scheduledDate = new Date(iv.scheduledAt);
                  return (
                    <tr
                      key={iv.id}
                      className="hover:bg-slate-50/70 transition dark:hover:bg-slate-950/60"
                    >
                      {/* Candidate */}
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs dark:bg-indigo-950 dark:text-indigo-300 shrink-0">
                            {iv.application.applicant.firstName[0]}
                            {iv.application.applicant.lastName[0]}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/hiring/applicants/${iv.application.id}`}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400"
                            >
                              {iv.application.applicant.firstName}{' '}
                              {iv.application.applicant.lastName}
                            </Link>
                            <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                              {iv.application.applicant.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                        <p className="font-medium">{iv.application.job.title}</p>
                        <p className="text-[11px] text-slate-400">{iv.application.job.department}</p>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                        {iv.type.replace('_', ' ')}
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                        <p className="font-semibold text-slate-900 dark:text-slate-200">
                          {scheduledDate.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                          ({iv.durationMinutes}m)
                        </p>
                      </td>

                      {/* Interviewer */}
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                        <p className="font-medium">{iv.interviewer.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {iv.interviewer.role.replace('_', ' ')}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {statusBadge(iv.status)}
                      </td>

                      {/* Evaluation */}
                      <td className="px-4 py-3.5">
                        {iv.evaluation ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              <span className="font-extrabold text-indigo-700 dark:text-indigo-300 text-xs">
                                {iv.evaluation.overallScore.toFixed(1)} / 5.0
                              </span>
                            </div>
                            <div className="mt-0.5">
                              {recBadge(iv.evaluation.recommendation)}
                            </div>
                          </div>
                        ) : iv.status === InterviewStatus.COMPLETED ? (
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            Awaiting Evaluation
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/dashboard/hiring/applicants/${iv.application.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Profile
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
