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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Pre-Employment Assessment Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitor candidate technical tests, skill challenges, and evaluation outcomes
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <form method="GET" className="grid gap-3 sm:grid-cols-4 items-center">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}

          {/* Search Box */}
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search candidate or title..."
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

          {/* Type Filter */}
          <div>
            <select
              name="type"
              defaultValue={typeFilter || ''}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
            >
              Filter
            </button>
            <Link
              href="/dashboard/hiring/assessments"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800">
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
                className={`rounded-lg px-3 py-1 text-xs font-medium transition shrink-0 ${
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

      {/* Assessments Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Candidate</th>
                <th className="px-4 py-3.5 font-semibold">Assessment Title</th>
                <th className="px-4 py-3.5 font-semibold">Position</th>
                <th className="px-4 py-3.5 font-semibold">Type</th>
                <th className="px-4 py-3.5 font-semibold">Due Date</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Score / Result</th>
                <th className="px-4 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {assessments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Award className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
                    <p className="mt-2 text-xs font-medium">No assessments found matching criteria.</p>
                  </td>
                </tr>
              ) : (
                assessments.map((a) => {
                  const statusCfg = ASSESSMENT_STAGE_CONFIG[a.status];
                  const typeCfg = ASSESSMENT_TYPE_CONFIG[a.type];
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-slate-50/70 transition dark:hover:bg-slate-950/60"
                    >
                      {/* Candidate */}
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs dark:bg-indigo-950 dark:text-indigo-300 shrink-0">
                            {a.application.applicant.firstName[0]}
                            {a.application.applicant.lastName[0]}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/hiring/applicants/${a.application.id}`}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400"
                            >
                              {a.application.applicant.firstName}{' '}
                              {a.application.applicant.lastName}
                            </Link>
                            <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                              {a.application.applicant.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Assessment Title */}
                      <td className="px-4 py-3.5 text-slate-900 dark:text-slate-100 font-medium max-w-xs truncate">
                        {a.title}
                      </td>

                      {/* Position */}
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                        <p className="font-medium">{a.application.job.title}</p>
                        <p className="text-[11px] text-slate-400">{a.application.job.department}</p>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${typeCfg.badgeBg} ${typeCfg.badgeText}`}
                        >
                          {typeCfg.label}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                        {a.dueDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>{new Date(a.dueDate).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold ${statusCfg.badgeBg} ${statusCfg.badgeText}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Score / Result */}
                      <td className="px-4 py-3.5">
                        {a.score !== null ? (
                          <div className="flex items-center gap-1.5 font-bold">
                            {a.status === AssessmentStatus.PASSED ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-rose-600" />
                            )}
                            <span>
                              {a.score} / {a.maxScore ?? 100} pts
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Pending Score</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/dashboard/hiring/applicants/${a.application.id}`}
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
