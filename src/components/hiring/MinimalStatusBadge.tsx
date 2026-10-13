import React from 'react';

interface MinimalStatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function MinimalStatusBadge({ status, label, className = '' }: MinimalStatusBadgeProps) {
  const normalized = status.toUpperCase();
  const displayLabel = label || status.replace(/_/g, ' ');

  // Semantic color classification with low saturation (less color!)
  let colorStyles = 'bg-slate-100 text-slate-700 border-slate-200/80';
  let dotColor = 'bg-slate-400';

  if (
    normalized.includes('HIRED') ||
    normalized.includes('COMPLETED') ||
    normalized.includes('PASSED') ||
    normalized.includes('ACCEPTED') ||
    normalized.includes('VERIFIED') ||
    normalized.includes('READY')
  ) {
    colorStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    dotColor = 'bg-emerald-500';
  } else if (
    normalized.includes('PENDING') ||
    normalized.includes('REVIEW') ||
    normalized.includes('SCHEDULED') ||
    normalized.includes('SUBMITTED') ||
    normalized.includes('PROGRESS') ||
    normalized.includes('INTERVIEW') ||
    normalized.includes('ASSESSMENT') ||
    normalized.includes('SHORTLISTED') ||
    normalized.includes('SCREENING') ||
    normalized.includes('DRAFT')
  ) {
    colorStyles = 'bg-amber-50 text-amber-700 border-amber-200/80';
    dotColor = 'bg-amber-500';
  } else if (
    normalized.includes('REJECTED') ||
    normalized.includes('FAILED') ||
    normalized.includes('DECLINED') ||
    normalized.includes('CANCELLED') ||
    normalized.includes('NO_SHOW')
  ) {
    colorStyles = 'bg-rose-50 text-rose-700 border-rose-200/80';
    dotColor = 'bg-rose-500';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight transition ${colorStyles} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}
