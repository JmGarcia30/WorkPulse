import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
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
  const user = await getSession();
  if (!user) return null;

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
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Candidate Applicants
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track and evaluate candidate applications across organization postings
          </p>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <form method="GET" className="grid gap-3 sm:grid-cols-3 items-center">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}

          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search by candidate name or email..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

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

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Filter Applicants
            </button>
            <Link
              href="/dashboard/hiring/applicants"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800">
          {['ALL', 'APPLIED', 'SCREENING', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN'].map((st) => {
            const isActive = (statusFilter || 'ALL') === st;
            return (
              <Link
                key={st}
                href={`/dashboard/hiring/applicants?${new URLSearchParams({
                  ...(searchQuery ? { search: searchQuery } : {}),
                  ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
                  status: st,
                }).toString()}`}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
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

      {/* Applicants Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Applicant</th>
                <th className="px-4 py-3.5 font-semibold">Applied Position</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Resume</th>
                <th className="px-4 py-3.5 font-semibold">Applied Date</th>
                <th className="px-4 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
                    <p className="mt-2 text-xs font-medium">No candidate applications found.</p>
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-slate-50/70 transition dark:hover:bg-slate-950/60"
                  >
                    <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs dark:bg-indigo-950 dark:text-indigo-300 shrink-0">
                          {app.applicant.firstName[0]}
                          {app.applicant.lastName[0]}
                        </div>
                        <div>
                          <Link
                            href={`/dashboard/hiring/applicants/${app.id}`}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            {app.applicant.firstName} {app.applicant.lastName}
                          </Link>
                          <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            {app.applicant.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                      <p className="font-medium">{app.job.title}</p>
                      <p className="text-[11px] text-slate-400">{app.job.department}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          app.status === ApplicationStatus.SHORTLISTED
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : app.status === ApplicationStatus.SCREENING
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : app.status === ApplicationStatus.APPLIED
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : app.status === ApplicationStatus.REJECTED
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {app.documents.length > 0 ? (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="text-[11px]">Resume Attached</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">No file</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/dashboard/hiring/applicants/${app.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                      >
                        <Eye className="h-3.5 w-3.5" /> View Profile
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
