import React from 'react';
import { Scale, History, User, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatStatusLabel } from '@/lib/ui/format-status';
import type { EmployeeStatus, ProbationDecision } from '@prisma/client';

export interface EmploymentDecisionEvent {
  id: string;
  decision: ProbationDecision;
  decisionAt: Date;
  effectiveAt: Date;
  changedBy: { name: string };
  remarks: string | null;
  previousState?: unknown;
  newState?: unknown;
}

export interface StatusHistoryEvent {
  id: string;
  fromStatus: EmployeeStatus | null;
  toStatus: EmployeeStatus;
  createdAt: Date;
  reason: string | null;
  changedBy?: { name: string } | null;
}

interface DecisionsAuditTabProps {
  employmentDecisions: EmploymentDecisionEvent[];
  statusHistory: StatusHistoryEvent[];
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

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function formatJsonState(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return formatStatusLabel(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.state === 'string') return formatStatusLabel(obj.state);
    if (typeof obj.status === 'string') return formatStatusLabel(obj.status);
    return JSON.stringify(value);
  }
  return String(value);
}

export function DecisionsAuditTab({
  employmentDecisions,
  statusHistory,
}: DecisionsAuditTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. Employment Lifecycle Decisions */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Scale className="h-4 w-4 text-slate-500" />
              Formal Employment Lifecycle Decisions
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Auditable records of regularization, contract renewal, or non-renewal
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {employmentDecisions.length}{' '}
            {employmentDecisions.length === 1 ? 'decision' : 'decisions'}
          </span>
        </div>

        {employmentDecisions.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">No formal employment decisions recorded yet.</p>
        ) : (
          <div className="space-y-2.5">
            {employmentDecisions.map((decision) => {
              const prev = formatJsonState(decision.previousState);
              const next = formatJsonState(decision.newState);

              return (
                <div
                  key={decision.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 text-xs transition hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">
                        {formatStatusLabel(decision.decision)}
                      </span>
                      {prev && next && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                          <span>{prev}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="font-semibold text-slate-900">{next}</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Effective: {formatDate(decision.effectiveAt)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-slate-500 text-[11px]">
                    <span>
                      Recorded by <strong className="text-slate-700">{decision.changedBy.name}</strong> on{' '}
                      {formatDateTime(decision.decisionAt)}
                    </span>
                    {decision.remarks && (
                      <span className="text-slate-600 italic">“{decision.remarks}”</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Employee Status Audit History */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              Employee Status Audit Log
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Historical transitions between Active, Inactive, and Separated states
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {statusHistory.length} {statusHistory.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {statusHistory.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">No status transition events recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3.5 py-2.5">Date & Time</th>
                  <th className="px-3 py-2.5">Transition</th>
                  <th className="px-3 py-2.5">Changed By</th>
                  <th className="px-3.5 py-2.5">Reason / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statusHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-3.5 py-3 whitespace-nowrap text-slate-600 font-medium">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span className="text-slate-500">
                          {item.fromStatus ? formatStatusLabel(item.fromStatus) : 'Initial Entry'}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="text-slate-900">{formatStatusLabel(item.toStatus)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">
                      {item.changedBy?.name ?? 'System Actor'}
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 max-w-sm truncate" title={item.reason ?? ''}>
                      {item.reason || '—'}
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
