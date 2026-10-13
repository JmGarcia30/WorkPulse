'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

import { useState } from 'react';
import Link from 'next/link';
import { ApplicationStatus } from '@prisma/client';
import { STAGE_CONFIG, getAvailableNextStatuses } from '@/features/hiring/pipeline';
import { StatusChangeDialog } from '@/components/hiring/StatusChangeDialog';
import { Calendar, ArrowRight, User, Briefcase, ChevronRight } from 'lucide-react';

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
    badgeBg: 'bg-slate-100 ',
    badgeText: 'text-slate-700 ',
  };

  const allowedNext = getAvailableNextStatuses(application.status);
  const fullName = `${application.applicant.firstName} ${application.applicant.lastName}`;
  const initials = `${application.applicant.firstName[0] || ''}${application.applicant.lastName[0] || ''}`;
  const appliedDate = new Date(application.appliedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="group relative rounded-lg border border-[var(--wp-border)] bg-white p-4 hover:shadow-sm transition-all flex flex-col justify-between space-y-3">
      {/* Top Header & Candidate Info */}
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] font-bold text-sm shrink-0">
              {initials}
            </div>
            <div className="min-w-0 truncate">
              <h4 className="text-sm font-bold text-[var(--wp-text)] truncate group-hover:underline transition">
                {fullName}
              </h4>
              <p className="text-xs text-[var(--wp-text-muted)] truncate">
                {application.applicant.email}
              </p>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="rounded-md bg-[var(--wp-surface-subtle)] p-2.5 border border-[var(--wp-border)]">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--wp-text)] truncate">
            <Briefcase className="h-3.5 w-3.5 text-[var(--wp-text-muted)] shrink-0" />
            <span className="truncate">{application.job.title}</span>
          </div>
          <p className="text-xs text-[var(--wp-text-muted)] pl-5">
            {application.job.department}
          </p>
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="pt-2 border-t border-[var(--wp-border)] space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--wp-text-muted)]">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {appliedDate}
          </span>
          <span
            className={`rounded-lg px-2 py-0.5 text-xs font-bold ${config.badgeBg} ${config.badgeText}`}
          >
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/dashboard/hiring/applicants/${application.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-2.5 py-1.5 text-sm font-bold text-[var(--wp-text)] hover:bg-[var(--tenant-primary)] hover:text-[var(--tenant-primary-foreground)] transition"
          >
            <User className="h-3.5 w-3.5" /> View Profile
          </Link>

          {canEditStatus && allowedNext.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDialog(!showDialog)}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--tenant-primary)] px-3 py-1.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition shrink-0"
              title="Move Candidate Stage"
            >
              <span>Move</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Modal Dialog for Quick Move */}
      {showDialog && (
        <DialogFrame label="Move candidate stage" onClose={() => setShowDialog(false)}>
          <div className="w-full max-w-md">
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="rounded-full bg-slate-200 p-1 text-slate-700 hover:bg-slate-300"
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
