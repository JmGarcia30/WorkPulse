'use client';

import { ApplicationStatus } from '@prisma/client';
import { STAGE_CONFIG } from '@/features/hiring/pipeline';
import { ApplicationCard, SerializedApplication } from '@/components/hiring/ApplicationCard';
import { GripVertical, MoreHorizontal, Users } from 'lucide-react';

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
    badgeBg: 'bg-slate-100 border border-slate-200',
    badgeText: 'text-slate-700',
    headerPillBg: 'bg-slate-600',
    headerPillText: 'text-white',
    headerCountBg: 'bg-white',
    headerCountText: 'text-slate-800',
    dotColor: 'bg-slate-400',
    borderColor: 'border-slate-300',
  };

  return (
    <div className="w-[305px] min-w-[305px] shrink-0 flex flex-col rounded-2xl border border-slate-200/80 bg-[#f8f9fb] max-h-[calc(100vh-14rem)] min-h-[520px] overflow-hidden shadow-2xs">
      {/* Column Header */}
      <div className="p-3 border-b border-slate-200/70 bg-white/70 backdrop-blur-xs flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {/* Grip handle icon */}
          <GripVertical className="h-4 w-4 text-slate-300" aria-hidden="true" />

          {/* Stage badge pill matching reference design */}
          <div
            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold shadow-2xs ${config.headerPillBg} ${config.headerPillText}`}
          >
            <span>{config.label}</span>
            <span
              className={`flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[10px] font-bold ${config.headerCountBg} ${config.headerCountText}`}
            >
              {applications.length}
            </span>
          </div>
        </div>

        {/* Right header actions */}
        <div className="flex items-center text-slate-400">
          <span className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer">
            <MoreHorizontal className="h-4 w-4" />
          </span>
        </div>
      </div>

      {/* Candidate Cards Scrollable Area */}
      <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-300">
        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-white/60">
            <Users className="h-6 w-6 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              No candidates
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Stage currently empty
            </p>
          </div>
        ) : (
          applications.map((app) => (
            <ApplicationCard
              key={app.id}
              application={app}
              canEditStatus={canEditStatus}
            />
          ))
        )}
      </div>
    </div>
  );
}
