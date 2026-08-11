import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canManageJobs } from '@/lib/permissions/rbac';
import { JobStatus } from '@prisma/client';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Briefcase,
} from 'lucide-react';
import { publishJobAction, closeJobAction } from '@/features/hiring/actions';

interface JobsPageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
  }>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const user = await getSession();
  if (!user) return null;

  const params = await searchParams;
  const statusFilter = params.status;
  const searchQuery = params.search?.trim();

  // Multi-tenant isolated jobs lookup
  const jobs = await prisma.job.findMany({
    where: {
      organizationId: user.organizationId,
      status: statusFilter && statusFilter !== 'ALL' ? (statusFilter as JobStatus) : undefined,
      OR: searchQuery
        ? [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { department: { contains: searchQuery, mode: 'insensitive' } },
          ]
        : undefined,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { applications: true } },
    },
  });

  const canEdit = canManageJobs(user);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Job Postings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage organization recruitment requisitions and career openings
          </p>
        </div>

        {canEdit && (
          <Link
            href="/dashboard/hiring/jobs/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            Create Job Posting
          </Link>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <form method="GET" className="flex-1 w-full flex items-center gap-2">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search by job title or department..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          >
            Search
          </button>
        </form>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'PUBLISHED', 'DRAFT', 'CLOSED', 'ARCHIVED'].map((st) => {
            const isActive = (statusFilter || 'ALL') === st;
            return (
              <Link
                key={st}
                href={`/dashboard/hiring/jobs?${new URLSearchParams({
                  ...(searchQuery ? { search: searchQuery } : {}),
                  status: st,
                }).toString()}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {st}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Jobs Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Job Title</th>
                <th className="px-4 py-3.5 font-semibold">Department</th>
                <th className="px-4 py-3.5 font-semibold">Location</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Applicants</th>
                <th className="px-4 py-3.5 font-semibold">Closing Date</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <Briefcase className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
                    <p className="mt-2 text-xs font-medium">No job postings found.</p>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50/70 transition dark:hover:bg-slate-950/60"
                  >
                    <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                      <Link
                        href={`/dashboard/hiring/jobs/${job.id}`}
                        className="hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {job.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                      {job.department}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                      {job.location}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          job.status === JobStatus.PUBLISHED
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : job.status === JobStatus.DRAFT
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">
                      {job._count.applications}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                      {job.closingDate
                        ? new Date(job.closingDate).toLocaleDateString()
                        : 'No deadline'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/hiring/jobs/${job.id}`}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        {canEdit && (
                          <Link
                            href={`/dashboard/hiring/jobs/${job.id}/edit`}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                            title="Edit Job"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
