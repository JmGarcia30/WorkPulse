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
    borderColor: 'border-[var(--wp-border)]',
  };

  return (
    <div className="w-80 min-w-[280px] shrink-0 flex flex-col rounded-lg border border-[var(--wp-border)] bg-[#F8F9FA]/80 max-h-[80vh] overflow-hidden">
      {/* Column Header */}
      <div className={`p-3.5 border-b border-[var(--wp-border)] bg-white flex items-center justify-between sticky top-0 z-10 border-t-4 ${config.borderColor}`}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--wp-text)]">
            {config.label}
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${config.badgeBg} ${config.badgeText}`}
          >
            {applications.length}
          </span>
        </div>
      </div>

      {/* Candidates Cards Scroll Area */}
      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-[var(--wp-border)] rounded-lg bg-white">
            <Users className="h-7 w-7 text-[var(--wp-text-muted)] mb-2" />
            <p className="text-sm font-semibold text-[var(--wp-text)]">
              No candidates in {config.label}
            </p>
            <p className="text-xs text-[var(--wp-text-muted)] mt-0.5">
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
