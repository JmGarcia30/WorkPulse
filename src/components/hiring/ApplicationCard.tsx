'use client';

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
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
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
    <div className="group relative rounded-2xl border border-[#E8EAED] bg-white p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between space-y-3">
      {/* Top Header & Candidate Info */}
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#181A1C] text-white font-bold text-xs shrink-0 shadow-2xs">
              {initials}
            </div>
            <div className="min-w-0 truncate">
              <h4 className="text-xs font-bold text-[#181A1C] truncate group-hover:underline transition">
                {fullName}
              </h4>
              <p className="text-[11px] text-[#6B7280] truncate">
                {application.applicant.email}
              </p>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="rounded-xl bg-[#F8F9FA] p-2.5 border border-[#E8EAED]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#181A1C] truncate">
            <Briefcase className="h-3.5 w-3.5 text-[#6B7280] shrink-0" />
            <span className="truncate">{application.job.title}</span>
          </div>
          <p className="text-[10px] text-[#6B7280] pl-5">
            {application.job.department}
          </p>
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="pt-2 border-t border-[#E8EAED] space-y-2">
        <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {appliedDate}
          </span>
          <span
            className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${config.badgeBg} ${config.badgeText}`}
          >
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/dashboard/hiring/applicants/${application.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-[#E8EAED] bg-[#F8F9FA] px-2.5 py-1.5 text-xs font-bold text-[#181A1C] hover:bg-[#181A1C] hover:text-white transition shadow-2xs"
          >
            <User className="h-3.5 w-3.5" /> View Profile
          </Link>

          {canEditStatus && allowedNext.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDialog(!showDialog)}
              className="inline-flex items-center gap-1 rounded-xl bg-[#181A1C] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2A2E33] transition shrink-0 shadow-2xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md">
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="rounded-full bg-slate-200 p-1 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
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
        </div>
      )}
    </div>
  );
}
