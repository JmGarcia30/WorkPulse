import { probationPolicyText } from '@/features/employees/probation-policy';
import React from 'react';
import {
  ShieldCheck,
  History,
} from 'lucide-react';
import { EmploymentLifecycleActions } from '@/components/employees/EmploymentLifecycleActions';
import { formatStatusLabel } from '@/lib/ui/format-status';
import type { EmploymentCategory, ProbationDecision, ProbationStatus } from '@prisma/client';
import type { ProbationReviewSummary } from '@/features/employees/domain';

interface ProbationTabProps {
  isSagaOrganization?: boolean;
  employeeId: string;
  employeeName: string;
  category: EmploymentCategory;
  probation: {
    id: string;
    startedAt: Date;
    expectedEndAt: Date;
    probationStatus: ProbationStatus;
    renewalCount: number;
    maxRenewals: number;
    decision: ProbationDecision;
    policySnapshot: string;
  } | null;
  review: ProbationReviewSummary | null;
  probationHistory: Array<{
    id: string;
    startedAt: Date;
    expectedEndAt: Date;
    category: EmploymentCategory;
    probationStatus: ProbationStatus;
    decision: ProbationDecision;
    decisionAt: Date | null;
    decisionBy: { name: string } | null;
    remarks: string | null;
  }>;
  regularizationAllowed: boolean;
  renewalAllowed: boolean;
  notRenewalAllowed: boolean;
  blockedReason: string | null;
  defaultEffectiveDate: string;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    dateStyle: 'medium',
  }).format(d);
}

export function ProbationTab({ isSagaOrganization = false,
  employeeId,
  employeeName,
  category,
  probation,
  review,
  probationHistory,
  regularizationAllowed,
  renewalAllowed,
  notRenewalAllowed,
  blockedReason,
  defaultEffectiveDate,
}: ProbationTabProps) {
  const renewalsRemaining = probation ? Math.max(0, probation.maxRenewals - probation.renewalCount) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Current Probation Status Card */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-slate-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Current Probation Status</h2>
              <p className="text-[11px] text-slate-400">
                Institutional appointment terms and review schedule
              </p>
            </div>
          </div>
          {probation && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${probation.probationStatus === 'ACTIVE'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200/70'
                  : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
            >
              {formatStatusLabel(probation.probationStatus)}
            </span>
          )}
        </div>

        {probation && review ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-3.5 gap-x-6 text-xs">
              <div>
                <dt className="text-slate-400 font-medium">Review State</dt>
                <dd className="mt-0.5 font-bold text-slate-900">
                  {formatStatusLabel(review.state)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">Decision Status</dt>
                <dd className="mt-0.5 font-bold text-slate-900">
                  {formatStatusLabel(probation.decision)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">Time to Review</dt>
                <dd
                  className={`mt-0.5 font-bold ${review.daysRemaining < 0
                      ? 'text-rose-600'
                      : review.daysRemaining === 0
                        ? 'text-amber-600'
                        : 'text-slate-800'
                    }`}
                >
                  {review.daysRemaining < 0
                    ? `${Math.abs(review.daysRemaining)} days overdue`
                    : review.daysRemaining === 0
                      ? 'Review due today'
                      : `${review.daysRemaining} days remaining`}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">Period Start Date</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">
                  {formatDate(probation.startedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">Expected End Date</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">
                  {formatDate(probation.expectedEndAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">Renewals Used / Limit</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">
                  {probation.renewalCount} of {probation.maxRenewals} used
                  {category === 'TEACHING' && (
                    <span className="text-slate-400 font-normal">
                      {' '}
                      ({renewalsRemaining} remaining)
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            {probation.policySnapshot && (
              <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100 text-xs text-slate-600">
                <span className="font-semibold text-slate-700 block mb-1">
                  Policy Snapshot:
                </span>
                <p className="leading-relaxed">{probationPolicyText(probation.policySnapshot)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 p-6 text-center text-xs text-slate-500">
            No active probationary appointment applies to this employee record.
          </div>
        )}
      </div>

      {/* 2. Lifecycle Decision Actions (Regularize / Renew / Do Not Renew) */}
      <EmploymentLifecycleActions
        isSagaOrganization={isSagaOrganization}
        employeeId={employeeId}
        employeeName={employeeName}
        category={category}
        regularizationAllowed={regularizationAllowed}
        renewalAllowed={renewalAllowed}
        notRenewalAllowed={notRenewalAllowed}
        blockedReason={blockedReason}
        defaultEffectiveDate={defaultEffectiveDate}
      />

      {/* 3. Review History / Probation Timeline */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            Probation History & Audit Timeline
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Historical probationary appointments, recorded evaluations, and decision actors
          </p>
        </div>

        {probationHistory.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">No probation history records recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3.5 py-2.5">Period</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Decision</th>
                  <th className="px-3 py-2.5">Decision Date</th>
                  <th className="px-3 py-2.5">Recorded By</th>
                  <th className="px-3.5 py-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {probationHistory.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-3.5 py-3 whitespace-nowrap font-medium text-slate-800">
                      {formatDate(record.startedAt)} – {formatDate(record.expectedEndAt)}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {formatStatusLabel(record.category)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {record.probationStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap font-semibold text-slate-800">
                      {formatStatusLabel(record.decision)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                      {formatDate(record.decisionAt)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-600 font-medium">
                      {record.decisionBy?.name ?? '—'}
                    </td>
                    <td className="px-3.5 py-3 text-slate-500 max-w-xs truncate" title={record.remarks ?? ''}>
                      {record.remarks || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
