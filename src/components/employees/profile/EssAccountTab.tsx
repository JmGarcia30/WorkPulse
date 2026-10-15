import React from 'react';
import { KeyRound, Shield, History, UserCheck } from 'lucide-react';
import { EmployeeAccountPanel } from '@/components/employee-self-service/EmployeeAccountPanel';
import { formatStatusLabel } from '@/lib/ui/format-status';

export interface AuditItem {
  id: string;
  action: string;
  actorUserId: string;
  createdAt: Date | string;
  details?: unknown;
}

interface EssAccountTabProps {
  employeeId: string;
  contactEmail: string;
  employeeActive: boolean;
  account: {
    id: string;
    email: string;
    status: string;
    expiresAt: string | null;
    activatedAt: string | null;
    disabledAt: string | null;
    disabledReason: string | null;
  } | null;
  audits?: AuditItem[];
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

export function EssAccountTab({
  employeeId,
  contactEmail,
  employeeActive,
  account,
  audits = [],
}: EssAccountTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. Reuse existing EmployeeAccountPanel */}
      <EmployeeAccountPanel
        employeeId={employeeId}
        contactEmail={contactEmail}
        employeeActive={employeeActive}
        account={account}
      />

      {/* 2. Account Security & Audit Activity */}
      {account && audits.length > 0 && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-500" />
                Recent Account Security Audits
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Authentication events, provisioning history, and access modifications
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              Last {audits.length} events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3.5 py-2.5">Date & Time</th>
                  <th className="px-3 py-2.5">Action</th>
                  <th className="px-3 py-2.5">Actor User ID</th>
                  <th className="px-3.5 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {audits.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600 font-medium">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                      {formatStatusLabel(item.action)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {item.actorUserId ? `${item.actorUserId.slice(0, 12)}…` : 'System'}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500 text-[11px]">
                      {item.details ? (
                        <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {typeof item.details === 'object'
                            ? JSON.stringify(item.details)
                            : String(item.details)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
