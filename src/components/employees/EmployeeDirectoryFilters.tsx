'use client';

import React from 'react';
import { Search, RotateCcw, Filter } from 'lucide-react';
import { EmployeeStatus, EmploymentCategory } from '@prisma/client';
import { formatStatusLabel } from '@/lib/ui/format-status';
import { TenantLink } from '@/components/ui/TenantLink';

interface EmployeeDirectoryFiltersProps {
  initialSearch?: string;
  initialCategory?: string;
  initialStatus?: string;
  initialNeedsReview?: boolean;
}

export function EmployeeDirectoryFilters({
  initialSearch = '',
  initialCategory = '',
  initialStatus = '',
  initialNeedsReview = false,
}: EmployeeDirectoryFiltersProps) {
  const hasActiveFilters = Boolean(
    initialSearch || initialCategory || initialStatus || initialNeedsReview
  );

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
      <form method="GET" className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
          {/* Search Input with properly centered icon */}
          <div className="relative sm:col-span-2 lg:col-span-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              name="search"
              aria-label="Search records"
              defaultValue={initialSearch}
              placeholder="Search name, email, or employee number..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 transition hover:border-slate-300 focus:border-[var(--tenant-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)]"
            />
          </div>

          {/* Category Filter */}
          <div className="lg:col-span-2">
            <select
              name="category"
              aria-label="Employment category"
              defaultValue={initialCategory}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 transition hover:border-slate-300 focus:border-[var(--tenant-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)]"
            >
              <option value="">All categories</option>
              <option value={EmploymentCategory.TEACHING}>Teaching</option>
              <option value={EmploymentCategory.NON_TEACHING}>Non-Teaching</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-2">
            <select
              name="status"
              aria-label="Status"
              defaultValue={initialStatus}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 transition hover:border-slate-300 focus:border-[var(--tenant-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)]"
            >
              <option value="">All statuses</option>
              {Object.values(EmployeeStatus).map((value) => (
                <option key={value} value={value}>
                  {formatStatusLabel(value)}
                </option>
              ))}
            </select>
          </div>

          {/* Needs Probation Review Filter */}
          <div className="lg:col-span-2">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer select-none transition hover:border-slate-300">
              <input
                type="checkbox"
                name="needsReview"
                value="1"
                defaultChecked={initialNeedsReview}
                className="h-4 w-4 rounded border-slate-300 text-[var(--tenant-primary)] focus:ring-[var(--tenant-primary)]"
              />
              <span className="truncate">Needs review</span>
            </label>
          </div>

          {/* Action Buttons: Filter & Reset */}
          <div className="flex items-center gap-2 lg:col-span-2 sm:col-span-2 lg:justify-end">
            <button
              type="submit"
              className="inline-flex h-10 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg bg-[var(--tenant-primary)] px-4 text-xs sm:text-sm font-semibold text-[var(--tenant-primary-foreground)] shadow-xs transition hover:brightness-95 active:translate-y-px"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filter</span>
            </button>

            {hasActiveFilters && (
              <TenantLink
                href="/dashboard/employees"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
                title="Clear all active filters"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden sm:inline">Reset</span>
              </TenantLink>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
