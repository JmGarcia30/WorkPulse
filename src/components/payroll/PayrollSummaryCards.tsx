import React from 'react';
import { Banknote, Receipt, Wallet, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PayrollDashboardSummaryKPIs } from '@/features/payroll/queries';

interface PayrollSummaryCardsProps {
  kpis: PayrollDashboardSummaryKPIs;
  periodName?: string;
}

export function PayrollSummaryCards({ kpis, periodName }: PayrollSummaryCardsProps) {
  const {
    grossPayroll,
    totalDeductions,
    netPayroll,
    employeesIncluded,
    totalEligibleEmployees,
    requiresAttention,
    hasCalculatedData,
  } = kpis;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
      {/* 1. Gross Payroll */}
      <div className="rounded-xl bg-white p-4 shadow-[0_3px_16px_rgba(30,35,40,0.06)] hover:shadow-[0_4px_20px_rgba(30,35,40,0.08)] transition flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Gross Payroll
          </span>
          <div className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
            <Banknote className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {hasCalculatedData && grossPayroll ? grossPayroll : '—'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {periodName ? `Earnings for ${periodName}` : 'Gross scheduled earnings'}
          </p>
        </div>
      </div>

      {/* 2. Total Deductions */}
      <div className="rounded-xl bg-white p-4 shadow-[0_3px_16px_rgba(30,35,40,0.06)] hover:shadow-[0_4px_20px_rgba(30,35,40,0.08)] transition flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Deductions
          </span>
          <div className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
            <Receipt className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {hasCalculatedData && totalDeductions ? totalDeductions : '—'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Attendance & policy adjustments
          </p>
        </div>
      </div>

      {/* 3. Net Payroll (Highlighted) */}
      <div className="rounded-xl bg-white p-4 shadow-[0_3px_16px_rgba(30,35,40,0.06)] hover:shadow-[0_4px_20px_rgba(30,35,40,0.08)] transition flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--tenant-primary,#0f766e)] opacity-80" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Net Payroll
          </span>
          <div className="rounded-lg bg-[var(--tenant-tint,#f0fdfa)] p-1.5 text-[var(--tenant-primary,#0f766e)]">
            <Wallet className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {hasCalculatedData && netPayroll ? netPayroll : '—'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            Total calculated net pay
          </p>
        </div>
      </div>

      {/* 4. Employees Included */}
      <div className="rounded-xl bg-white p-4 shadow-[0_3px_16px_rgba(30,35,40,0.06)] hover:shadow-[0_4px_20px_rgba(30,35,40,0.08)] transition flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Employees
          </span>
          <div className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {employeesIncluded}
            </p>
            <span className="text-xs text-slate-400">
              of {totalEligibleEmployees} eligible
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {hasCalculatedData
              ? employeesIncluded === totalEligibleEmployees
                ? 'Complete workforce roster'
                : `${totalEligibleEmployees - employeesIncluded} pending generation`
              : 'Awaiting calculation'}
          </p>
        </div>
      </div>

      {/* 5. Requires Attention */}
      <div className={`rounded-xl p-4 shadow-[0_3px_16px_rgba(30,35,40,0.06)] hover:shadow-[0_4px_20px_rgba(30,35,40,0.08)] transition flex flex-col justify-between ${
        !hasCalculatedData
          ? 'bg-white'
          : requiresAttention > 0
          ? 'border border-amber-200 bg-amber-50/50'
          : 'bg-white'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${
            hasCalculatedData && requiresAttention > 0 ? 'text-amber-800' : 'text-slate-500'
          }`}>
            Attention
          </span>
          <div className={`rounded-lg p-1.5 ${
            !hasCalculatedData
              ? 'bg-slate-100 text-slate-500'
              : requiresAttention > 0
              ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-50 text-emerald-600'
          }`}>
            {!hasCalculatedData ? (
              <AlertCircle className="h-4 w-4 text-slate-400" />
            ) : requiresAttention > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </div>
        </div>
        <div className="mt-3">
          <p className={`text-xl sm:text-2xl font-bold tracking-tight ${
            !hasCalculatedData
              ? 'text-slate-500 text-base sm:text-lg'
              : requiresAttention > 0
              ? 'text-amber-900'
              : 'text-slate-900'
          }`}>
            {!hasCalculatedData
              ? 'Not calculated yet'
              : `${requiresAttention} ${requiresAttention === 1 ? 'item' : 'items'}`}
          </p>
          <p className={`mt-1 text-[11px] ${
            !hasCalculatedData
              ? 'text-slate-400'
              : requiresAttention > 0
              ? 'text-amber-700'
              : 'text-slate-400'
          }`}>
            {!hasCalculatedData
              ? 'Awaiting payroll generation'
              : requiresAttention > 0
              ? 'Setup or calculation issues'
              : 'All calculations validated'}
          </p>
        </div>
      </div>
    </div>
  );
}
