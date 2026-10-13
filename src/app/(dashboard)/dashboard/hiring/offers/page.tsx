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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--wp-border)] pb-5">
        <div>
          <h1 className="wp-page-title text-xl font-semibold text-[var(--wp-text)] flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--wp-text)]" />
            Offer & Compensation Management Center
          </h1>
          <p className="text-sm text-[var(--wp-text-muted)] mt-0.5">
            Track candidate employment packages, salary approvals, and signed agreements
          </p>
        </div>
      </div>

      {/* Search & Multi-criteria Filters */}
      <div className="rounded-lg border border-[var(--wp-border)] bg-white p-5 space-y-4">
        <form method="GET" className="grid gap-3 sm:grid-cols-4 items-center">
          {statusFilter && <input type="hidden" aria-label="Status" name="status" value={statusFilter} />}

          {/* Search Box */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--wp-text-muted)]" />
            <input
              type="text"
              aria-label="Search records" name="search"
              defaultValue={searchQuery || ''}
              placeholder="Search candidate name, email, or position..."
              className="w-full rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] pl-10 pr-3 py-2.5 text-sm font-semibold text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:bg-white focus:ring-1 focus:ring-[var(--tenant-accent)] transition"
            />
          </div>

          {/* Job Filter */}
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

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--tenant-primary)] px-5 py-2.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition"
            >
              Filter
            </button>
            <Link
              href="/dashboard/hiring/offers"
              className="rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-4 py-2.5 text-sm font-bold text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-slate-100 transition"
            >
              Reset
            </Link>
          </div>
        </form>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-[var(--wp-border)]">
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
                className={`rounded-md px-4 py-1.5 text-sm font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] '
                    : 'bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-slate-100'
                }`}
              >
                {st.replace('_', ' ')}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Offers Data Table */}
      <div className="rounded-lg border border-[var(--wp-border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] uppercase tracking-wider">
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
            <tbody className="divide-y divide-[var(--wp-border)]">
              {offers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[var(--wp-text-muted)]">
                    <FileText className="mx-auto h-8 w-8 text-[var(--wp-text-muted)]" />
                    <p className="mt-2 text-sm font-semibold">No employment offers found matching criteria.</p>
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
                      <td className="px-5 py-4 font-bold text-[var(--wp-text)]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] font-bold text-sm shrink-0">
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
                            <p className="text-xs font-normal text-[var(--wp-text-muted)]">
                              {offer.application.applicant.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="px-5 py-4 text-[var(--wp-text)]">
                        <p className="font-bold">{offer.application.job.title}</p>
                        <p className="text-xs text-[var(--wp-text-muted)]">{offer.application.job.department}</p>
                      </td>

                      {/* Compensation */}
                      <td className="px-5 py-4 font-bold text-[var(--wp-text)]">
                        ₱{offer.salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-[var(--wp-text-muted)] ml-1">
                          {payFreqCfg.suffix}
                        </span>
                        <p className="text-xs font-normal text-[var(--wp-text-muted)]">{offer.employmentType}</p>
                      </td>

                      {/* Start Date */}
                      <td className="px-5 py-4 text-[var(--wp-text-muted)] font-medium">
                        <div className="flex items-center gap-1 font-bold text-[var(--wp-text)]">
                          <Calendar className="h-3 w-3 text-[var(--wp-text-muted)]" />
                          <span>{new Date(offer.startDate).toLocaleDateString()}</span>
                        </div>
                        {offer.expirationDate && (
                          <p className="text-xs text-[var(--wp-text-muted)]">
                            Exp: {new Date(offer.expirationDate).toLocaleDateString()}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-md px-3 py-1 text-xs font-semibold ${statusCfg.badgeBg} ${statusCfg.badgeText}`}
                          >
                            {statusCfg.label}
                          </span>
                          {isActive && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[8px] font-semibold text-emerald-800">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Created / Approved By */}
                      <td className="px-5 py-4 text-[var(--wp-text)]">
                        <p className="font-bold">{offer.createdBy.name}</p>
                        {offer.approvedBy ? (
                          <p className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5">
                            <ShieldCheck className="h-3 w-3" /> Approved: {offer.approvedBy.name}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 font-semibold">
                            Awaiting Approval
                          </p>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/dashboard/hiring/applicants/${offer.application.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3.5 py-1.5 text-sm font-bold text-[var(--wp-text)] hover:bg-[var(--tenant-primary)] hover:text-[var(--tenant-primary-foreground)] transition"
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
