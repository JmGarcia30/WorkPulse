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
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    borderColor: 'border-slate-200 dark:border-slate-800',
  };

  return (
    <div className="w-80 min-w-[280px] shrink-0 flex flex-col rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50 max-h-[80vh] overflow-hidden shadow-2xs">
      {/* Column Header */}
      <div className={`p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between sticky top-0 z-10 border-t-4 ${config.borderColor}`}>
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
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
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/40 dark:bg-slate-950/20">
            <Users className="h-7 w-7 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              No candidates in {config.label}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
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
