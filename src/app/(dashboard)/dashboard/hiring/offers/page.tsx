import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData } from '@/lib/permissions/rbac';
import { OfferStatus } from '@prisma/client';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  OFFER_STAGE_CONFIG,
  PAY_FREQUENCY_CONFIG,
  isActiveOfferStatus,
} from '@/features/hiring/offer-pipeline';
import {
  FileText,
  Search,
  Eye,
  Calendar,
  DollarSign,
  User,
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface OffersPageProps {
  searchParams: Promise<{
    status?: string;
    jobId?: string;
    search?: string;
  }>;
}

export default async function OffersPage({ searchParams }: OffersPageProps) {
  const user = await getSession();
  if (!user) return null;

  if (!canViewHiringData(user)) {
    return (
      <ErrorState
        title="Access Denied"
        message="You do not have permission to view organization employment offers."
      />
    );
  }

  const params = await searchParams;
  const statusFilter = params.status;
  const jobIdFilter = params.jobId;
  const searchQuery = params.search?.trim();

  // Multi-tenant query: Derive offers via Offer -> Application -> Job -> Organization
  const offers = await prisma.offer.findMany({
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
      status:
        statusFilter && statusFilter !== 'ALL' ? (statusFilter as OfferStatus) : undefined,
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
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
      approvedBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  // Fetch filter options strictly for authenticated organization
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
            <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Offer & Compensation Management Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track candidate employment packages, salary approvals, and signed agreements
          </p>
        </div>
      </div>

      {/* Search & Multi-criteria Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <form method="GET" className="grid gap-3 sm:grid-cols-4 items-center">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}

          {/* Search Box */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search candidate name, email, or position..."
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

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
            >
              Filter
            </button>
            <Link
              href="/dashboard/hiring/offers"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800">
          {['ALL', ...Object.values(OfferStatus)].map((st) => {
            const isActive = (statusFilter || 'ALL') === st;
            return (
              <Link
                key={st}
                href={`/dashboard/hiring/offers?${new URLSearchParams({
                  ...(searchQuery ? { search: searchQuery } : {}),
                  ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
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

      {/* Offers Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Candidate</th>
                <th className="px-4 py-3.5 font-semibold">Position</th>
                <th className="px-4 py-3.5 font-semibold">Base Compensation</th>
                <th className="px-4 py-3.5 font-semibold">Start Date</th>
                <th className="px-4 py-3.5 font-semibold">Offer Status</th>
                <th className="px-4 py-3.5 font-semibold">Created / Approved By</th>
                <th className="px-4 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {offers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <FileText className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
                    <p className="mt-2 text-xs font-medium">No employment offers found matching criteria.</p>
                  </td>
                </tr>
              ) : (
                offers.map((offer) => {
                  const statusCfg = OFFER_STAGE_CONFIG[offer.status];
                  const payFreqCfg = PAY_FREQUENCY_CONFIG[offer.payFrequency];
                  const isActive = isActiveOfferStatus(offer.status);

                  return (
                    <tr
                      key={offer.id}
                      className="hover:bg-slate-50/70 transition dark:hover:bg-slate-950/60"
                    >
                      {/* Candidate */}
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs dark:bg-indigo-950 dark:text-indigo-300 shrink-0">
                            {offer.application.applicant.firstName[0]}
                            {offer.application.applicant.lastName[0]}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/hiring/applicants/${offer.application.id}`}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400"
                            >
                              {offer.application.applicant.firstName}{' '}
                              {offer.application.applicant.lastName}
                            </Link>
                            <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                              {offer.application.applicant.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                        <p className="font-medium">{offer.application.job.title}</p>
                        <p className="text-[11px] text-slate-400">{offer.application.job.department}</p>
                      </td>

                      {/* Compensation */}
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                        ₱{offer.salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[11px] font-normal text-slate-500 ml-1">
                          {payFreqCfg.suffix}
                        </span>
                        <p className="text-[10px] font-normal text-slate-400">{offer.employmentType}</p>
                      </td>

                      {/* Start Date */}
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-200">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{new Date(offer.startDate).toLocaleDateString()}</span>
                        </div>
                        {offer.expirationDate && (
                          <p className="text-[10px] text-slate-400">
                            Exp: {new Date(offer.expirationDate).toLocaleDateString()}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold ${statusCfg.badgeBg} ${statusCfg.badgeText}`}
                          >
                            {statusCfg.label}
                          </span>
                          {isActive && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[8px] font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Created / Approved By */}
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                        <p className="font-medium">{offer.createdBy.name}</p>
                        {offer.approvedBy ? (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                            <ShieldCheck className="h-3 w-3" /> Approved: {offer.approvedBy.name}
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400">
                            Awaiting Approval
                          </p>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/dashboard/hiring/applicants/${offer.application.id}`}
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
