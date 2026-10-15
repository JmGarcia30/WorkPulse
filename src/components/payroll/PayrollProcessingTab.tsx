'use client';

import React from 'react';
import {
  PayrollPeriodForm,
  PayrollGenerationForm,
  PayrollReviewControls,
} from './PayrollSetupForms';
import { formatStatusLabel } from '@/lib/ui/format-status';
import { formatPayrollDate } from '@/features/payroll/formatters';
import { Calendar, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

interface PeriodItem {
  id: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  status: string;
}

interface ReviewIssue {
  employeeId?: string;
  employeeNumber?: string;
  employeeName?: string;
  kind: 'SETUP_REQUIRED' | 'CALCULATION_ERROR';
  message: string;
}

interface PayrollProcessingTabProps {
  periods: PeriodItem[];
  selectedPeriod: PeriodItem | null;
  review: {
    period: PeriodItem & {
      finalizedBy?: { name: string } | null;
      finalizedAt?: Date | null;
    };
    summary: {
      totalEmployees: number;
      ready: number;
      setupRequired: number;
      errors: number;
    };
    totals: {
      employeeCount: number;
      gross: string;
      deductions: string;
      net: string;
    };
    issues: ReviewIssue[];
    canFinalize: boolean;
  } | null;
}

export function PayrollProcessingTab({
  periods,
  selectedPeriod,
  review,
}: PayrollProcessingTabProps) {
  const periodLabel = selectedPeriod
    ? `${formatPayrollDate(selectedPeriod.periodStart)} – ${formatPayrollDate(selectedPeriod.periodEnd)}`
    : '';

  return (
    <div className="space-y-6">
      {/* Workflow Step Tracker */}
      <ol aria-label="Payroll workflow steps" className="grid gap-2 rounded-xl bg-slate-50/80 border border-slate-200/70 p-3 sm:grid-cols-3 xl:grid-cols-6 text-xs">
        {[
          '1. Set Up Pay',
          '2. Create Period',
          '3. Generate',
          '4. Review',
          '5. Finalize',
          '6. Payslips',
        ].map((step, index) => {
          const isComplete =
            (index === 1 && periods.length > 0) ||
            (index === 2 && (review?.totals.employeeCount ?? 0) > 0) ||
            (index === 3 && selectedPeriod?.status === 'REVIEW') ||
            (index >= 4 && selectedPeriod?.status === 'FINALIZED');

          return (
            <li
              key={step}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 font-semibold transition ${
                isComplete
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                  : 'bg-white text-slate-600 border border-slate-200/60'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isComplete
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {index + 1}
              </span>
              <span className="truncate">{step.split('. ')[1]}</span>
            </li>
          );
        })}
      </ol>

      {/* Step 1: Create a Payroll Period */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--tenant-primary,#0f766e)]">
            <Calendar className="h-4 w-4" />
            <span>Step 1 · Schedule Period</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-1">
            Create a Payroll Period
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Define institutional attendance cut-off dates and the scheduled pay date.
          </p>
        </div>

        <PayrollPeriodForm />

        {/* Existing Periods Table */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-700 mb-2">
            Scheduled Periods ({periods.length})
          </h3>
          <div className="overflow-x-auto">
            {periods.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                No payroll periods created yet. Use the form above to schedule your first period.
              </p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-3.5 py-2.5">Period Name</th>
                    <th className="px-3 py-2.5">Coverage Dates</th>
                    <th className="px-3 py-2.5">Pay Date</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periods.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900">
                        {p.name}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {formatPayrollDate(p.periodStart)} – {formatPayrollDate(p.periodEnd)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {formatPayrollDate(p.payDate)}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          p.status === 'FINALIZED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'REVIEW'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {formatStatusLabel(p.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Step 2: Generate / Recalculate Payroll */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--tenant-primary,#0f766e)]">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Step 2 · Calculation Engine</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-1">
            Generate or Recalculate Payroll
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Resolve compensation records, summarize attendance logs, compute deduction policies, and generate entries.
          </p>
        </div>

        {selectedPeriod?.status !== 'FINALIZED' ? (
          <PayrollGenerationForm
            periods={periods.map((p) => ({ id: p.id, name: p.name }))}
            selectedPeriodId={selectedPeriod?.id}
          />
        ) : (
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              {selectedPeriod.name} is finalized. Recalculation is disabled to protect official records.
            </span>
          </div>
        )}
      </div>

      {/* Step 3: Review Controls & Finalization */}
      {selectedPeriod && review && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--tenant-primary,#0f766e)]">
              <CheckCircle2 className="h-4 w-4" />
              <span>Step 3 · Review & Finalization</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              Review & Finalize {selectedPeriod.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify review criteria, resolve blocker issues, and lock official immutable payslips.
            </p>
          </div>

          {/* Quick Review Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Employees</span>
              <p className="text-lg font-bold text-slate-900 mt-1">{review.summary.totalEmployees}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Ready</span>
              <p className="text-lg font-bold text-emerald-700 mt-1">{review.summary.ready}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Setup Required</span>
              <p className="text-lg font-bold text-amber-700 mt-1">{review.summary.setupRequired}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Errors</span>
              <p className="text-lg font-bold text-red-700 mt-1">{review.summary.errors}</p>
            </div>
          </div>

          {/* Review Issues Alert */}
          {review.issues.length > 0 && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-xs text-red-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-950">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                <span>What needs to be resolved before finalization ({review.issues.length}):</span>
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-red-800">
                {review.issues.map((issue, index) => (
                  <li key={`${issue.employeeId ?? 'period'}-${index}`}>
                    <span className="font-bold">
                      {formatStatusLabel(issue.kind)}
                      {issue.employeeNumber ? ` · ${issue.employeeNumber}` : ''}:
                    </span>{' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Finalized Banner or Action Controls */}
          {review.period.status === 'FINALIZED' ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/75 p-4 flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-950">
                  Payroll Period Finalized
                </p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Finalized by {review.period.finalizedBy?.name ?? 'HR/Admin'} on{' '}
                  {review.period.finalizedAt
                    ? new Intl.DateTimeFormat('en-PH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Manila',
                      }).format(review.period.finalizedAt)
                    : 'an official date'}
                  . Payslips are locked and viewable in ESS.
                </p>
              </div>
            </div>
          ) : (
            <PayrollReviewControls
              periodId={review.period.id}
              periodLabel={periodLabel}
              status={review.period.status}
              canFinalize={review.canFinalize}
            />
          )}
        </div>
      )}
    </div>
  );
}
