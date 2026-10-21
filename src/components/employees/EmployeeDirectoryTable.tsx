'use client';

import React from 'react';
import { EmployeeStatus } from '@prisma/client';
import {
  Users,
  SearchX,
  ChevronRight,
  Clock,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { formatStatusLabel } from '@/lib/ui/format-status';
import { TenantLink } from '@/components/ui/TenantLink';
import type { EmployeeDirectoryItem } from '@/features/employees/queries';

interface EmployeeDirectoryTableProps {
  employees: EmployeeDirectoryItem[];
  hasActiveFilters: boolean;
}

function getInitials(firstName: string, lastName: string): string {
  const f = firstName?.trim() || '';
  const l = lastName?.trim() || '';
  if (!f && !l) return '—';
  if (!l) return f.slice(0, 2).toUpperCase();
  if (!f) return l.slice(0, 2).toUpperCase();
  return `${f[0]}${l[0]}`.toUpperCase();
}

function renderProbationReviewBadge(review: EmployeeDirectoryItem['probationReview']) {
  if (!review) {
    return <span className="text-slate-400">—</span>;
  }

  switch (review.state) {
    case 'OVERDUE_FOR_REVIEW':
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200/80"
          title={`Overdue for review by ${Math.abs(review.daysRemaining)} days`}
        >
          <AlertCircle className="h-3 w-3" />
          Overdue
        </span>
      );
    case 'REVIEW_DUE':
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200/80"
          title="Probation review due today"
        >
          <Clock className="h-3 w-3" />
          Due Today
        </span>
      );
    case 'ENDING_SOON':
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-50/80 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200/60"
          title={`${review.daysRemaining} days remaining in probation period`}
        >
          <Clock className="h-3 w-3" />
          Due Soon ({review.daysRemaining}d)
        </span>
      );
    case 'ACTIVE':
      return (
        <span
          className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200/70"
          title="Currently in probation period"
        >
          In Probation
        </span>
      );
    case 'CLOSED':
      return (
        <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500 border border-slate-200/60">
          Completed
        </span>
      );
    default:
      return <span className="text-slate-400">—</span>;
  }
}

function renderEmployeeStatusBadge(status: EmployeeStatus) {
  switch (status) {
    case EmployeeStatus.ACTIVE:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Active
        </span>
      );
    case EmployeeStatus.INACTIVE:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200/70">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
          Inactive
        </span>
      );
    case EmployeeStatus.SEPARATED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200/70">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
          Separated
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {formatStatusLabel(status)}
        </span>
      );
  }
}

export function EmployeeDirectoryTable({
  employees,
  hasActiveFilters,
}: EmployeeDirectoryTableProps) {
  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 border border-slate-100 mb-3">
          {hasActiveFilters ? <SearchX className="h-6 w-6" /> : <Users className="h-6 w-6" />}
        </div>
        <h3 className="text-sm font-bold text-slate-800">
          {hasActiveFilters ? 'No employees match your search' : 'No employee records'}
        </h3>
        <p className="mt-1 text-xs text-slate-500 max-w-sm">
          {hasActiveFilters
            ? 'Try adjusting your search terms or clearing one or more filters.'
            : 'Active and archived employee records will appear here.'}
        </p>
        {hasActiveFilters && (
          <TenantLink
            href="/dashboard/employees"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            Reset all filters
          </TenantLink>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Desktop Table View (>= md) */}
      <div className="relative hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th scope="col" className="px-5 py-3.5">
                Employee
              </th>
              <th scope="col" className="px-4 py-3.5">
                Employee No.
              </th>
              <th scope="col" className="px-4 py-3.5">
                Department
              </th>
              <th scope="col" className="px-4 py-3.5">
                Category
              </th>
              <th scope="col" className="px-4 py-3.5">
                Employment
              </th>
              <th scope="col" className="px-4 py-3.5">
                Probation Review
              </th>
              <th scope="col" className="px-4 py-3.5">
                Status
              </th>
              <th scope="col" className="px-5 py-3.5 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((employee) => (
              <tr
                key={employee.id}
                className="transition-colors hover:bg-slate-50/70 group"
              >
                {/* Employee Name + Initials Avatar + Email */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200/70">
                      {getInitials(employee.firstName, employee.lastName)}
                    </span>
                    <div className="min-w-0">
                      <TenantLink
                        href={`/dashboard/employees/${employee.id}`}
                        className="font-semibold text-slate-900 hover:text-[var(--tenant-primary)] hover:underline truncate block"
                      >
                        {employee.firstName} {employee.lastName}
                      </TenantLink>
                      <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {employee.email}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Employee Number */}
                <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                  {employee.employeeNumber}
                </td>

                {/* Department */}
                <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap font-medium">
                  {employee.department || '—'}
                </td>

                {/* Category */}
                <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                  {employee.employmentCategory ? formatStatusLabel(employee.employmentCategory) : '—'}
                </td>

                {/* Employment Status / Classification */}
                <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap font-medium">
                  {employee.employmentStatus ? formatStatusLabel(employee.employmentStatus) : '—'}
                </td>

                {/* Probation Review State */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  {renderProbationReviewBadge(employee.probationReview)}
                </td>

                {/* Employee Status */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  {renderEmployeeStatusBadge(employee.employeeStatus)}
                </td>

                {/* View Profile Action */}
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <TenantLink
                    href={`/dashboard/employees/${employee.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
                  >
                    View Profile
                    <ChevronRight className="h-3 w-3 text-slate-400" />
                  </TenantLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (< md) */}
      <div className="md:hidden divide-y divide-slate-100">
        {employees.map((employee) => (
          <div key={employee.id} className="p-4 transition hover:bg-slate-50/50">
            {/* Header: Avatar, Name, Email, Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 ring-1 ring-slate-200/70">
                  {getInitials(employee.firstName, employee.lastName)}
                </span>
                <div className="min-w-0">
                  <TenantLink
                    href={`/dashboard/employees/${employee.id}`}
                    className="text-sm font-semibold text-slate-900 hover:text-[var(--tenant-primary)] transition truncate block"
                  >
                    {employee.firstName} {employee.lastName}
                  </TenantLink>
                  <p className="text-xs text-slate-500 truncate">{employee.email}</p>
                </div>
              </div>
              {renderEmployeeStatusBadge(employee.employeeStatus)}
            </div>

            {/* Details grid */}
            <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4 border-t border-slate-100 pt-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Employee No.</span>
                <span className="font-mono font-semibold text-slate-700">
                  {employee.employeeNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Department</span>
                <span className="font-medium text-slate-700">
                  {employee.department || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Employment</span>
                <span className="font-medium text-slate-700">
                  {employee.employmentCategory && employee.employmentStatus
                    ? `${formatStatusLabel(employee.employmentCategory)} · ${formatStatusLabel(employee.employmentStatus)}`
                    : employee.employmentCategory
                    ? formatStatusLabel(employee.employmentCategory)
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Probation Review</span>
                <div>{renderProbationReviewBadge(employee.probationReview)}</div>
              </div>
            </div>

            {/* Bottom Action: View Profile */}
            <div className="mt-3.5 pt-2 flex justify-end">
              <TenantLink
                href={`/dashboard/employees/${employee.id}`}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
              >
                View Profile
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </TenantLink>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
