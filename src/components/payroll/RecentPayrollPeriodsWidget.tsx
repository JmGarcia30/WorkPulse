'use client';

import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Calendar, ChevronRight } from 'lucide-react';
import { PayrollDashboardRecentPeriod } from '@/features/payroll/queries';
import { formatStatusLabel } from '@/lib/ui/format-status';
import { resolveTenantHref } from '@/lib/tenant/navigation';

interface RecentPayrollPeriodsWidgetProps {
  periods: PayrollDashboardRecentPeriod[];
}

export function RecentPayrollPeriodsWidget({ periods }: RecentPayrollPeriodsWidgetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelectPeriod = (periodId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', periodId);
    const targetUrl = resolveTenantHref(
      `${pathname}?${params.toString()}`,
      pathname
    );
    router.push(targetUrl);
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            Recent Payroll Periods
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Coverage dates, pay schedules, and status
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
          {periods.length} {periods.length === 1 ? 'period' : 'periods'}
        </span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {periods.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No payroll periods recorded yet.
          </div>
        ) : (
          periods.map((period) => (
            <button
              key={period.id}
              type="button"
              onClick={() => handleSelectPeriod(period.id)}
              className={`w-full text-left rounded-xl p-3 border transition-all flex items-center justify-between group ${period.isCurrent
                  ? 'border-[var(--tenant-primary,#0f766e)] bg-[var(--tenant-tint,#f0fdfa)]/30 ring-1 ring-[var(--tenant-primary,#0f766e)]/20'
                  : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/70'
                }`}
            >
              <div className="space-y-1 min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {period.name}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${period.status === 'FINALIZED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : period.status === 'REVIEW'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                    {formatStatusLabel(period.status)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {period.dateRange} · Pay Date: {period.payDate}
                </p>
                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                  <span>{period.entryCount} entries</span>
                  {period.netTotalFormatted && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">
                        {period.netTotalFormatted} net
                      </span>
                    </>
                  )}
                </div>
              </div>

              <ChevronRight className={`h-4 w-4 shrink-0 transition ${period.isCurrent
                  ? 'text-[var(--tenant-primary,#0f766e)]'
                  : 'text-slate-300 group-hover:text-slate-500'
                }`} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
