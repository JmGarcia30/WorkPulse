import React from 'react';
import { PieChart, ArrowUpRight } from 'lucide-react';
import { PayrollDashboardSummaryKPIs } from '@/features/payroll/queries';
import { TenantLink } from '@/components/ui/TenantLink';

interface PayrollBreakdownPanelProps {
  kpis: PayrollDashboardSummaryKPIs;
  periodName?: string;
  periodDateRange?: string;
  processingHref?: string;
}

export function PayrollBreakdownPanel({
  kpis,
  periodName,
  periodDateRange,
  processingHref = '/dashboard/payroll?tab=processing',
}: PayrollBreakdownPanelProps) {
  const {
    grossPayroll,
    totalDeductions,
    netPayroll,
    grossNumeric,
    deductionsNumeric,
    netNumeric,
    hasCalculatedData,
  } = kpis;

  const hasValidFinancialData = hasCalculatedData && grossNumeric > 0;

  // Semicircular Gauge SVG Math
  // We want an arc of 180 degrees (from 180 deg to 360 deg)
  const size = 200;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2; // ~91
  const semicircleCircumference = Math.PI * radius; // length of half-circle arc

  // Net vs Deduction percentage of gross
  const netRatio = hasValidFinancialData
    ? Math.min(1, Math.max(0, netNumeric / grossNumeric))
    : 0;
  const netPercent = Math.round(netRatio * 100);
  const deductionPercent = 100 - netPercent;

  // SVG stroke-dasharray for semicircle arc
  const netArcLength = netRatio * semicircleCircumference;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between h-full">
      {/* 1. Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <PieChart className="h-4 w-4 text-[var(--tenant-primary,#0f766e)]" />
              Payroll Summary
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {periodDateRange ? `From ${periodDateRange}` : periodName ? `Period: ${periodName}` : 'Current period distribution'}
            </p>
          </div>
          <TenantLink
            href={processingHref}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
          >
            <span>View details</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </TenantLink>
        </div>

        {/* 2. 3-Column Metric Summary */}
        <div className="grid grid-cols-3 gap-2 py-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Gross Pay
            </span>
            <p className="mt-1 text-xs sm:text-sm font-bold text-slate-900 truncate">
              {hasValidFinancialData && grossPayroll ? grossPayroll : '—'}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Deductions
            </span>
            <p className="mt-1 text-xs sm:text-sm font-bold text-amber-700 truncate">
              {hasValidFinancialData && totalDeductions ? totalDeductions : '—'}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
              Net Pay
            </span>
            <p className="mt-1 text-xs sm:text-sm font-bold text-[var(--tenant-primary,#0f766e)] truncate">
              {hasValidFinancialData && netPayroll ? netPayroll : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Semicircular Gauge Breakdown or Clean Empty State */}
      {hasValidFinancialData ? (
        <div className="flex flex-col items-center justify-center pt-3 pb-1">
          <div className="relative flex flex-col items-center">
            <svg
              width={size}
              height={size / 2 + strokeWidth}
              className="overflow-visible"
              viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
              aria-label="Payroll distribution semicircle gauge"
            >
              {/* Background Arc */}
              <path
                d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${
                  size - strokeWidth / 2
                } ${size / 2}`}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />

              {/* Deductions Arc */}
              {deductionsNumeric > 0 && (
                <path
                  d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${
                    size - strokeWidth / 2
                  } ${size / 2}`}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={`${semicircleCircumference} ${semicircleCircumference}`}
                  strokeDashoffset={0}
                />
              )}

              {/* Net Arc */}
              {netNumeric > 0 && (
                <path
                  d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${
                    size - strokeWidth / 2
                  } ${size / 2}`}
                  fill="none"
                  stroke="var(--tenant-primary, #0f766e)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={`${netArcLength} ${semicircleCircumference}`}
                  strokeDashoffset={0}
                />
              )}
            </svg>

            {/* Percentage Display inside the arch */}
            <div className="absolute bottom-1 flex flex-col items-center text-center">
              <span className="text-2xl font-black tracking-tight text-slate-900">
                {netPercent}%
              </span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Net Share of Gross
              </span>
            </div>
          </div>

          {/* 4. Legend Items (only rendered when valid financial data exists) */}
          <div className="mt-4 flex w-full items-center justify-center gap-6 text-xs border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--tenant-primary,#0f766e)] shrink-0" />
              <div className="text-left">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Net Pay</span>
                <span className="font-bold text-slate-800">{netPercent}%</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
              <div className="text-left">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Deductions</span>
                <span className="font-bold text-slate-800">{deductionPercent}%</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-slate-100 p-3 text-slate-400 mb-2.5">
            <PieChart className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold text-slate-700">
            Breakdown unavailable
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 max-w-[200px]">
            Generate payroll entries for this period to view net pay and deduction breakdown.
          </p>
        </div>
      )}
    </div>
  );
}
