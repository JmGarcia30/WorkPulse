import React from 'react';

interface MinimalStatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function MinimalStatusBadge({ status, label, className = '' }: MinimalStatusBadgeProps) {
  const normalized = status.toUpperCase();
  const displayLabel = label || status.replace(/_/g, ' ');

  // Semantic color classification with WorkPulse universal soft tints
  let colorStyles = 'bg-[#EEEDF1] text-[#282934]';
  let dotColor = 'bg-[#282934]';

  if (
    normalized.includes('HIRED') ||
    normalized.includes('COMPLETED') ||
    normalized.includes('PASSED') ||
    normalized.includes('ACCEPTED') ||
    normalized.includes('VERIFIED') ||
    normalized.includes('READY')
  ) {
    colorStyles = 'bg-[#E5F5EC] text-[#18794E]';
    dotColor = 'bg-[#18794E]';
  } else if (
    normalized.includes('PROGRESS') ||
    normalized.includes('INTERVIEW') ||
    normalized.includes('ASSESSMENT') ||
    normalized.includes('SHORTLISTED') ||
    normalized.includes('SCREENING') ||
    normalized.includes('SUBMITTED')
  ) {
    colorStyles = 'bg-[#E8EDF9] text-[#245B9E]';
    dotColor = 'bg-[#245B9E]';
  } else if (
    normalized.includes('PENDING') ||
    normalized.includes('REVIEW') ||
    normalized.includes('SCHEDULED') ||
    normalized.includes('DRAFT')
  ) {
    colorStyles = 'bg-[#FFF0D9] text-[#9A6700]';
    dotColor = 'bg-[#9A6700]';
  } else if (
    normalized.includes('REJECTED') ||
    normalized.includes('FAILED') ||
    normalized.includes('DECLINED') ||
    normalized.includes('CANCELLED') ||
    normalized.includes('NO_SHOW')
  ) {
    colorStyles = 'bg-[#FCE8E9] text-[#B42318]';
    dotColor = 'bg-[#B42318]';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[6px] border-none px-2 py-[3px] text-[11px] font-semibold tracking-tight transition-colors ${colorStyles} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}
