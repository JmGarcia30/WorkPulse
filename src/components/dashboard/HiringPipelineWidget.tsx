import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PipelineStageCount } from '@/features/dashboard/read-model';

interface HiringPipelineWidgetProps {
  totalActiveCandidates: number;
  stages: PipelineStageCount[];
}

export function HiringPipelineWidget({
  totalActiveCandidates,
  stages,
}: HiringPipelineWidgetProps) {
  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white p-5 border border-slate-200/80 h-full">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Hiring Pipeline Overview
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              {totalActiveCandidates.toLocaleString()} active candidates in evaluation
            </p>
          </div>

          <Link
            href="/dashboard/hiring/pipeline"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors"
            title="Open complete Hiring Pipeline"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Legend pills (inspired by reference hard skill / soft skill pills) */}
        <div className="mt-3 flex items-center gap-4 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--tenant-primary,#0f766e)]" />
            <span>Active Pipeline Stages</span>
          </div>
        </div>
      </div>

      {/* Progress Bars for Stages (matching reference layout) */}
      <div className="my-4 space-y-3.5">
        {stages.map((st) => (
          <Link
            key={st.stage}
            href={st.href}
            className="group block space-y-1.5 transition-colors"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 group-hover:text-slate-950 transition-colors">
                {st.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tabular-nums">
                  {st.count}
                </span>
                <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                  ({st.percentage}%)
                </span>
              </div>
            </div>

            {/* Horizontal progress bar */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[var(--tenant-primary,#0f766e)] transition-all duration-500 group-hover:brightness-110"
                style={{ width: `${Math.max(st.percentage, st.count > 0 ? 5 : 0)}%` }}
              />
            </div>
          </Link>
        ))}
      </div>

      {/* Footer Link */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">
          Full Pipeline &amp; Candidates
        </span>
        <Link
          href="/dashboard/hiring/applicants"
          className="font-semibold text-slate-700 hover:text-slate-950 transition-colors"
        >
          View All Applicants →
        </Link>
      </div>
    </div>
  );
}
