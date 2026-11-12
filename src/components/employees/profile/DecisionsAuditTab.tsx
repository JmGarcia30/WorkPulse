import React from 'react';
import { Scale, History, ArrowRight } from 'lucide-react';
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

type DecisionSnapshot = Record<string, unknown>;

const decisionSnapshotFields = [
  { key: 'employeeStatus', label: 'Employee status' },
  { key: 'employmentStatus', label: 'Employment status' },
  { key: 'probationStatus', label: 'Probation status' },
  { key: 'probationDecision', label: 'Probation decision' },
  { key: 'renewalCount', label: 'Renewal count' },
  { key: 'maxRenewals', label: 'Renewal limit' },
  { key: 'probationExpectedEndAt', label: 'Expected probation end' },
  { key: 'employmentEffectiveFrom', label: 'Employment start' },
  { key: 'employmentEffectiveTo', label: 'Employment end' },
] as const;

function asDecisionSnapshot(value: unknown): DecisionSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as DecisionSnapshot;
}

function formatSnapshotValue(key: string, value: unknown): string {
  if (value == null) return '—';
  if (key.endsWith('At') || key.endsWith('Date')) {
    return formatDate(typeof value === 'string' || value instanceof Date ? value : String(value));
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString('en-PH');
  if (typeof value === 'string') {
    return key.toLowerCase().includes('status') || key.toLowerCase().includes('decision')
      ? formatStatusLabel(value)
      : value;
  }
  return '—';
}

function getDecisionStateChanges(previousState: unknown, newState: unknown) {
  const previous = asDecisionSnapshot(previousState);
  const next = asDecisionSnapshot(newState);
  if (!previous || !next) return [];

  return decisionSnapshotFields.flatMap(({ key, label }) => {
    const before = previous[key];
    const after = next[key];
    if (before === after || (before === undefined && after === undefined)) return [];
    return [{
      key,
      label,
      before: formatSnapshotValue(key, before),
      after: formatSnapshotValue(key, after),
    }];
  });
}

export function DecisionsAuditTab({
  employmentDecisions,
  statusHistory,
}: DecisionsAuditTabProps) {
  return (
    <div className="min-w-0 space-y-6">
      <div className="min-w-0 space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Scale className="h-4 w-4 text-slate-500" />
              Formal Employment Lifecycle Decisions
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Auditable records of regularization, contract renewal, or non-renewal
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {employmentDecisions.length}{' '}
            {employmentDecisions.length === 1 ? 'decision' : 'decisions'}
          </span>
        </div>

        {employmentDecisions.length === 0 ? (
          <p className="py-3 text-xs text-slate-500">No formal employment decisions recorded yet.</p>
        ) : (
          <div className="min-w-0 space-y-2.5">
            {employmentDecisions.map((decision) => {
              const stateChanges = getDecisionStateChanges(decision.previousState, decision.newState);

              return (
                <div
                  key={decision.id}
                  className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 text-xs transition hover:bg-slate-50"
                >
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">
                      {formatStatusLabel(decision.decision)}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      Effective: {formatDate(decision.effectiveAt)}
                    </span>
                  </div>

                  {stateChanges.length > 0 && (
                    <div className="mt-2 flex min-w-0 flex-wrap gap-1.5" aria-label="Changed employment details">
                      {stateChanges.map((change) => (
                        <span
                          key={change.key}
                          className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-md border border-slate-200/80 bg-white px-2 py-1 text-[10px] text-slate-600"
                        >
                          <span className="font-semibold text-slate-500">{change.label}:</span>
                          <span className="break-words">{change.before}</span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="break-words font-semibold text-slate-900">{change.after}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>
                      Recorded by <strong className="text-slate-700">{decision.changedBy.name}</strong> on{' '}
                      {formatDateTime(decision.decisionAt)}
                    </span>
                    {decision.remarks && (
                      <span className="max-w-full break-words text-slate-600 italic">
                        “{decision.remarks}”
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <History className="h-4 w-4 text-slate-500" />
              Employee Status Audit Log
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Historical transitions between Active, Inactive, and Separated states
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {statusHistory.length} {statusHistory.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {statusHistory.length === 0 ? (
          <p className="py-3 text-xs text-slate-500">No status transition events recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] table-fixed border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="w-[190px] px-3.5 py-2.5">Date &amp; Time</th>
                  <th className="w-[190px] px-3 py-2.5">Transition</th>
                  <th className="w-[150px] px-3 py-2.5">Changed By</th>
                  <th className="px-3.5 py-2.5">Reason / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statusHistory.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-3.5 py-3 font-medium text-slate-600">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span className="text-slate-500">
                          {item.fromStatus ? formatStatusLabel(item.fromStatus) : 'Initial Entry'}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="text-slate-900">{formatStatusLabel(item.toStatus)}</span>
                      </div>
                    </td>
                    <td className="truncate px-3 py-3 text-slate-700" title={item.changedBy?.name ?? 'System Actor'}>
                      {item.changedBy?.name ?? 'System Actor'}
                    </td>
                    <td className="max-w-sm truncate px-3.5 py-3 text-slate-600" title={item.reason ?? ''}>
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
