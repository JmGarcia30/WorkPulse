'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApplicationStatus } from '@prisma/client';
import { ACTIVE_PIPELINE_STAGES, TERMINAL_STAGES } from '@/features/hiring/pipeline';
import { ApplicationPipelineColumn } from '@/components/hiring/ApplicationPipelineColumn';
import { SerializedApplication } from '@/components/hiring/ApplicationCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Filter, Users, Layers, AlertOctagon } from 'lucide-react';

interface JobOption {
  id: string;
  title: string;
  department: string;
}

interface ApplicationPipelineProps {
  jobs: JobOption[];
  applications: SerializedApplication[];
  selectedJobId?: string;
  canEditStatus: boolean;
}

export function ApplicationPipeline({
  jobs,
  applications,
  selectedJobId,
  canEditStatus,
}: ApplicationPipelineProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'TERMINAL'>('ACTIVE');

  const handleJobChange = (jobId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (jobId) {
      params.set('jobId', jobId);
    } else {
      params.delete('jobId');
    }
    router.push(`/dashboard/hiring/pipeline?${params.toString()}`);
  };

  // Group applications by status
  const applicationsByStatus = applications.reduce<Record<string, SerializedApplication[]>>(
    (acc, app) => {
      if (!acc[app.status]) {
        acc[app.status] = [];
      }
      acc[app.status].push(app);
      return acc;
    },
    {}
  );

  const activeTotalCount = ACTIVE_PIPELINE_STAGES.reduce(
    (sum, st) => sum + (applicationsByStatus[st]?.length || 0),
    0
  );

  const terminalTotalCount = TERMINAL_STAGES.reduce(
    (sum, st) => sum + (applicationsByStatus[st]?.length || 0),
    0
  );

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No active job postings"
        description="Create and publish job postings to start receiving and evaluating candidate applications."
        actionLabel="Create First Job Posting"
        actionHref="/dashboard/hiring/jobs/new"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-[var(--wp-border)] bg-white p-4">
        {/* Job Filter Selector */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] shrink-0">
            <Filter className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 sm:min-w-[240px]">
            <label htmlFor="pipeline-job-filter" className="block text-xs font-semibold text-[var(--wp-text-muted)] uppercase tracking-wider">
              Filter by Position
            </label>
            <select
              id="pipeline-job-filter"
              value={selectedJobId || ''}
              onChange={(e) => handleJobChange(e.target.value)}
              className="w-full mt-0.5 rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3 py-1.5 text-sm font-bold text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            >
              <option value="">All Positions ({jobs.length} Jobs)</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} ({job.department})
                </option>
              ))}
            </select>
          </div>
        </div>

        { /* Workspace controls */ }
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-[var(--wp-surface-subtle)] p-1 border border-[var(--wp-border)]">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')} aria-pressed={activeTab === 'ACTIVE'}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${
              activeTab === 'ACTIVE'
                ? 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] '
                : 'text-[var(--wp-text-muted)] hover:text-[var(--wp-text)]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Active Pipeline</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === 'ACTIVE'
                  ? 'bg-[#22C55E] text-white'
                  : 'bg-[#E5E7EB] text-[var(--wp-text-muted)]'
              }`}
            >
              {activeTotalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TERMINAL')} aria-pressed={activeTab === 'TERMINAL'}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all ${
              activeTab === 'TERMINAL'
                ? 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] '
                : 'text-[var(--wp-text-muted)] hover:text-[var(--wp-text)]'
            }`}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            <span>Other Applications</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === 'TERMINAL'
                  ? 'bg-[#EF4444] text-white'
                  : 'bg-[#E5E7EB] text-[var(--wp-text-muted)]'
              }`}
            >
              {terminalTotalCount}
            </span>
          </button>
        </div>
      </div>

      {/* Main Kanban Content Area */}
      {applications.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates yet"
          description="Applications submitted for this organization's jobs will appear here in the hiring pipeline."
        />
      ) : activeTab === 'ACTIVE' ? (
        /* Horizontally Scrollable Active Kanban Board (7 Columns) */
        <div className="overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-slate-300">
          <div className="flex gap-4 min-w-max">
            {ACTIVE_PIPELINE_STAGES.map((status) => (
              <ApplicationPipelineColumn
                key={status}
                status={status}
                applications={applicationsByStatus[status] || []}
                canEditStatus={canEditStatus}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Terminal Applications (Rejected & Withdrawn) Section */
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Terminal Applications Archive
            </h3>
            <p className="text-sm text-slate-500">
              Candidates who have been rejected or withdrawn from active recruitment
            </p>
          </div>

          <div className="overflow-x-auto pb-6">
            <div className="flex gap-4 min-w-max">
              {TERMINAL_STAGES.map((status) => (
                <ApplicationPipelineColumn
                  key={status}
                  status={status}
                  applications={applicationsByStatus[status] || []}
                  canEditStatus={canEditStatus}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
