'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Plus,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { PayrollDashboardEntryItem } from '@/features/payroll/queries';
import { formatStatusLabel } from '@/lib/ui/format-status';
import { TenantLink } from '@/components/ui/TenantLink';

interface EmployeePayrollEntriesTableProps {
  entries: PayrollDashboardEntryItem[];
  selectedPeriodName?: string;
  isPeriodFinalized: boolean;
}

export function EmployeePayrollEntriesTable({
  entries,
  selectedPeriodName,
  isPeriodFinalized,
}: EmployeePayrollEntriesTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [reviewFilter, setReviewFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        `${entry.firstName} ${entry.lastName}`.toLowerCase().includes(query) ||
        entry.employeeNumber.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'ALL' || entry.status === statusFilter;

      const matchesReview =
        reviewFilter === 'ALL' || entry.reviewState === reviewFilter;

      return matchesSearch && matchesStatus && matchesReview;
    });
  }, [entries, searchQuery, statusFilter, reviewFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getInitials = (first: string, last: string) => {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
      {/* 1. Header with Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--tenant-primary,#0f766e)]" />
            Employee Payroll Entries
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Computed earnings, attendance snapshots, deductions, and official payslips.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 w-44 sm:w-56 rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 text-xs placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-hidden transition"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs hover:border-slate-300 focus:border-slate-900 focus:outline-hidden transition"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="REVIEW">Review</option>
            <option value="FINALIZED">Finalized</option>
          </select>

          {/* Review Filter */}
          <select
            value={reviewFilter}
            onChange={(e) => {
              setReviewFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs hover:border-slate-300 focus:border-slate-900 focus:outline-hidden transition"
          >
            <option value="ALL">All Review States</option>
            <option value="READY">Ready</option>
            <option value="SETUP_REQUIRED">Setup Required</option>
            <option value="CALCULATION_ERROR">Calculation Error</option>
          </select>
        </div>
      </div>

      {/* 2. Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-3.5 py-3">Employee</th>
              <th className="px-3 py-3">Compensation</th>
              <th className="px-3 py-3">Attendance & Leave</th>
              <th className="px-3 py-3 text-right">Gross Pay</th>
              <th className="px-3 py-3 text-right">Deductions</th>
              <th className="px-3 py-3 text-right">Net Pay</th>
              <th className="px-3 py-3 text-center">Status</th>
              <th className="px-3 py-3 text-center">Review</th>
              <th className="px-3.5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedEntries.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                    <div className="rounded-full bg-slate-100 p-3 text-slate-400 mb-3">
                      <FileText className="h-6 w-6" />
                    </div>
                    {entries.length === 0 ? (
                      !selectedPeriodName ? (
                        <>
                          <p className="text-sm font-semibold text-slate-800">
                            No payroll period created
                          </p>
                          <p className="text-xs text-slate-400 mt-1 text-center">
                            Create a payroll period first to establish cut-off schedules and calculate employee payroll entries.
                          </p>
                          <TenantLink
                            href="/dashboard/payroll?tab=processing"
                            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tenant-primary,#0f766e)] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:opacity-95 transition"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Create Payroll Period</span>
                          </TenantLink>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-slate-800">
                            No payroll entries generated
                          </p>
                          <p className="text-xs text-slate-400 mt-1 text-center">
                            Payroll entries have not been calculated yet for {selectedPeriodName}.
                          </p>
                          <TenantLink
                            href="/dashboard/payroll?tab=processing"
                            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tenant-primary,#0f766e)] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:opacity-95 transition"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Generate Payroll Entries</span>
                          </TenantLink>
                        </>
                      )
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-slate-800">
                          No matching payroll entries
                        </p>
                        <p className="text-xs text-slate-400 mt-1 text-center">
                          No employee payroll records match your active search or filter criteria.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('ALL');
                            setReviewFilter('ALL');
                            setCurrentPage(1);
                          }}
                          className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Reset filters</span>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedEntries.map((entry) => {
                const initials = getInitials(entry.firstName, entry.lastName);

                return (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition">
                    {/* Employee Identity */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {entry.firstName} {entry.lastName}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {entry.employeeNumber}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Compensation details */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="font-medium text-slate-800">
                        {entry.baseRateFormatted}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {formatStatusLabel(entry.compensationType)} · {formatStatusLabel(entry.payFrequency)}
                      </span>
                    </td>

                    {/* Attendance & Leave Snapshot */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {entry.attendanceSummary ? (
                        <div className="text-[11px] text-slate-600">
                          <span>
                            {entry.attendanceSummary.presentDays ?? 0} present · {entry.attendanceSummary.absentDays ?? 0} absent
                          </span>
                          {(entry.attendanceSummary.lateOccurrences ?? 0) > 0 && (
                            <span className="block text-amber-700 font-medium">
                              {entry.attendanceSummary.lateOccurrences} late
                            </span>
                          )}
                          {entry.leaveSummary && (entry.leaveSummary.approvedDays ?? 0) > 0 && (
                            <span className="block text-blue-600">
                              {entry.leaveSummary.approvedDays}d approved leave
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Snapshot unrecorded</span>
                      )}
                    </td>

                    {/* Gross */}
                    <td className="px-3 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                      {entry.grossAmountFormatted}
                    </td>

                    {/* Deductions */}
                    <td className="px-3 py-3 text-right font-medium text-amber-700 whitespace-nowrap">
                      {entry.totalDeductionsFormatted}
                    </td>

                    {/* Net Pay */}
                    <td className="px-3 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {entry.netAmountFormatted}
                    </td>

                    {/* Entry Status */}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        entry.status === 'FINALIZED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : entry.status === 'REVIEW'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {formatStatusLabel(entry.status)}
                      </span>
                    </td>

                    {/* Review State */}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {entry.reviewState === 'READY' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle className="h-3 w-3" />
                          Ready
                        </span>
                      ) : (
                        <span
                          title={entry.issueMessage ?? 'Attention needed'}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            entry.reviewState === 'SETUP_REQUIRED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {formatStatusLabel(entry.reviewState)}
                        </span>
                      )}
                    </td>

                    {/* Action: Payslip / Breakdown */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      {entry.canViewPayslip ? (
                        <TenantLink
                          href={`/dashboard/payroll/payslips/${entry.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                        >
                          <span>Payslip</span>
                        </TenantLink>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">
                          {isPeriodFinalized ? '—' : 'Unfinalized'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <p>
            Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-800">
              {Math.min(currentPage * pageSize, filteredEntries.length)}
            </span>{' '}
            of <span className="font-semibold text-slate-800">{filteredEntries.length}</span> entries
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => handlePageChange(page)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition ${
                  currentPage === page
                    ? 'bg-slate-900 text-white font-bold'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
