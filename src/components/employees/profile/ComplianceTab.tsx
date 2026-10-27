import React from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldAlert,
  ClipboardList,
  FileSignature,
} from 'lucide-react';
import { TenantLink } from '@/components/ui/TenantLink';
import { formatStatusLabel } from '@/lib/ui/format-status';

interface ComplianceTabProps {
  sourceApplicationId: string;
  offer: {
    status: string;
    contractExecutedAt: Date | null;
    contractSignedByPresident: boolean;
    contractSignedByEmployee: boolean;
  } | null;
  onboarding: {
    status: string;
    tasks: Array<{
      id: string;
      title: string;
      type: import('@prisma/client').OnboardingTaskType;
      isRequired: boolean;
      status: import('@prisma/client').OnboardingTaskStatus;
      verifiedAt: Date | null;
    }>;
  } | null;
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

export function ComplianceTab({
  sourceApplicationId,
  offer,
  onboarding,
}: ComplianceTabProps) {
  const tasks = onboarding?.tasks ?? [];
  const requiredTasks = tasks.filter((t) => t.isRequired);
  const satisfiedTasks = requiredTasks.filter(
    (t) => t.status === 'VERIFIED' || t.status === 'WAIVED'
  );
  const completionPct =
    requiredTasks.length > 0
      ? Math.round((satisfiedTasks.length / requiredTasks.length) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* 1. Contract & Execution State */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-slate-500" />
              Contract Execution & Offer Acceptance
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Verified legal signatures and institutional contract execution status
            </p>
          </div>
          {offer && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {formatStatusLabel(offer.status)}
            </span>
          )}
        </div>

        {offer ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <dt className="text-slate-400 font-medium">Offer Status</dt>
              <dd className="mt-0.5 font-bold text-slate-800">
                {formatStatusLabel(offer.status)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">Contract Executed Date</dt>
              <dd className="mt-0.5 font-bold text-slate-800">
                {formatDate(offer.contractExecutedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">President Signature</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-semibold text-slate-800">
                {offer.contractSignedByPresident ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Signed</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-slate-400" />
                    <span>Pending</span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">Employee Signature</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-semibold text-slate-800">
                {offer.contractSignedByEmployee ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Signed</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-slate-400" />
                    <span>Pending</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-slate-500 py-2">
            No accepted offer record linked to this appointment.
          </p>
        )}
      </div>

      {/* 2. Onboarding & Requirements Checklist */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-slate-500" />
              Onboarding & Institutional Compliance
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Statutory documents, credentials, and institutional onboarding requirements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              {satisfiedTasks.length} of {requiredTasks.length} satisfied ({completionPct}%)
            </span>
            {onboarding?.status && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                {formatStatusLabel(onboarding.status)}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${completionPct}%` }}
          />
        </div>

        {/* Tasks list */}
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No onboarding checklist tasks found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3.5 py-2.5">Requirement</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Mandatory</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Verified Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-3.5 py-3 font-semibold text-slate-800">
                      {task.title}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {formatStatusLabel(task.type)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {task.isRequired ? (
                        <span className="text-amber-700 font-semibold">Required</span>
                      ) : (
                        <span className="text-slate-400">Optional</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${task.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : task.status === 'WAIVED'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                          }`}
                      >
                        {formatStatusLabel(task.status)}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap text-slate-500">
                      {formatDate(task.verifiedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Upstream Hiring Application Link */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Upstream Hiring Traceability</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect the original candidate application, interview notes, and assessment evaluations.
          </p>
        </div>
        <TenantLink
          href={`/dashboard/hiring/applicants/${sourceApplicationId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tenant-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--tenant-primary-foreground)] shadow-2xs hover:brightness-95 transition"
        >
          View Hiring Record
          <ExternalLink className="h-3.5 w-3.5" />
        </TenantLink>
      </div>
    </div>
  );
}
