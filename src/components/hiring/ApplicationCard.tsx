'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApplicationStatus } from '@prisma/client';
import { STAGE_CONFIG, getAvailableNextStatuses } from '@/features/hiring/pipeline';
import { StatusChangeDialog } from '@/components/hiring/StatusChangeDialog';
import { DialogFrame } from '@/components/ui/DialogFrame';
import { Mail, Calendar, ChevronRight, MoreHorizontal, User, Briefcase } from 'lucide-react';

export interface SerializedApplication {
  id: string;
  status: ApplicationStatus;
  appliedAt: string | Date;
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  job: {
    id: string;
    title: string;
    department: string;
  };
}

interface ApplicationCardProps {
  application: SerializedApplication;
  canEditStatus: boolean;
}

export function ApplicationCard({ application, canEditStatus }: ApplicationCardProps) {
  const [showDialog, setShowDialog] = useState(false);
  const config = STAGE_CONFIG[application.status] || {
    label: application.status,
    badgeBg: 'bg-slate-100 border border-slate-200',
    badgeText: 'text-slate-700',
    dotColor: 'bg-slate-400',
  };

  const allowedNext = getAvailableNextStatuses(application.status);
  const fullName = `${application.applicant.firstName} ${application.applicant.lastName}`;
  const initials = `${application.applicant.firstName[0] || ''}${application.applicant.lastName[0] || ''}`.toUpperCase();

  const appliedDate = new Date(application.appliedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="group relative rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-slate-300 hover:shadow-xs flex flex-col justify-between gap-3">
      {/* Top Header: Avatar, Name, Job, and Action Menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar Circle */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tenant-tint,#f1f5f9)] border border-slate-200/60 font-bold text-xs text-[var(--tenant-primary,#0f766e)] shadow-xs">
            {initials}
          </div>

          {/* Name & Job Title */}
          <div className="min-w-0 flex-1">
            <Link
              href={`/dashboard/hiring/applicants/${application.id}`}
              className="block font-bold text-sm text-slate-900 truncate hover:text-[var(--tenant-primary,#0f766e)] transition-colors"
            >
              {fullName}
            </Link>
            <p className="text-xs text-slate-500 truncate font-normal">
              {application.job.title}
            </p>
          </div>
        </div>

        {/* Quick Action button */}
        {canEditStatus && allowedNext.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDialog(true)}
            aria-label={`Move stage for ${fullName}`}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            title="Move candidate stage"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Contact Details & Metadata */}
      <div className="space-y-1.5 text-xs">
        {/* Email */}
        <div className="flex items-center gap-1.5 text-slate-500 truncate">
          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
          <span className="truncate">{application.applicant.email}</span>
        </div>

        {/* Stage badge and Department */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {/* Subtle Stage Badge */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.badgeBg} ${config.badgeText}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
            <span>{config.label}</span>
          </span>

          {/* Department badge if available */}
          {application.job.department && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200/60 truncate max-w-[130px]">
              <Briefcase className="h-2.5 w-2.5 text-slate-400 shrink-0" />
              <span className="truncate">{application.job.department}</span>
            </span>
          )}
        </div>
      </div>

      {/* Footer: Date & Action Links */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
        {/* Application Date */}
        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 whitespace-nowrap">
          <Calendar className="h-3 w-3" />
          <span>{appliedDate}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <Link
            href={`/dashboard/hiring/applicants/${application.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white hover:border-slate-300 hover:text-slate-900 transition-colors"
          >
            <User className="h-3 w-3 text-slate-400" />
            <span>Profile</span>
          </Link>

          {canEditStatus && allowedNext.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDialog(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--tenant-primary,#0f766e)] px-2.5 py-1 text-xs font-bold text-white hover:brightness-95 transition-all shadow-2xs"
            >
              <span>Move</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Modal Dialog for Stage Transition */}
      {showDialog && (
        <DialogFrame label="Move candidate stage" onClose={() => setShowDialog(false)}>
          <div className="w-full max-w-md">
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="rounded-full bg-slate-100 p-1 text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <StatusChangeDialog
              applicationId={application.id}
              currentStatus={application.status}
              onStatusUpdated={() => setShowDialog(false)}
            />
          </div>
        </DialogFrame>
      )}
    </div>
  );
}
