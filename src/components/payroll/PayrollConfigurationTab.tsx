'use client';

import React from 'react';
import {
  CompensationForm,
  PayrollPolicyForm,
} from './PayrollSetupForms';
import { formatStatusLabel } from '@/lib/ui/format-status';
import { formatPayrollDate } from '@/features/payroll/formatters';
import { Settings, ShieldCheck, DollarSign, History } from 'lucide-react';

interface EmployeeItem {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

interface CompensationItem {
  id: string;
  compensationType: string;
  baseRate: number | { toFixed: (digits: number) => string };
  currency: string;
  payFrequency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: string;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
  };
}

interface PolicyItem {
  id: string;
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: string;
  dailyPayBasis: string;
  lateDeductionRule: string;
  absenceDeductionRule: string;
  undertimeDeductionRule: string;
  roundingRule: string;
  createdBy: {
    name: string;
  };
}

interface LeaveTypeItem {
  id: string;
  code: string;
  name: string;
  isPaid: boolean;
}

interface PayrollConfigurationTabProps {
  employees: EmployeeItem[];
  compensations: CompensationItem[];
  policies: PolicyItem[];
  currentPolicy: PolicyItem | null;
  leaveTypes: LeaveTypeItem[];
}

export function PayrollConfigurationTab({
  employees,
  compensations,
  policies,
  currentPolicy,
  leaveTypes,
}: PayrollConfigurationTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. Employee Compensation Setup */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--tenant-primary,#0f766e)]">
            <DollarSign className="h-4 w-4" />
            <span>Personnel Base Rates</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-1">
            Employee Compensation Setup
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure monthly or daily base compensation rates and effective appointment dates.
          </p>
        </div>

        <CompensationForm employees={employees} />

        {/* Existing Compensations Table */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-700 mb-2">
            Active Compensation Records ({compensations.length})
          </h3>
          <div className="overflow-x-auto">
            {compensations.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                No employee compensation records configured yet.
              </p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-3.5 py-2.5">Employee</th>
                    <th className="px-3 py-2.5">Pay Type</th>
                    <th className="px-3 py-2.5">Base Rate</th>
                    <th className="px-3 py-2.5">Frequency</th>
                    <th className="px-3 py-2.5">Effective Period</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {compensations.map((record) => {
                    const rateFormatted =
                      typeof record.baseRate === 'number'
                        ? record.baseRate.toFixed(2)
                        : record.baseRate.toFixed(2);

                    return (
                      <tr key={record.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                          {record.employee.firstName} {record.employee.lastName}
                          <span className="block font-mono text-[10px] text-slate-400 font-normal">
                            {record.employee.employeeNumber}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                          {formatStatusLabel(record.compensationType)}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                          {record.currency} {rateFormatted}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                          {formatStatusLabel(record.payFrequency)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                          {formatPayrollDate(record.effectiveFrom)}
                          {record.effectiveTo
                            ? ` – ${formatPayrollDate(record.effectiveTo)}`
                            : ' onward'}
                        </td>
                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            record.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {formatStatusLabel(record.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 2. Payroll Policy Configuration */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--tenant-primary,#0f766e)]">
            <Settings className="h-4 w-4" />
            <span>Calculation Rules</span>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-1">
            Payroll Policy Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Institutional daily pay basis, tardiness deductions, absence rules, and leave treatments.
          </p>
        </div>

        {/* Current Active Policy Notice */}
        <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 p-4 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-[var(--tenant-primary,#0f766e)]" />
            <span>
              Active Policy: {currentPolicy ? `Version ${currentPolicy.version}` : 'Standard Default Policy'}
            </span>
          </div>
          <p className="text-slate-500 text-[11px] pl-6">
            {currentPolicy
              ? `${formatStatusLabel(currentPolicy.dailyPayBasis)} · Late: ${formatStatusLabel(
                  currentPolicy.lateDeductionRule
                )} · Absence: ${formatStatusLabel(
                  currentPolicy.absenceDeductionRule
                )} · Undertime: ${formatStatusLabel(
                  currentPolicy.undertimeDeductionRule
                )} · Rounding: ${formatStatusLabel(currentPolicy.roundingRule)}`
              : 'Scheduled payable days · No tardiness, absence, or undertime deductions · Standard two-decimal rounding'}
          </p>
        </div>

        <PayrollPolicyForm leaveTypes={leaveTypes} />

        {/* Policy Version History Table */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-slate-400" />
            <span>Policy Version History ({policies.length})</span>
          </h3>
          <div className="overflow-x-auto">
            {policies.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                The standard default payroll policy is active. Create a custom version only when specific deduction rules are needed.
              </p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-3.5 py-2.5">Version</th>
                    <th className="px-3 py-2.5">Effective Period</th>
                    <th className="px-3 py-2.5">Daily Pay Basis</th>
                    <th className="px-3 py-2.5">Late Rule</th>
                    <th className="px-3 py-2.5">Absence Rule</th>
                    <th className="px-3 py-2.5">Undertime Rule</th>
                    <th className="px-3 py-2.5">Rounding</th>
                    <th className="px-3.5 py-2.5">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {policies.map((policy) => (
                    <tr key={policy.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900">
                        v{policy.version}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                        {formatPayrollDate(policy.effectiveFrom)}
                        {policy.effectiveTo
                          ? ` – ${formatPayrollDate(policy.effectiveTo)}`
                          : ' onward'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {formatStatusLabel(policy.dailyPayBasis)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {formatStatusLabel(policy.lateDeductionRule)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {formatStatusLabel(policy.absenceDeductionRule)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {formatStatusLabel(policy.undertimeDeductionRule)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {formatStatusLabel(policy.roundingRule)}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {policy.createdBy.name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
