import { History, UserCheck, Clock } from 'lucide-react';
import { ApplicationStatus } from '@prisma/client';

export interface TimelineHistoryItem {
  id: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  createdAt: Date | string;
  changedBy: {
    name: string;
    role: string;
  };
}

interface ApplicationTimelineProps {
  initialStatus: ApplicationStatus;
  appliedAt: Date | string;
  history: TimelineHistoryItem[];
}

export function ApplicationTimeline({
  initialStatus,
  appliedAt,
  history,
}: ApplicationTimelineProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400 flex items-center gap-2">
          <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Candidate Status Audit Timeline
        </h3>
        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
          {history.length + 1} State Events
        </span>
      </div>

      <div className="relative pl-5 space-y-5 border-l-2 border-slate-200 dark:border-slate-800 ml-2">
        {/* Initial Submission Node */}
        <div className="relative space-y-1">
          <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-600 shadow-xs dark:border-slate-900 dark:bg-indigo-400" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Application Created ({ApplicationStatus.APPLIED})
            </span>
            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Initial Submission
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Submitted by candidate on {new Date(appliedAt).toLocaleString()}
          </p>
        </div>

        {/* Chronological History Transitions */}
        {history.map((hist) => (
          <div key={hist.id} className="relative space-y-1">
            <div className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-600 shadow-xs dark:border-slate-900 dark:bg-emerald-400" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Status Transition: <span className="text-slate-500 line-through">{hist.fromStatus}</span> →{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{hist.toStatus}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <UserCheck className="h-3 w-3 text-slate-400" /> Updated by {hist.changedBy.name} ({hist.changedBy.role}) on{' '}
              {new Date(hist.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
