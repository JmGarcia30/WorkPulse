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
    <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_3px_16px_rgba(30,35,40,0.06)] h-full">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-[#282934] tracking-tight">
              Hiring Pipeline Overview
            </h2>
            <p className="text-xs text-[#777882] font-medium">
              {totalActiveCandidates.toLocaleString()} active candidates in evaluation
            </p>
          </div>

          <Link
            href="/dashboard/hiring/pipeline"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-[#C7A759] hover:border-[#C7A759] transition-colors"
            title="Open complete Hiring Pipeline"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Legend pills (inspired by reference hard skill / soft skill pills) */}
        <div className="mt-3 flex items-center gap-4 text-xs font-medium text-[#62636B]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#C7A759]" />
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
              <span className="font-semibold text-[#282934] group-hover:text-[#C7A759] transition-colors">
                {st.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#282934] tabular-nums">
                  {st.count}
                </span>
                <span className="text-[11px] font-medium text-[#777882] tabular-nums">
                  ({st.percentage}%)
                </span>
              </div>
            </div>

            {/* Horizontal progress bar */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#E8E5DF]">
              <div
                className="h-full rounded-full bg-[#C7A759] transition-all duration-500 group-hover:brightness-110"
                style={{ width: `${Math.max(st.percentage, st.count > 0 ? 5 : 0)}%` }}
              />
            </div>
          </Link>
        ))}
      </div>

      {/* Footer Link */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-[#777882] font-medium">
          Full Pipeline &amp; Candidates
        </span>
        <Link
          href="/dashboard/hiring/applicants"
          className="font-semibold text-[#282934] hover:text-[#C7A759] transition-colors"
        >
          View All Applicants →
        </Link>
      </div>
    </div>
  );
}
