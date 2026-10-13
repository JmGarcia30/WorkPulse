import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HiringPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel?: string;
  baseUrl: string;
  searchParams?: Record<string, string | undefined>;
}

export function HiringPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel = 'applicants',
  baseUrl,
  searchParams = {},
}: HiringPaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  function createPageUrl(pageNumber: number): string {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && k !== 'page') {
        params.set(k, v);
      }
    });
    if (pageNumber > 1) {
      params.set('page', pageNumber.toString());
    }
    const query = params.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
  }

  // Generate page numbers window (e.g. 1 2 3 ... 10)
  const pages: Array<number | 'dots'> = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (currentPage > 3) {
      pages.push('dots');
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) {
      pages.push('dots');
    }
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/80 text-xs text-slate-500 font-medium">
      {/* Items count summary */}
      <p className="tabular-nums">
        Showing <span className="font-semibold text-slate-800">{startItem}–{endItem}</span> of{' '}
        <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
      </p>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <nav aria-label="Pagination Navigation" className="flex items-center gap-1.5">
          {/* Previous Page Link */}
          {currentPage > 1 ? (
            <Link
              href={createPageUrl(currentPage - 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Link>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-1.5 font-semibold text-slate-400 cursor-not-allowed opacity-60"
              aria-disabled="true"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </span>
          )}

          {/* Numbered Page Buttons */}
          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === 'dots') {
                return (
                  <span key={`dots-${idx}`} className="px-1.5 text-slate-400 select-none">
                    …
                  </span>
                );
              }
              const isCurrent = p === currentPage;
              return isCurrent ? (
                <span
                  key={p}
                  aria-current="page"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--tenant-primary)] font-bold text-[var(--tenant-primary-foreground)] shadow-2xs tabular-nums"
                >
                  {p}
                </span>
              ) : (
                <Link
                  key={p}
                  href={createPageUrl(p)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs tabular-nums"
                  aria-label={`Page ${p}`}
                >
                  {p}
                </Link>
              );
            })}
          </div>

          {/* Next Page Link */}
          {currentPage < totalPages ? (
            <Link
              href={createPageUrl(currentPage + 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
              aria-label="Next page"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-1.5 font-semibold text-slate-400 cursor-not-allowed opacity-60"
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
