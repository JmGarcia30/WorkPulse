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
      {/* Filters Bar */}
      <div className="rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs space-y-4">
        <form method="GET" className="grid gap-3 sm:grid-cols-3 items-center">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}

          <div className="relative sm:col-span-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#9CA3AF]" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search by candidate name or email..."
              className="w-full rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] pl-10 pr-3 py-2.5 text-xs font-semibold text-[#181A1C] focus:border-[#181A1C] focus:bg-white focus:ring-1 focus:ring-[#181A1C] transition shadow-2xs"
            />
          </div>

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

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-2xl bg-[#181A1C] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2A2E33] shadow-md transition"
            >
              Filter Applicants
            </button>
            <Link
              href="/dashboard/hiring/applicants"
              className="rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] px-4 py-2.5 text-xs font-bold text-[#6B7280] hover:text-[#181A1C] hover:bg-slate-100 transition shadow-2xs"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* Status Pills (matching reference image pill tabs) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-[#E8EAED]">
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

      {/* Applicants Data Table */}
      <div className="rounded-3xl border border-[#E8EAED] bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8EAED] bg-[#F8F9FA] text-[#6B7280] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 font-bold">Applicant</th>
                <th className="px-5 py-4 font-bold">Applied Position</th>
                <th className="px-5 py-4 font-bold">Status</th>
                <th className="px-5 py-4 font-bold">Resume</th>
                <th className="px-5 py-4 font-bold">Applied Date</th>
                <th className="px-5 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#6B7280]">
                    <Users className="mx-auto h-8 w-8 text-[#9CA3AF]" />
                    <p className="mt-2 text-xs font-semibold">No candidate applications found.</p>
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-[#F8F9FA]/70 transition"
                  >
                    <td className="px-5 py-4 font-bold text-[#181A1C]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#181A1C] text-white font-bold text-xs shrink-0 shadow-2xs">
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
                          <p className="text-[11px] font-normal text-[#6B7280]">
                            {app.applicant.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#181A1C]">
                      <p className="font-bold">{app.job.title}</p>
                      <p className="text-[11px] text-[#6B7280]">{app.job.department}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block rounded-xl px-3 py-1 text-[10px] font-extrabold ${
                          app.status === ApplicationStatus.SHORTLISTED || app.status === ApplicationStatus.HIRED || app.status === ApplicationStatus.OFFER
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.status === ApplicationStatus.SCREENING
                            ? 'bg-slate-800 text-white'
                            : app.status === ApplicationStatus.APPLIED
                            ? 'bg-blue-100 text-blue-800'
                            : app.status === ApplicationStatus.REJECTED
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#6B7280]">
                      {app.documents.length > 0 ? (
                        <div className="flex items-center gap-1 text-[#16A34A] font-semibold">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="text-[11px]">Resume Attached</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#9CA3AF]">No file</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[#6B7280] font-medium">
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/hiring/applicants/${app.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#E8EAED] bg-[#F8F9FA] px-3.5 py-1.5 text-xs font-bold text-[#181A1C] hover:bg-[#181A1C] hover:text-white transition shadow-2xs"
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
