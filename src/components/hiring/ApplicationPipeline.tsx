'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ACTIVE_PIPELINE_STAGES, TERMINAL_STAGES } from '@/features/hiring/pipeline';
import { ApplicationPipelineColumn } from '@/components/hiring/ApplicationPipelineColumn';
import { SerializedApplication } from '@/components/hiring/ApplicationCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search, Briefcase, Layers, Archive, Users } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');

  const handleJobChange = (jobId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (jobId) {
      params.set('jobId', jobId);
    } else {
      params.delete('jobId');
    }
    router.push(`/dashboard/hiring/pipeline?${params.toString()}`);
  };

  // Filter applications by search query
  const filteredApplications = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return applications;
    return applications.filter((app) => {
      const name = `${app.applicant.firstName} ${app.applicant.lastName}`.toLowerCase();
      const email = app.applicant.email.toLowerCase();
      const job = app.job.title.toLowerCase();
      const dept = (app.job.department || '').toLowerCase();
      return name.includes(q) || email.includes(q) || job.includes(q) || dept.includes(q);
    });
  }, [applications, searchQuery]);

  // Group filtered applications by status
  const applicationsByStatus = useMemo(() => {
    return filteredApplications.reduce<Record<string, SerializedApplication[]>>(
      (acc, app) => {
        if (!acc[app.status]) {
          acc[app.status] = [];
        }
        acc[app.status].push(app);
        return acc;
      },
      {}
    );
  }, [filteredApplications]);

  const activeTotalCount = useMemo(() => {
    return ACTIVE_PIPELINE_STAGES.reduce(
      (sum, st) => sum + (applicationsByStatus[st]?.length || 0),
      0
    );
  }, [applicationsByStatus]);

  const terminalTotalCount = useMemo(() => {
    return TERMINAL_STAGES.reduce(
      (sum, st) => sum + (applicationsByStatus[st]?.length || 0),
      0
    );
  }, [applicationsByStatus]);

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
    <div className="space-y-4">
      {/* Top Filter & Control Bar inspired by reference header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        {/* Left Side: Search & Position Filter */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Live Search Input */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidates or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none transition-colors"
            />
          </div>

          {/* Job Filter Selector */}
          <div className="relative flex items-center min-w-[220px]">
            <Briefcase className="absolute left-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <select
              id="pipeline-job-filter"
              aria-label="Filter candidates by position"
              value={selectedJobId || ''}
              onChange={(e) => handleJobChange(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-3 text-xs font-semibold text-slate-700 focus:bg-white focus:border-slate-400 focus:outline-none cursor-pointer transition-colors"
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

        {/* Right Side: Tab Pills for Active vs Other Applications */}
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/80 p-1 border border-slate-200/60 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            aria-pressed={activeTab === 'ACTIVE'}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'ACTIVE'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Active Pipeline</span>
            <span
              className={`rounded-[6px] px-1.5 py-[2px] text-[10px] font-bold leading-none ${
                activeTab === 'ACTIVE'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {activeTotalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TERMINAL')}
            aria-pressed={activeTab === 'TERMINAL'}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'TERMINAL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Other Applications</span>
            <span
              className={`rounded-[6px] px-1.5 py-[2px] text-[10px] font-bold leading-none ${
                activeTab === 'TERMINAL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {terminalTotalCount}
            </span>
          </button>
        </div>
      </div>

      {/* Main Kanban Board Container */}
      {applications.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates found"
          description="Applications submitted for this organization's jobs will appear here in the hiring pipeline."
        />
      ) : activeTab === 'ACTIVE' ? (
        /* Horizontally Scrollable Active Kanban Board (7 Columns) */
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 shadow-2xs">
          <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300">
            <div className="flex gap-3.5 min-w-max items-start">
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
        </div>
      ) : (
        /* Terminal Applications (Rejected & Withdrawn) */
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Terminal Applications Archive
            </h3>
            <p className="text-xs text-slate-400">
              Candidates who have been rejected or withdrawn from active recruitment
            </p>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3.5 min-w-max items-start">
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
