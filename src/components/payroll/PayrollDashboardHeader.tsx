'use client';

import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Calendar, Plus, Sparkles, LayoutDashboard, SlidersHorizontal, Settings2 } from 'lucide-react';
import { resolveTenantHref } from '@/lib/tenant/navigation';
import { formatStatusLabel } from '@/lib/ui/format-status';

export type PayrollTabId = 'overview' | 'processing' | 'configuration';

interface PeriodOption {
  id: string;
  name: string;
  status: string;
}

interface PayrollDashboardHeaderProps {
  periods: PeriodOption[];
  selectedPeriodId: string | null;
  activeTab: PayrollTabId;
  canManagePayroll: boolean;
  canGeneratePayroll: boolean;
  issuesCount: number;
}

export function PayrollDashboardHeader({
  periods,
  selectedPeriodId,
  activeTab,
  canManagePayroll,
  canGeneratePayroll,
  issuesCount,
}: PayrollDashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriodId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (newPeriodId) {
      params.set('period', newPeriodId);
    } else {
      params.delete('period');
    }
    const targetUrl = resolveTenantHref(
      `${pathname}?${params.toString()}`,
      pathname
    );
    router.push(targetUrl);
  };

  const handleTabChange = (tab: PayrollTabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    const targetUrl = resolveTenantHref(
      `${pathname}?${params.toString()}`,
      pathname
    );
    router.push(targetUrl);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Top: Title & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Payroll Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Manage payroll periods, review calculations, and finalize employee payslips.
          </p>
        </div>

        {/* Top-Right Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period Selector */}
          {periods.length > 0 && (
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <select
                aria-label="Select payroll period"
                value={selectedPeriodId ?? ''}
                onChange={handlePeriodChange}
                className="h-9 rounded-xl border border-slate-200/90 bg-white pl-8 pr-8 text-xs font-semibold text-slate-800 shadow-2xs hover:border-slate-300 focus:border-slate-900 focus:outline-hidden transition"
              >
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({formatStatusLabel(period.status)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Actions */}
          {canManagePayroll && (
            <>
              <button
                type="button"
                onClick={() => handleTabChange('processing')}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Period</span>
              </button>

              {canGeneratePayroll && (
                <button
                  type="button"
                  onClick={() => handleTabChange('processing')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span>Generate Payroll</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 2. Primary Tab Navigation */}
      <div className="border-b border-slate-200/80">
        <nav className="flex space-x-1 sm:space-x-3 overflow-x-auto pb-px" aria-label="Payroll views">
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs sm:text-sm font-semibold transition ${
              activeTab === 'overview'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('processing')}
            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs sm:text-sm font-semibold transition ${
              activeTab === 'processing'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Payroll Processing</span>
            {issuesCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                {issuesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('configuration')}
            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs sm:text-sm font-semibold transition ${
              activeTab === 'configuration'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <Settings2 className="h-4 w-4" />
            <span>Configuration & Policies</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
