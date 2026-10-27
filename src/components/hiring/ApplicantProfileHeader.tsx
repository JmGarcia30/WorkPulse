'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';

interface ApplicantProfileHeaderProps {
  candidateName: string;
  jobTitle: string;
  department: string;
  appliedAt: Date | string;
  stageLabel: string;
  stageBadgeBg?: string;
  stageBadgeText?: string;
  readinessLabel?: string;
  readinessBadgeBg?: string;
  readinessBadgeText?: string;
  backHref?: string;
}

export function ApplicantProfileHeader({
  candidateName,
  jobTitle,
  department,
  appliedAt,
  stageLabel,
  stageBadgeBg = 'bg-slate-100',
  stageBadgeText = 'text-slate-700',
  readinessLabel,
  readinessBadgeBg = 'bg-amber-50',
  readinessBadgeText = 'text-amber-800',
  backHref = '/dashboard/hiring/applicants',
}: ApplicantProfileHeaderProps) {
  const formattedDate = new Date(appliedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-3">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Link
          href="/dashboard"
          className="hover:text-slate-700 transition"
        >
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
        <Link
          href="/dashboard/hiring/pipeline"
          className="hover:text-slate-700 transition"
        >
          Hiring
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
        <Link
          href={backHref}
          className="hover:text-slate-700 transition"
        >
          Applicants
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
        <span className="text-slate-800 font-semibold truncate max-w-[200px] sm:max-w-none">
          {candidateName}
        </span>
      </nav>

      {/* Main Title & Status Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition -ml-1.5"
              title="Back to Applicants list"
              aria-label="Back to Applicants"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {candidateName}
            </h1>

            {/* Stage Badge */}
            <span
              className={`inline-flex items-center gap-1 rounded-[6px] border-none px-2 py-[3px] text-xs font-medium ${stageBadgeBg} ${stageBadgeText}`}
            >
              <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-current" />
              {stageLabel}
            </span>

            {/* Readiness Badge */}
            {readinessLabel && (
              <span
                className={`inline-flex items-center gap-1 rounded-[6px] border-none px-2 py-[3px] text-xs font-medium ${readinessBadgeBg} ${readinessBadgeText}`}
              >
                <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-current" />
                {readinessLabel}
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm text-slate-500">
            Applied for <span className="font-medium text-slate-700">{jobTitle}</span> ({department}) • Applied on {formattedDate}
          </p>
        </div>

        {/* Back Link Button */}
        <div className="shrink-0 flex items-center gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
            <span>Back to Applicants</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
