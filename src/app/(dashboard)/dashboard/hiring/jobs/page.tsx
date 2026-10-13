import Link from 'next/link';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { canManageJobs } from '@/lib/permissions/rbac';
import { JobStatus } from '@prisma/client';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Briefcase,
} from 'lucide-react';
import { HiringPageHeader } from '@/components/hiring/HiringPageHeader';

interface JobsPageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
  }>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const user = await requireBackOfficeContext();

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
      {/* Header with Breadcrumb and Title */}
      <HiringPageHeader
        breadcrumbs={[
          { label: 'Hiring', href: '/dashboard/hiring/pipeline' },
          { label: 'Job Openings' },
        ]}
        title="Job Postings"
        badge={
          <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-700 border border-slate-200/80 tabular-nums">
            {jobs.length} Positions
          </span>
        }
        description="Manage organization recruitment requisitions and career openings"
        actions={
          canEdit ? (
            <Link
              href="/dashboard/hiring/jobs/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--tenant-primary)] px-4 py-2 text-xs sm:text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>Create Job Posting</span>
            </Link>
          ) : undefined
        }
      />

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-[var(--wp-border)] bg-white p-5">
        <form method="GET" className="flex-1 w-full flex items-center gap-2">
          {statusFilter && <input type="hidden" aria-label="Status" name="status" value={statusFilter} />}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--wp-text-muted)]" />
            <input
              type="text"
              aria-label="Search records" name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search by job title or department..."
              className="w-full rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] pl-10 pr-4 py-2.5 text-sm font-semibold text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:bg-white focus:ring-1 focus:ring-[var(--tenant-accent)] transition"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[var(--tenant-primary)] px-5 py-2.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition"
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
                className={`rounded-md px-4 py-1.5 text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] '
                    : 'bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-slate-100'
                }`}
              >
                {st}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Jobs Data Table */}
      <div className="rounded-lg border border-[var(--wp-border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] uppercase tracking-wider">
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
            <tbody className="divide-y divide-[var(--wp-border)]">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[var(--wp-text-muted)]">
                    <Briefcase className="mx-auto h-8 w-8 text-[var(--wp-text-muted)]" />
                    <p className="mt-2 text-sm font-semibold">No job postings found.</p>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-[#F8F9FA]/70 transition"
                  >
                    <td className="px-5 py-4 font-bold text-[var(--wp-text)]">
                      <Link
                        href={`/dashboard/hiring/jobs/${job.id}`}
                        className="hover:underline"
                      >
                        {job.title}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-[var(--wp-text)] font-medium">
                      {job.department}
                    </td>
                    <td className="px-5 py-4 text-[var(--wp-text-muted)]">
                      {job.location}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block rounded-md px-3 py-1 text-xs font-semibold ${
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
                    <td className="px-5 py-4 font-bold text-[var(--wp-text)]">
                      {job._count.applications}
                    </td>
                    <td className="px-5 py-4 text-[var(--wp-text-muted)] font-medium">
                      {job.closingDate
                        ? new Date(job.closingDate).toLocaleDateString()
                        : 'No deadline'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/hiring/jobs/${job.id}`}
                          className="rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] p-2 text-[var(--wp-text)] hover:bg-[var(--tenant-primary)] hover:text-[var(--tenant-primary-foreground)] transition"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        {canEdit && (
                          <Link
                            href={`/dashboard/hiring/jobs/${job.id}/edit`}
                            className="rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] p-2 text-[var(--wp-text)] hover:bg-[var(--tenant-primary)] hover:text-[var(--tenant-primary-foreground)] transition"
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
