'use client';

import React from 'react';
import { Check, XCircle } from 'lucide-react';

import { getHiringLifecycle, type HiringLifecycleState } from '@/features/hiring/lifecycle';

export function HiringProgressTracker(props: HiringLifecycleState) {
  const { currentStatus } = props;
  const { steps, activeIndex, isTerminal, currentStageLabel } = getHiringLifecycle(props);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition space-y-4">
      {/* Terminal Alert (if applicable) */}
      {isTerminal && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2 text-xs font-semibold text-rose-700">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>
            Candidate application is <strong>{currentStatus}</strong>. Institutional hiring pipeline is closed.
          </span>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-slate-800">
            Hiring Progress
          </span>
          <span className="inline-flex items-center rounded-[6px] bg-[#EEEDF1] px-2 py-[3px] text-xs font-semibold text-[#282934]">
            Stage {activeIndex + 1} of {steps.length}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Current Stage:</span>
          <span className="inline-flex items-center rounded-[6px] bg-[#282934] px-2.5 py-[3px] text-xs font-semibold text-white shadow-xs">
            {currentStageLabel}
          </span>
        </div>
      </div>

      {/* Stepper Track */}
      <div className="overflow-x-auto pb-1.5 pt-1 scrollbar-none">
        <div className="flex items-center justify-between min-w-[700px] sm:min-w-0">
          {steps.map((step, idx) => {
            const isCompleted = !isTerminal && idx < activeIndex;
            const isCurrent = !isTerminal && idx === activeIndex;

            return (
              <div key={step.key} className="flex flex-1 items-center last:flex-none">
                {/* Step Node */}
                <div className="flex flex-col items-center group relative cursor-default">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isCurrent
                        ? 'bg-slate-900 text-white ring-4 ring-slate-100 shadow-xs'
                        : 'bg-slate-100 text-slate-400 border border-slate-200/80'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Stage Label Below Circle */}
                  <span
                    className={`mt-2 text-[11px] leading-tight text-center whitespace-nowrap transition-colors ${
                      isCurrent
                        ? 'font-bold text-slate-900'
                        : isCompleted
                        ? 'font-medium text-emerald-700'
                        : 'font-normal text-slate-400'
                    }`}
                  >
                    {step.shortLabel}
                  </span>

                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg">
                    {step.description}
                  </div>
                </div>

                {/* Connecting Track Line */}
                {idx < steps.length - 1 && (
                  <div
                    className={`h-[1.5px] flex-1 mx-1.5 transition-colors ${
                      idx < activeIndex ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
