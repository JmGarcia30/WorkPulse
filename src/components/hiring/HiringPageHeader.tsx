import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface HiringPageHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function HiringPageHeader({
  breadcrumbs,
  title,
  description,
  badge,
  actions,
  className = '',
  children,
}: HiringPageHeaderProps) {
  return (
    <div className={`flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="space-y-1 min-w-0">
        {/* Simple Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" aria-hidden="true" />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-slate-700 transition truncate max-w-[200px]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-600 font-semibold truncate max-w-[240px]" aria-current="page">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Title & Badge */}
        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
          {typeof title === 'string' ? (
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
          ) : (
            title
          )}
          {badge}
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}

      {children}
    </div>
  );
}
