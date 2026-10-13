import React from 'react';
import Link from 'next/link';
import { Briefcase, Calendar, CheckCircle2, ChevronRight, FileText, ArrowRight } from 'lucide-react';
import { MinimalStatusBadge } from './MinimalStatusBadge';

export interface CandidateCardProps {
  id: string;
  name: string;
  position: string;
  email: string;
  department?: string;
  appliedDate?: string;
  status: string;
  statusLabel?: string;
  workflowInfo?: string;
  workflowIcon?: 'document' | 'calendar' | 'checklist' | 'award';
  avatarInitials: string;
  isSelected?: boolean;
  onSelect: () => void;
  profileHref: string;
}

export function CandidateCard({
  name,
  position,
  email,
  department,
  appliedDate,
  status,
  statusLabel,
  workflowInfo,
  workflowIcon = 'checklist',
  avatarInitials,
  isSelected = false,
  onSelect,
  profileHref,
}: CandidateCardProps) {
  const getWorkflowIcon = () => {
    switch (workflowIcon) {
      case 'document':
        return <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
      case 'calendar':
        return <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
      case 'checklist':
      default:
        return <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-4.5 transition-all cursor-pointer ${
        isSelected
          ? 'border-[var(--tenant-primary)] ring-2 ring-[var(--tenant-primary)]/20 bg-slate-50/40 shadow-xs'
          : 'border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={isSelected}
    >
      {/* Top Row: Avatar & Candidate Info */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Avatar Circle */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-xs text-slate-700 border border-slate-200/60 uppercase">
            {avatarInitials}
          </div>

          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-900 group-hover:text-[var(--tenant-primary)] transition truncate">
              {name}
            </h3>
            <p className="text-xs font-medium text-slate-600 truncate mt-0.5">
              {position}
            </p>
            <p className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
              {email}
            </p>
          </div>
        </div>

        {/* Selected indicator or quick chevron */}
        <div className="shrink-0 pt-0.5">
          <ChevronRight
            className={`h-4 w-4 transition ${
              isSelected ? 'text-[var(--tenant-primary)] translate-x-0.5' : 'text-slate-300 group-hover:text-slate-500'
            }`}
          />
        </div>
      </div>

      {/* Middle Row: Status Badge */}
      <div className="mt-3.5">
        <MinimalStatusBadge status={status} label={statusLabel} />
      </div>

      {/* Body Metadata: Department & Applied Date */}
      <div className="mt-3.5 space-y-1.5 text-xs text-slate-500 font-medium">
        {department && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{department}</span>
          </div>
        )}

        {appliedDate && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{appliedDate}</span>
          </div>
        )}

        {workflowInfo && (
          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100 font-normal text-slate-700">
            {getWorkflowIcon()}
            <span className="truncate text-[11px] font-medium">{workflowInfo}</span>
          </div>
        )}
      </div>

      {/* Card Footer: View Profile link */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400">
          Click card to inspect
        </span>
        <Link
          href={profileHref}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-[var(--tenant-primary)] transition"
        >
          <span>View Profile</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
