import React from 'react';
import { Shield } from 'lucide-react';
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
  canManageAccount?: boolean;
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

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, value => value.toUpperCase());
}

function formatAuditValue(key: string, value: unknown): string | null {
  if (value == null) return null;
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === 'mode' || normalizedKey === 'provider') {
    return String(value).toUpperCase();
  }
  if (normalizedKey === 'attempt') {
    const attempt = String(value).toUpperCase();
    if (attempt === 'INITIAL') return 'Invitation sent';
    if (attempt === 'RESEND') return 'Invitation resent';
    return formatStatusLabel(String(value));
  }
  if (normalizedKey.endsWith('at') && (typeof value === 'string' || value instanceof Date)) {
    return formatDateTime(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString('en-PH');
  if (typeof value === 'string') return value.length > 64 ? value.slice(0, 61) + '…' : value;
  if (Array.isArray(value)) return value.length + (value.length === 1 ? ' item' : ' items');
  return null;
}

function getAuditDetailEntries(details: unknown): Array<{ label: string; value: string }> {
  if (details == null || details === '') return [];

  let value = details;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return [{ label: 'Details', value: value.length > 64 ? value.slice(0, 61) + '…' : value }];
    }
  }

  if (Array.isArray(value)) {
    return [{ label: 'Updates', value: value.length + (value.length === 1 ? ' item' : ' items') }];
  }
  if (!value || typeof value !== 'object') {
    const formatted = formatAuditValue('details', value);
    return formatted ? [{ label: 'Details', value: formatted }] : [];
  }

  const sensitiveKey = /(token|secret|password|credential|authorization|cookie|session|otp|verification.?code)/i;
  return Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !sensitiveKey.test(key))
    .flatMap(([key, item]) => {
      const formatted = formatAuditValue(key, item);
      return formatted ? [{ label: humanizeKey(key), value: formatted }] : [];
    })
    .slice(0, 4);
}

export function EssAccountTab({
  employeeId,
  contactEmail,
  employeeActive,
  account,
  audits = [],
  canManageAccount = true,
}: EssAccountTabProps) {
  return (
    <div className="min-w-0 space-y-6">
      <EmployeeAccountPanel
        canManageAccount={canManageAccount}
        employeeId={employeeId}
        contactEmail={contactEmail}
        employeeActive={employeeActive}
        account={account}
      />

      {account && audits.length > 0 && (
        <div className="min-w-0 space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Shield className="h-4 w-4 text-slate-500" />
                Recent Account Security Audits
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Authentication events, provisioning history, and access modifications
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              Last {audits.length} events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="w-[190px] px-3.5 py-2.5">Date &amp; Time</th>
                  <th className="w-[150px] px-3 py-2.5">Action</th>
                  <th className="w-[170px] px-3 py-2.5">Actor User ID</th>
                  <th className="px-3.5 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {audits.map((item) => {
                  const details = getAuditDetailEntries(item.details);
                  return (
                    <tr key={item.id} className="align-top transition hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-medium text-slate-600">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900">
                        {formatStatusLabel(item.action)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {item.actorUserId ? (
                          <span
                            className="block max-w-[9rem] truncate font-mono text-[10px]"
                            title={item.actorUserId}
                          >
                            {item.actorUserId.slice(0, 12) + '…'}
                          </span>
                        ) : (
                          'System'
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-slate-500">
                        {details.length > 0 ? (
                          <div className="flex max-w-full flex-wrap gap-1.5">
                            {details.map((detail) => (
                              <span
                                key={detail.label}
                                className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-md bg-slate-100 px-2 py-1"
                              >
                                <span className="font-semibold text-slate-600">{detail.label}:</span>
                                <span className="break-words text-slate-700">{detail.value}</span>
                              </span>
                            ))}
                          </div>
                        ) : item.details ? (
                          <span className="text-slate-400">Additional details recorded</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
