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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8EAED] pb-5">
        <div>
          <h1 className="text-xl font-black text-[#181A1C]">
            Job Postings
          </h1>
          <p className="text-xs text-[#6B7280]">
            Manage organization recruitment requisitions and career openings
          </p>
        </div>

        {canEdit && (
          <Link
            href="/dashboard/hiring/jobs/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#181A1C] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2A2E33] shadow-md transition"
          >
            <Plus className="h-4 w-4" />
            Create Job Posting
          </Link>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs">
        <form method="GET" className="flex-1 w-full flex items-center gap-2">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#9CA3AF]" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search by job title or department..."
              className="w-full rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] pl-10 pr-4 py-2.5 text-xs font-semibold text-[#181A1C] focus:border-[#181A1C] focus:bg-white focus:ring-1 focus:ring-[#181A1C] transition shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-2xl bg-[#181A1C] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2A2E33] shadow-md transition"
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
                className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#181A1C] text-white shadow-sm'
                    : 'bg-[#F8F9FA] text-[#6B7280] hover:text-[#181A1C] hover:bg-slate-100'
                }`}
              >
                {st}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Jobs Data Table */}
      <div className="rounded-3xl border border-[#E8EAED] bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8EAED] bg-[#F8F9FA] text-[#6B7280] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 font-bold">Job Title</th>
                <th className="px-5 py-4 font-bold">Department</th>
                <th className="px-5 py-4 font-bold">Location</th>
                <th className="px-5 py-4 font-bold">Status</th>
                <th className="px-5 py-4 font-bold">Applicants</th>
                <th className="px-5 py-4 font-bold">Closing Date</th>
                <th className="px-5 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#6B7280]">
                    <Briefcase className="mx-auto h-8 w-8 text-[#9CA3AF]" />
                    <p className="mt-2 text-xs font-semibold">No job postings found.</p>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-[#F8F9FA]/70 transition"
                  >
                    <td className="px-5 py-4 font-bold text-[#181A1C]">
                      <Link
                        href={`/dashboard/hiring/jobs/${job.id}`}
                        className="hover:underline"
                      >
                        {job.title}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-[#181A1C] font-medium">
                      {job.department}
                    </td>
                    <td className="px-5 py-4 text-[#6B7280]">
                      {job.location}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block rounded-xl px-3 py-1 text-[10px] font-extrabold ${
                          job.status === JobStatus.PUBLISHED
                            ? 'bg-emerald-100 text-emerald-800'
                            : job.status === JobStatus.DRAFT
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-[#181A1C]">
                      {job._count.applications}
                    </td>
                    <td className="px-5 py-4 text-[#6B7280] font-medium">
                      {job.closingDate
                        ? new Date(job.closingDate).toLocaleDateString()
                        : 'No deadline'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/hiring/jobs/${job.id}`}
                          className="rounded-xl border border-[#E8EAED] bg-[#F8F9FA] p-2 text-[#181A1C] hover:bg-[#181A1C] hover:text-white transition shadow-2xs"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        {canEdit && (
                          <Link
                            href={`/dashboard/hiring/jobs/${job.id}/edit`}
                            className="rounded-xl border border-[#E8EAED] bg-[#F8F9FA] p-2 text-[#181A1C] hover:bg-[#181A1C] hover:text-white transition shadow-2xs"
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
