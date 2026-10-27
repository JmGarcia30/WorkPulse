import React from 'react';
import Link from 'next/link';
import { Search, RotateCcw } from 'lucide-react';

export interface FilterPill {
  label: string;
  count: number;
  value: string;
  isActive: boolean;
  href: string;
}

export interface HiringFilterToolbarProps {
  searchQuery?: string;
  selectedJobId?: string;
  selectedStatus?: string;
  selectedSort?: string;
  jobs?: Array<{ id: string; title: string; department?: string }>;
  statuses?: Array<{ value: string; label: string }>;
  sortOptions?: Array<{ value: string; label: string }>;
  metricPills?: FilterPill[];
  searchPlaceholder?: string;
  baseUrl: string;
}

export function HiringFilterToolbar({
  searchQuery = '',
  selectedJobId = '',
  selectedStatus = '',
  selectedSort = 'newest',
  jobs = [],
  statuses = [],
  sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'name_asc', label: 'Name A–Z' },
    { value: 'name_desc', label: 'Name Z–A' },
  ],
  metricPills,
  searchPlaceholder = 'Search applicants by name, role, or email...',
  baseUrl,
}: HiringFilterToolbarProps) {
  const hasActiveFilters = Boolean(
    searchQuery ||
    (selectedJobId && selectedJobId !== 'ALL') ||
    (selectedStatus && selectedStatus !== 'ALL') ||
    (selectedSort && selectedSort !== 'newest')
  );

  return (
    <div className="space-y-3.5">
      {/* Metric Stage Pills (matching SAGA reference top row) */}
      {metricPills && metricPills.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {metricPills.map((pill) => (
            <Link
              key={pill.value}
              href={pill.href}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition shadow-2xs whitespace-nowrap ${pill.isActive
                  ? 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)]'
                  : 'bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
            >
              <span>{pill.label}</span>
              <span
                className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${pill.isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                  }`}
              >
                {pill.count}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Main Filter Toolbar Controls */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
        <form method="GET" action={baseUrl} className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-[var(--tenant-primary)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)] transition"
              aria-label="Search candidates"
            />
          </div>

          {/* Job/Position Dropdown */}
          {jobs.length > 0 && (
            <div className="sm:w-44">
              <select
                name="jobId"
                defaultValue={selectedJobId}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 focus:border-[var(--tenant-primary)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)] transition"
                aria-label="Filter by position"
              >
                <option value="">All Positions</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Dropdown */}
          {statuses.length > 0 && (
            <div className="sm:w-36">
              <select
                name="status"
                defaultValue={selectedStatus}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 focus:border-[var(--tenant-primary)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)] transition"
                aria-label="Filter by status"
              >
                <option value="">All Statuses</option>
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="sm:w-36">
            <select
              name="sort"
              defaultValue={selectedSort}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 focus:border-[var(--tenant-primary)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)] transition"
              aria-label="Sort order"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Submit & Reset Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="submit"
              className="rounded-xl bg-[var(--tenant-primary)] px-3.5 py-2 text-xs font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition shadow-2xs"
            >
              Filter
            </button>
            {hasActiveFilters && (
              <Link
                href={baseUrl}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                title="Reset all filters"
                aria-label="Reset filters"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </Link>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
