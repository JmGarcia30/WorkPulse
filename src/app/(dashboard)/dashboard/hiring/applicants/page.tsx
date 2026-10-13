import { formatStatusLabel } from '@/lib/ui/format-status';
import Link from 'next/link';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { ApplicationStatus } from '@prisma/client';
import {
  Users,
  Search,
  Filter,
  FileText,
  Eye,
  Calendar,
  Briefcase,
  Paperclip,
} from 'lucide-react';

interface ApplicantsPageProps {
  searchParams: Promise<{
    status?: string;
    jobId?: string;
    search?: string;
  }>;
}

export default async function ApplicantsPage({ searchParams }: ApplicantsPageProps) {
  const user = await requireBackOfficeContext();

  const params = await searchParams;
  const statusFilter = params.status;
  const jobIdFilter = params.jobId;
  const searchQuery = params.search?.trim();

  // Multi-tenant isolated query: Derive applicants strictly through Organization -> Job -> Application
  const applications = await prisma.application.findMany({
    where: {
      job: {
        organizationId: user.organizationId,
        id: jobIdFilter || undefined,
      },
      status:
        statusFilter && statusFilter !== 'ALL' ? (statusFilter as ApplicationStatus) : undefined,
      OR: searchQuery
        ? [
            { applicant: { firstName: { contains: searchQuery, mode: 'insensitive' } } },
            { applicant: { lastName: { contains: searchQuery, mode: 'insensitive' } } },
            { applicant: { email: { contains: searchQuery, mode: 'insensitive' } } },
          ]
        : undefined,
    },
    orderBy: { appliedAt: 'desc' },
    include: {
      job: { select: { id: true, title: true, department: true } },
      applicant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      documents: { select: { id: true, fileName: true } },
    },
  });

  // Fetch job dropdown options for current organization
  const organizationJobs = await prisma.job.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="wp-page-title text-xl font-bold text-slate-900">
            Candidate Applicants
          </h1>
          <p className="text-sm text-slate-500">
            Track and evaluate candidate applications across organization postings
          </p>
        </div>
      </div>

      {/* Search & Filters Bar */}
      {/* Filters Bar */}
      <div className="rounded-lg border border-[var(--wp-border)] bg-white p-5 space-y-4">
        <form method="GET" className="grid gap-3 sm:grid-cols-3 items-center">
          {statusFilter && <input type="hidden" aria-label="Status" name="status" value={statusFilter} />}

          <div className="relative sm:col-span-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--wp-text-muted)]" />
            <input
              type="text"
              aria-label="Search records" name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search by candidate name or email..."
              className="w-full rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] pl-10 pr-3 py-2.5 text-sm font-semibold text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:bg-white focus:ring-1 focus:ring-[var(--tenant-accent)] transition"
            />
          </div>

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

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--tenant-primary)] px-5 py-2.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition"
            >
              Filter Applicants
            </button>
            <Link
              href="/dashboard/hiring/applicants"
              className="rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-4 py-2.5 text-sm font-bold text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-slate-100 transition"
            >
              Reset
            </Link>
          </div>
        </form>

        { /* Workspace controls */ }
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-[var(--wp-border)]">
          {['ALL', ...Object.values(ApplicationStatus)].map((st) => {
            const isActive = (statusFilter || 'ALL') === st;
            return (
              <Link
                key={st === 'ALL' ? 'All stages' : formatStatusLabel(st)}
                href={`/dashboard/hiring/applicants?${new URLSearchParams({
                  ...(searchQuery ? { search: searchQuery } : {}),
                  ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
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

      {/* Applicants Data Table */}
      <div className="rounded-lg border border-[var(--wp-border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 font-bold">Applicant</th>
                <th className="px-5 py-4 font-bold">Applied Position</th>
                <th className="px-5 py-4 font-bold">Status</th>
                <th className="px-5 py-4 font-bold">Resume</th>
                <th className="px-5 py-4 font-bold">Applied Date</th>
                <th className="px-5 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--wp-border)]">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[var(--wp-text-muted)]">
                    <Users className="mx-auto h-8 w-8 text-[var(--wp-text-muted)]" />
                    <p className="mt-2 text-sm font-semibold">No candidate applications found.</p>
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-[#F8F9FA]/70 transition"
                  >
                    <td className="px-5 py-4 font-bold text-[var(--wp-text)]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] font-bold text-sm shrink-0">
                          {app.applicant.firstName[0]}
                          {app.applicant.lastName[0]}
                        </div>
                        <div>
                          <Link
                            href={`/dashboard/hiring/applicants/${app.id}`}
                            className="hover:underline"
                          >
                            {app.applicant.firstName} {app.applicant.lastName}
                          </Link>
                          <p className="text-xs font-normal text-[var(--wp-text-muted)]">
                            {app.applicant.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--wp-text)]">
                      <p className="font-bold">{app.job.title}</p>
                      <p className="text-xs text-[var(--wp-text-muted)]">{app.job.department}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block rounded-md px-3 py-1 text-xs font-semibold ${
                          app.status === ApplicationStatus.SHORTLISTED || app.status === ApplicationStatus.HIRED || app.status === ApplicationStatus.OFFER
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.status === ApplicationStatus.SCREENING
                            ? 'bg-slate-800 text-white'
                            : app.status === ApplicationStatus.APPLIED
                            ? 'bg-[var(--wp-surface-subtle)] text-[var(--wp-text)] border border-[var(--wp-border)]'
                            : app.status === ApplicationStatus.REJECTED
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[var(--wp-text-muted)]">
                      {app.documents.length > 0 ? (
                        <div className="flex items-center gap-1 text-[#16A34A] font-semibold">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="text-xs">Resume Attached</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--wp-text-muted)]">No file</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[var(--wp-text-muted)] font-medium">
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/hiring/applicants/${app.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3.5 py-1.5 text-sm font-bold text-[var(--wp-text)] hover:bg-[var(--tenant-primary)] hover:text-[var(--tenant-primary-foreground)] transition"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detail →
                      </Link>
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
