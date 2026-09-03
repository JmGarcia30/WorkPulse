'use client';

import { ApplicationStatus } from '@prisma/client';
import { STAGE_CONFIG } from '@/features/hiring/pipeline';
import { ApplicationCard, SerializedApplication } from '@/components/hiring/ApplicationCard';
import { Users } from 'lucide-react';

interface ApplicationPipelineColumnProps {
  status: ApplicationStatus;
  applications: SerializedApplication[];
  canEditStatus: boolean;
}

export function ApplicationPipelineColumn({
  status,
  applications,
  canEditStatus,
}: ApplicationPipelineColumnProps) {
  const config = STAGE_CONFIG[status] || {
    label: status,
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    borderColor: 'border-[#E8EAED]',
  };

  return (
    <div className="w-80 min-w-[280px] shrink-0 flex flex-col rounded-3xl border border-[#E8EAED] bg-[#F8F9FA]/80 max-h-[80vh] overflow-hidden shadow-2xs">
      {/* Column Header */}
      <div className={`p-3.5 border-b border-[#E8EAED] bg-white flex items-center justify-between sticky top-0 z-10 border-t-4 ${config.borderColor}`}>
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#181A1C]">
            {config.label}
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${config.badgeBg} ${config.badgeText}`}
          >
            {applications.length}
          </span>
        </div>
      </div>

      {/* Candidates Cards Scroll Area */}
      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-[#E8EAED] rounded-2xl bg-white">
            <Users className="h-7 w-7 text-[#9CA3AF] mb-2" />
            <p className="text-xs font-semibold text-[#181A1C]">
              No candidates in {config.label}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              No candidates are currently in this stage.
            </p>
          </div>
        ) : (
          applications.map((app) => (
            <ApplicationCard key={app.id} application={app} canEditStatus={canEditStatus} />
          ))
        )}
      </div>
    </div>
  );
}
