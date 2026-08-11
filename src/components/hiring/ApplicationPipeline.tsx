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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {/* Job Filter Selector */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 shrink-0">
            <Filter className="h-4 w-4" />
          </div>
          <div className="min-w-[220px]">
            <label htmlFor="pipeline-job-filter" className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Filter by Position
            </label>
            <select
              id="pipeline-job-filter"
              value={selectedJobId || ''}
              onChange={(e) => handleJobChange(e.target.value)}
              className="w-full mt-0.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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

        {/* Pipeline Tab Switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'ACTIVE'
                ? 'bg-white text-indigo-700 shadow-xs dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Active Pipeline</span>
            <span className="rounded-full bg-indigo-100 px-2 py-0.2 text-[10px] text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              {activeTotalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TERMINAL')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              activeTab === 'TERMINAL'
                ? 'bg-white text-rose-700 shadow-xs dark:bg-slate-900 dark:text-rose-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            <span>Other Applications</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.2 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
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
        <div className="overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
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
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Terminal Applications Archive
            </h3>
            <p className="text-xs text-slate-500">
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
