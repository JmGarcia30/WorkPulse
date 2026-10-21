import Link from 'next/link';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { getJobList, JOB_PAGE_SIZE } from '@/features/hiring/job-list';
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
    page?: string;
  }>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const user = await requireBackOfficeContext();

  const { jobs, totalCount, totalPages, page, status, search: searchQuery } = await getJobList(user.organizationId, await searchParams);
  const statusFilter = status || 'ALL';
  const pageUrl = (target: number) => '/dashboard/hiring/jobs?' + new URLSearchParams({ ...(searchQuery ? { search: searchQuery } : {}), status: statusFilter, page: String(target) });

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
            {totalCount} Positions
          </span>
        }
        description="Manage organization recruitment requisitions and career openings"
        actions={
          canEdit ? (
            <Link
              href="/dashboard/hiring/jobs/new"
              className="inline-flex w-full justify-center sm:w-auto items-center gap-2 rounded-xl bg-[var(--tenant-primary)] px-4 py-2 text-xs sm:text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>Create Job Posting</span>
            </Link>
          ) : undefined
        }
      />

      {/* Search & Filter Bar */}
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface)] p-4 xl:flex-row xl:items-center">
        <form method="GET" className="flex min-w-0 w-full flex-1 flex-wrap items-center gap-2">
          {statusFilter && <input type="hidden" aria-label="Status" name="status" value={statusFilter} />}
          <div className="relative min-w-0 flex-1">
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
        <div className="flex w-full flex-wrap items-center gap-1.5 xl:w-auto">
          {['ALL', 'PUBLISHED', 'DRAFT', 'CLOSED', 'ARCHIVED'].map((st) => {
            const isActive = (statusFilter || 'ALL') === st;
            return (
              <Link
                key={st}
                href={`/dashboard/hiring/jobs?${new URLSearchParams({
                  ...(searchQuery ? { search: searchQuery } : {}),
                  status: st,
                }).toString()}`}
                className={`rounded-md px-3 py-2 text-xs sm:text-sm font-bold transition-colors ${
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

      {/* Mobile cards use the same records and permissions as the desktop table. */}
      <div className="divide-y divide-[var(--wp-border)] overflow-hidden rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface)] md:hidden">
        {jobs.length === 0 ? <p className="p-8 text-center text-sm text-[var(--wp-text-muted)]">No job postings found.</p> : jobs.map(job => <article key={job.id} aria-label={job.title} className="min-w-0 space-y-4 p-4">
          <div className="space-y-2">
            <Link href={`/dashboard/hiring/jobs/${job.id}`} className="block font-bold text-[var(--wp-text)] [overflow-wrap:anywhere] hover:underline">{job.title}</Link>
            <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${job.status === JobStatus.PUBLISHED ? 'bg-emerald-100 text-emerald-800' : job.status === JobStatus.DRAFT ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{job.status}</span>
          </div>
          <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-xs">
            {([['Department', job.department], ['Location', job.location], ['Applicants', job._count.applications], ['Closing date', job.closingDate ? new Date(job.closingDate).toLocaleDateString() : 'No deadline']] as const).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[var(--wp-text-muted)]">{label}</dt><dd className="mt-1 font-medium text-[var(--wp-text)] [overflow-wrap:anywhere]">{value}</dd></div>)}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/hiring/jobs/${job.id}`} className="inline-flex items-center gap-2 rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3 py-2 text-xs font-semibold"><Eye className="h-4 w-4" aria-hidden="true" />View Details</Link>
            {canEdit && <Link href={`/dashboard/hiring/jobs/${job.id}/edit`} className="inline-flex items-center gap-2 rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3 py-2 text-xs font-semibold"><Edit className="h-4 w-4" aria-hidden="true" />Edit Job</Link>}
          </div>
        </article>)}
      </div>
      {/* Jobs Data Table */}
      <div className="hidden rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface)] overflow-hidden md:block">
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
                    <td className="min-w-40 max-w-64 px-5 py-4 font-bold text-[var(--wp-text)] [overflow-wrap:anywhere]">
                      <Link
                        href={`/dashboard/hiring/jobs/${job.id}`}
                        className="hover:underline"
                      >
                        {job.title}
                      </Link>
                    </td>
                    <td className="max-w-40 px-5 py-4 text-[var(--wp-text)] font-medium [overflow-wrap:anywhere]">
                      {job.department}
                    </td>
                    <td className="max-w-40 px-5 py-4 text-[var(--wp-text-muted)] [overflow-wrap:anywhere]">
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
      <div className="flex flex-col flex-wrap items-center justify-between gap-3 text-xs text-[var(--wp-text-muted)] sm:flex-row">
        <p>{totalCount ? `Showing ${(page - 1) * JOB_PAGE_SIZE + 1}?${Math.min(page * JOB_PAGE_SIZE, totalCount)} of ${totalCount} positions` : '0 positions'}</p>
        {totalPages > 1 && <nav aria-label="Job pagination" className="flex max-w-full flex-wrap items-center justify-center gap-2">
          {page > 1 ? <Link href={pageUrl(page - 1)} className="rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface)] px-3 py-2">Previous</Link> : <span aria-disabled="true" className="px-3 py-2 opacity-50">Previous</span>}
          <span aria-current="page">Page {page} of {totalPages}</span>
          {page < totalPages ? <Link href={pageUrl(page + 1)} className="rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface)] px-3 py-2">Next</Link> : <span aria-disabled="true" className="px-3 py-2 opacity-50">Next</span>}
        </nav>}
      </div>
    </div>
  );
}
