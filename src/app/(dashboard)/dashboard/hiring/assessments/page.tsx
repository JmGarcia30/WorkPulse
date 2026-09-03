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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8EAED] pb-5">
        <div>
          <h1 className="text-xl font-black text-[#181A1C] flex items-center gap-2">
            <Award className="h-5 w-5 text-[#181A1C]" />
            Pre-Employment Assessment Center
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Monitor candidate technical tests, skill challenges, and evaluation outcomes
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs space-y-4">
        <form method="GET" className="grid gap-3 sm:grid-cols-4 items-center">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}

          {/* Search Box */}
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#9CA3AF]" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search candidate or title..."
              className="w-full rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] pl-10 pr-3 py-2.5 text-xs font-semibold text-[#181A1C] focus:border-[#181A1C] focus:bg-white focus:ring-1 focus:ring-[#181A1C] transition shadow-2xs"
            />
          </div>

          {/* Job Filter */}
          <div>
            <select
              name="jobId"
              defaultValue={jobIdFilter || ''}
              className="w-full rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] px-3.5 py-2.5 text-xs font-bold text-[#181A1C] focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] transition shadow-2xs"
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
              className="w-full rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] px-3.5 py-2.5 text-xs font-bold text-[#181A1C] focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] transition shadow-2xs"
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
              className="rounded-2xl bg-[#181A1C] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2A2E33] shadow-md transition"
            >
              Filter
            </button>
            <Link
              href="/dashboard/hiring/assessments"
              className="rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] px-4 py-2.5 text-xs font-bold text-[#6B7280] hover:text-[#181A1C] hover:bg-slate-100 transition shadow-2xs"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-[#E8EAED]">
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
                className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-[#181A1C] text-white shadow-sm'
                    : 'bg-[#F8F9FA] text-[#6B7280] hover:text-[#181A1C] hover:bg-slate-100'
                }`}
              >
                {st.replace('_', ' ')}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Assessments Data Table */}
      <div className="rounded-3xl border border-[#E8EAED] bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8EAED] bg-[#F8F9FA] text-[#6B7280] uppercase tracking-wider">
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
            <tbody className="divide-y divide-[#E8EAED]">
              {assessments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[#6B7280]">
                    <Award className="mx-auto h-8 w-8 text-[#9CA3AF]" />
                    <p className="mt-2 text-xs font-semibold">No assessments found matching criteria.</p>
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
                      <td className="px-5 py-4 font-bold text-[#181A1C]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#181A1C] text-white font-bold text-xs shrink-0 shadow-2xs">
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
                            <p className="text-[11px] font-normal text-[#6B7280]">
                              {a.application.applicant.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Assessment Title */}
                      <td className="px-5 py-4 text-[#181A1C] font-semibold max-w-xs truncate">
                        {a.title}
                      </td>

                      {/* Position */}
                      <td className="px-5 py-4 text-[#181A1C]">
                        <p className="font-bold">{a.application.job.title}</p>
                        <p className="text-[11px] text-[#6B7280]">{a.application.job.department}</p>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-xl px-2.5 py-1 text-[10px] font-extrabold ${typeCfg.badgeBg} ${typeCfg.badgeText}`}
                        >
                          {typeCfg.label}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-4 text-[#6B7280] font-medium">
                        {a.dueDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-[#9CA3AF]" />
                            <span>{new Date(a.dueDate).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-[#9CA3AF]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-xl px-3 py-1 text-[10px] font-extrabold ${statusCfg.badgeBg} ${statusCfg.badgeText}`}
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
                            <span className="text-[#181A1C]">
                              {a.score} / {a.maxScore ?? 100} pts
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#9CA3AF] text-[11px]">Pending Score</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/dashboard/hiring/applicants/${a.application.id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#E8EAED] bg-[#F8F9FA] px-3.5 py-1.5 text-xs font-bold text-[#181A1C] hover:bg-[#181A1C] hover:text-white transition shadow-2xs"
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
