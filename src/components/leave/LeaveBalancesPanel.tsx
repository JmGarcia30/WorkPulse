'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Info,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { grantCycleEntitlementsAction } from '@/features/leave/hr-actions';

interface BalanceType {
  id: string;
  name: string;
  balanceTracked: boolean;
  defaultGrantUnits: number | null;
  requiresEligibilityVerification: boolean;
  cycles: Array<{ id: string; name: string }>;
}

interface BalanceEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

interface LeaveBalancesPanelProps {
  types: BalanceType[];
  employees: BalanceEmployee[];
  isSagaOrganization?: boolean;
}

const friendlyOutcome = (status?: string) =>
  status === 'GRANTED'
    ? 'Entitlement granted successfully.'
    : status === 'SKIPPED_DUPLICATE'
    ? 'This employee already has this entitlement for the selected leave cycle.'
    : 'The entitlement could not be granted.';

export function LeaveBalancesPanel({ types, employees, isSagaOrganization = false }: LeaveBalancesPanelProps) {
  const trackedTypes = types.filter((item) => item.balanceTracked);
  const [typeId, setTypeId] = useState(trackedTypes[0]?.id ?? '');
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const currentType = trackedTypes.find((item) => item.id === typeId) ?? trackedTypes[0];
  const availableCycles = currentType?.cycles ?? [];

  // If selectedCycleId is not in available cycles, pick the first
  const effectiveCycleId =
    availableCycles.some((c) => c.id === selectedCycleId)
      ? selectedCycleId
      : availableCycles[0]?.id ?? '';

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentType) return;
    if (!effectiveCycleId) {
      setFeedback({ type: 'error', message: 'Please select a leave cycle.' });
      return;
    }
    if (!selectedEmployeeId) {
      setFeedback({ type: 'error', message: 'Please select an employee.' });
      return;
    }
    if (!reason.trim()) {
      setFeedback({ type: 'error', message: 'Please provide a reason for this entitlement grant.' });
      return;
    }

    if (!window.confirm('Confirm HR verified this entitlement grant before creating the immutable ledger entry.')) {
      return;
    }

    startTransition(async () => {
      const result = await grantCycleEntitlementsAction({
        leaveTypeId: currentType.id,
        leaveCycleId: effectiveCycleId,
        employeeIds: [selectedEmployeeId],
        reason: reason.trim(),
        confirmed: true,
        eligibilityConfirmed: true,
      });

      if ('error' in result) {
        setFeedback({ type: 'error', message: String(result.error) });
      } else {
        const firstOutcome = result.outcomes[0];
        const isSuccess = firstOutcome?.status === 'GRANTED';
        setFeedback({
          type: isSuccess ? 'success' : 'error',
          message: friendlyOutcome(firstOutcome?.status),
        });
        if (isSuccess) {
          setReason('');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href="/dashboard/leave"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Leave Management</span>
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Leave Balances</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Manage employee entitlement grants for your organization and leave cycles.
        </p>
      </div>

      {/* Main Responsive Grid: 70% Form Panel / 30% Info Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Form Panel (lg:col-span-8) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm lg:col-span-8">
          {/* Panel Header */}
          <div className="flex items-start gap-4 pb-6 border-b border-slate-100">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3F1EC] text-[#756B5D] border border-[#E5E1D9]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Employee Entitlement Grant</h2>
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                {isSagaOrganization ? 'Use for exceptional or administrative balance setup. Normal Sick/Personal and verified Solo Parent workflows initialize defaults automatically.' : 'Grant the configured default entitlement to an employee for an open leave cycle. Existing grants are never replaced.'}
              </p>
            </div>
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`mt-6 flex items-start gap-3 rounded-xl p-4 text-xs font-medium border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="flex-1">{feedback.message}</div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Leave Type Field */}
              <div>
                <label htmlFor="leaveTypeSelect" className="block text-xs font-semibold text-slate-700">
                  Leave Type
                </label>
                <div className="relative mt-1.5">
                  <select
                    id="leaveTypeSelect"
                    value={typeId}
                    onChange={(e) => {
                      setTypeId(e.target.value);
                      setSelectedCycleId('');
                    }}
                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs font-medium text-slate-800 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {trackedTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.defaultGrantUnits != null ? item.defaultGrantUnits : 'None'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Select the leave type to grant entitlement for.</p>
              </div>

              {/* Cycle Field */}
              <div>
                <label htmlFor="cycleSelect" className="block text-xs font-semibold text-slate-700">
                  Cycle
                </label>
                <div className="relative mt-1.5">
                  <select
                    id="cycleSelect"
                    value={effectiveCycleId}
                    onChange={(e) => setSelectedCycleId(e.target.value)}
                    required
                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs font-medium text-slate-800 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {availableCycles.length === 0 ? (
                      <option value="">No cycle configured</option>
                    ) : (
                      availableCycles.map((cycle) => (
                        <option key={cycle.id} value={cycle.id}>
                          {cycle.name}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Select the entitlement cycle or year.</p>
              </div>

              {/* Employee Field */}
              <div>
                <label htmlFor="employeeSelect" className="block text-xs font-semibold text-slate-700">
                  Employee
                </label>
                <div className="relative mt-1.5">
                  <select
                    id="employeeSelect"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    required
                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs font-medium text-slate-800 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeNumber} · {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Select the employee who will receive the entitlement.</p>
              </div>

              {/* Reason Field */}
              <div>
                <label htmlFor="grantReason" className="block text-xs font-semibold text-slate-700">
                  Reason
                </label>
                <div className="mt-1.5">
                  <input
                    id="grantReason"
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for granting entitlement"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Provide a brief reason or reference for this adjustment.</p>
              </div>
            </div>

            {/* Grant Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={pending || trackedTypes.length === 0}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? 'Granting Entitlement...' : 'Grant Entitlement'}
              </button>
            </div>
          </form>
        </div>

        {/* Information Panel (lg:col-span-4) */}
        <aside className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3F1EC] text-[#756B5D] border border-[#E5E1D9]">
              <Info className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Important Notes</h3>
          </div>

          <div className="mt-4 space-y-3.5 text-xs text-slate-600 leading-relaxed">
            <p className="text-slate-500">
              Use this form to manually grant leave entitlement for exceptional cases or administrative adjustments.
            </p>

            <ul className="space-y-3 pt-2">
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>{isSagaOrganization ? 'Normal Sick/Personal leave and verified Solo Parent workflows initialize defaults automatically.' : 'Configure a tracked leave type, its default entitlement and a cycle in Leave Settings before granting balances.'}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>This action will update the employee&apos;s leave balance for the selected cycle.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>Provide a clear reason for audit and tracking purposes.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>Grants must follow existing institutional eligibility and audit rules.</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
