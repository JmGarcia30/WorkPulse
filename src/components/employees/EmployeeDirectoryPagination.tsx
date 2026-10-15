'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TenantLink } from '@/components/ui/TenantLink';

interface EmployeeDirectoryPaginationProps {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    search?: string;
    category?: string;
    status?: string;
    needsReview?: boolean;
  };
}

export function EmployeeDirectoryPagination({
  totalCount,
  page,
  pageSize,
  totalPages,
  filters,
}: EmployeeDirectoryPaginationProps) {
  if (totalCount === 0) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  function getPageUrl(targetPage: number): string {
    const sp = new URLSearchParams();
    if (filters.search) sp.set('search', filters.search);
    if (filters.category) sp.set('category', filters.category);
    if (filters.status) sp.set('status', filters.status);
    if (filters.needsReview) sp.set('needsReview', '1');
    if (targetPage > 1) sp.set('page', targetPage.toString());
    const qs = sp.toString();
    return qs ? `/dashboard/employees?${qs}` : '/dashboard/employees';
  }

  // Generate page numbers
  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (page > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push('ellipsis');
    }
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
      {/* Summary label */}
      <p>
        Showing <span className="font-semibold text-slate-800">{startItem}</span>–
        <span className="font-semibold text-slate-800">{endItem}</span> of{' '}
        <span className="font-semibold text-slate-800">{totalCount}</span>{' '}
        {totalCount === 1 ? 'employee' : 'employees'}
      </p>

      {/* Controls */}
      {totalPages > 1 && (
        <nav aria-label="Pagination Navigation" className="inline-flex items-center gap-1.5">
          {/* Previous Button */}
          {page > 1 ? (
            <TenantLink
              href={getPageUrl(page - 1)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Go to previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </TenantLink>
          ) : (
            <span
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2.5 text-xs font-medium text-slate-300 cursor-not-allowed select-none"
              aria-disabled="true"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </span>
          )}

          {/* Page numbers */}
          <div className="hidden sm:inline-flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex h-8 w-8 items-center justify-center text-xs text-slate-400 select-none"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = p === page;
              return isCurrent ? (
                <span
                  key={p}
                  className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--tenant-primary)] px-2 text-xs font-bold text-[var(--tenant-primary-foreground)] shadow-xs"
                  aria-current="page"
                >
                  {p}
                </span>
              ) : (
                <TenantLink
                  key={p}
                  href={getPageUrl(p)}
                  className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label={`Go to page ${p}`}
                >
                  {p}
                </TenantLink>
              );
            })}
          </div>

          {/* Current page indicator on small screens */}
          <span className="sm:hidden text-xs font-medium text-slate-600 px-2">
            Page {page} of {totalPages}
          </span>

          {/* Next Button */}
          {page < totalPages ? (
            <TenantLink
              href={getPageUrl(page + 1)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Go to next page"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </TenantLink>
          ) : (
            <span
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2.5 text-xs font-medium text-slate-300 cursor-not-allowed select-none"
              aria-disabled="true"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
