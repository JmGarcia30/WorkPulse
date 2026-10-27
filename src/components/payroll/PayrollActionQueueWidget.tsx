'use client';

import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { PayrollDashboardActionItem } from '@/features/payroll/queries';
import { resolveTenantHref } from '@/lib/tenant/navigation';

interface PayrollActionQueueWidgetProps {
  actions: PayrollDashboardActionItem[];
}

export function PayrollActionQueueWidget({ actions }: PayrollActionQueueWidgetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleActionClick = (targetTab?: 'processing' | 'configuration') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', targetTab ?? 'processing');
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
            <AlertCircle className="h-4 w-4 text-slate-500" />
            Payroll Actions
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Operational queue & review alerts
          </p>
        </div>
        {actions.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            {actions.length} {actions.length === 1 ? 'action' : 'actions'}
          </span>
        )}
      </div>

      {/* Action Items List */}
      <div className="space-y-2.5">
        {actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-full bg-emerald-50 p-2.5 text-emerald-600 mb-2 border border-emerald-100">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              No payroll actions require attention.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
              All employee compensations, attendance records, and calculations are valid.
            </p>
          </div>
        ) : (
          actions.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition ${item.kind === 'CALCULATION_ERROR'
                  ? 'border-red-200 bg-red-50/40'
                  : item.kind === 'SETUP_REQUIRED'
                    ? 'border-amber-200 bg-amber-50/40'
                    : 'border-slate-100 bg-slate-50/70 hover:bg-slate-50'
                }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {item.title}
                  </span>
                  {item.badge && (
                    <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold shrink-0 ${item.kind === 'CALCULATION_ERROR'
                        ? 'bg-red-100 text-red-800'
                        : item.kind === 'SETUP_REQUIRED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                  {item.description}
                </p>
              </div>

              {item.actionText && (
                <button
                  type="button"
                  onClick={() => handleActionClick(item.actionTab)}
                  className="self-end inline-flex items-center gap-1 text-[11px] font-bold text-slate-900 hover:text-[var(--tenant-primary,#0f766e)] transition"
                >
                  <span>{item.actionText}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
