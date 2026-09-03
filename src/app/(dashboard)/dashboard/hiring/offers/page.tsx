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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#E8EAED] pb-5">
        <div>
          <h1 className="text-xl font-black text-[#181A1C] flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#181A1C]" />
            Offer & Compensation Management Center
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Track candidate employment packages, salary approvals, and signed agreements
          </p>
        </div>
      </div>

      {/* Search & Multi-criteria Filters */}
      <div className="rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs space-y-4">
        <form method="GET" className="grid gap-3 sm:grid-cols-4 items-center">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}

          {/* Search Box */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#9CA3AF]" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search candidate name, email, or position..."
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

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-2xl bg-[#181A1C] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2A2E33] shadow-md transition"
            >
              Filter
            </button>
            <Link
              href="/dashboard/hiring/offers"
              className="rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] px-4 py-2.5 text-xs font-bold text-[#6B7280] hover:text-[#181A1C] hover:bg-slate-100 transition shadow-2xs"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-[#E8EAED]">
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

      {/* Offers Data Table */}
      <div className="rounded-3xl border border-[#E8EAED] bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8EAED] bg-[#F8F9FA] text-[#6B7280] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 font-bold">Candidate</th>
                <th className="px-5 py-4 font-bold">Position</th>
                <th className="px-5 py-4 font-bold">Base Compensation</th>
                <th className="px-5 py-4 font-bold">Start Date</th>
                <th className="px-5 py-4 font-bold">Offer Status</th>
                <th className="px-5 py-4 font-bold">Created / Approved By</th>
                <th className="px-5 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {offers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#6B7280]">
                    <FileText className="mx-auto h-8 w-8 text-[#9CA3AF]" />
                    <p className="mt-2 text-xs font-semibold">No employment offers found matching criteria.</p>
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
                      className="hover:bg-[#F8F9FA]/70 transition"
                    >
                      {/* Candidate */}
                      <td className="px-5 py-4 font-bold text-[#181A1C]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#181A1C] text-white font-bold text-xs shrink-0 shadow-2xs">
                            {offer.application.applicant.firstName[0]}
                            {offer.application.applicant.lastName[0]}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/hiring/applicants/${offer.application.id}`}
                              className="hover:underline"
                            >
                              {offer.application.applicant.firstName}{' '}
                              {offer.application.applicant.lastName}
                            </Link>
                            <p className="text-[11px] font-normal text-[#6B7280]">
                              {offer.application.applicant.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="px-5 py-4 text-[#181A1C]">
                        <p className="font-bold">{offer.application.job.title}</p>
                        <p className="text-[11px] text-[#6B7280]">{offer.application.job.department}</p>
                      </td>

                      {/* Compensation */}
                      <td className="px-5 py-4 font-bold text-[#181A1C]">
                        ₱{offer.salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[11px] font-normal text-[#6B7280] ml-1">
                          {payFreqCfg.suffix}
                        </span>
                        <p className="text-[10px] font-normal text-[#9CA3AF]">{offer.employmentType}</p>
                      </td>

                      {/* Start Date */}
                      <td className="px-5 py-4 text-[#6B7280] font-medium">
                        <div className="flex items-center gap-1 font-bold text-[#181A1C]">
                          <Calendar className="h-3 w-3 text-[#9CA3AF]" />
                          <span>{new Date(offer.startDate).toLocaleDateString()}</span>
                        </div>
                        {offer.expirationDate && (
                          <p className="text-[10px] text-[#9CA3AF]">
                            Exp: {new Date(offer.expirationDate).toLocaleDateString()}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-xl px-3 py-1 text-[10px] font-extrabold ${statusCfg.badgeBg} ${statusCfg.badgeText}`}
                          >
                            {statusCfg.label}
                          </span>
                          {isActive && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[8px] font-extrabold text-emerald-800">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Created / Approved By */}
                      <td className="px-5 py-4 text-[#181A1C]">
                        <p className="font-bold">{offer.createdBy.name}</p>
                        {offer.approvedBy ? (
                          <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                            <ShieldCheck className="h-3 w-3" /> Approved: {offer.approvedBy.name}
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-600 font-semibold">
                            Awaiting Approval
                          </p>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/dashboard/hiring/applicants/${offer.application.id}`}
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
