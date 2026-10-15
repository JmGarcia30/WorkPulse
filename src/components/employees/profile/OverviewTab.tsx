import React from 'react';
import {
  Briefcase,
  Calendar,
  Clock,
  ExternalLink,
  ShieldCheck,
  Building2,
  AlertCircle,
  FileText,
  BadgeAlert,
} from 'lucide-react';
import { TenantLink } from '@/components/ui/TenantLink';
import { formatStatusLabel } from '@/lib/ui/format-status';
import type { EmploymentCategory, EmploymentStatus } from '@prisma/client';
import type { ProbationReviewSummary } from '@/features/employees/domain';

interface OverviewTabProps {
  employeeId: string;
  sourceApplicationId: string;
  currentRecord: {
    jobTitle: string;
    department: string;
    employmentCategory: EmploymentCategory;
    employmentStatus: EmploymentStatus;
    employmentType: string;
    salary: { toString(): string };
    payFrequency: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    hireDate: Date;
  };
  probationReview: ProbationReviewSummary | null;
  probationExpectedEndAt: Date | null;
  isHistoricalOnly: boolean;
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

export function OverviewTab({
  employeeId,
  sourceApplicationId,
  currentRecord,
  probationReview,
  probationExpectedEndAt,
  isHistoricalOnly,
}: OverviewTabProps) {
  return (
    <div className="space-y-5">
      {/* Pending Attention Alert if Review is Due / Overdue */}
      {probationReview?.needsAttention && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs text-amber-900 shadow-2xs flex items-start gap-3">
          <BadgeAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">
              HR Review Attention Required: {formatStatusLabel(probationReview.state)}
            </p>
            <p className="text-amber-800 leading-relaxed">
              {probationReview.daysRemaining < 0
                ? `This employee's probation evaluation is overdue by ${Math.abs(probationReview.daysRemaining)} days (due ${formatDate(probationExpectedEndAt)}). Please review the Probation tab to record an employment decision.`
                : probationReview.daysRemaining === 0
                ? `This employee's probation evaluation is due today (${formatDate(probationExpectedEndAt)}). Navigate to the Probation tab to evaluate.`
                : `This employee's probation period is ending soon (${probationReview.daysRemaining} days remaining until ${formatDate(probationExpectedEndAt)}).`}
            </p>
          </div>
        </div>
      )}

      {/* Grid of Main Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* Panel 1: Current Employment Details */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-slate-500" />
              {isHistoricalOnly ? 'Latest Historical Appointment' : 'Current Employment Record'}
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {formatStatusLabel(currentRecord.employmentStatus)}
            </span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
            <div>
              <dt className="text-slate-400 font-medium">Position Title</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{currentRecord.jobTitle}</dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">Department</dt>
              <dd className="mt-0.5 font-bold text-slate-800">
                {currentRecord.department || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">Category</dt>
              <dd className="mt-0.5 font-semibold text-slate-700">
                {formatStatusLabel(currentRecord.employmentCategory)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">Employment Type</dt>
              <dd className="mt-0.5 font-semibold text-slate-700">
                {currentRecord.employmentType}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">Effective Period</dt>
              <dd className="mt-0.5 font-semibold text-slate-700">
                {formatDate(currentRecord.effectiveFrom)} –{' '}
                {currentRecord.effectiveTo ? formatDate(currentRecord.effectiveTo) : 'Present'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">Original Hire Date</dt>
              <dd className="mt-0.5 font-semibold text-slate-700">
                {formatDate(currentRecord.hireDate)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Panel 2: Contractual Pay Snapshot */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              Contractual Pay Terms
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              EmploymentRecord appointment snapshot
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 font-medium">Base Contract Rate</span>
              <span className="font-mono text-base font-bold text-slate-900">
                ₱{currentRecord.salary.toString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-200/60 pt-2">
              <span>Pay Frequency</span>
              <span className="font-semibold text-slate-800">
                {formatStatusLabel(currentRecord.payFrequency)}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed italic">
            * Note: These values represent the static contractual snapshot recorded at hiring/conversion.
            Live compensation, government withholdings, and operational disbursements are computed in
            the Payroll module.
          </p>
        </div>

        {/* Panel 3: Probation Status Quick Summary */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3.5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Probation Summary
            </h2>
            {probationReview && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {formatStatusLabel(probationReview.state)}
              </span>
            )}
          </div>

          {probationReview && probationExpectedEndAt ? (
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-400">Review State</dt>
                <dd className="font-bold text-slate-800">{formatStatusLabel(probationReview.state)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Expected End Date</dt>
                <dd className="font-bold text-slate-800">{formatDate(probationExpectedEndAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Days to Review</dt>
                <dd className="font-bold text-slate-800">
                  {probationReview.daysRemaining < 0
                    ? `${Math.abs(probationReview.daysRemaining)} days overdue`
                    : `${probationReview.daysRemaining} days remaining`}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Action Available</dt>
                <dd className="font-bold text-slate-800">
                  {probationReview.decisionAllowed ? 'Yes (Evaluation open)' : 'Pending end date'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-slate-500">
              Employee is classified as Regular or has no active probationary appointment today.
            </p>
          )}

          <div className="pt-2 border-t border-slate-100">
            <TenantLink
              href={`/dashboard/employees/${employeeId}?tab=probation`}
              className="text-xs font-semibold text-[var(--tenant-primary)] hover:underline inline-flex items-center gap-1"
            >
              View complete probation details and history →
            </TenantLink>
          </div>
        </div>

        {/* Panel 4: Cross-Module Traceability Links */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3.5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-slate-500" />
              Related Records & Traceability
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Quick links to upstream hiring and operational logs
            </p>
          </div>

          <div className="space-y-2.5">
            <TenantLink
              href={`/dashboard/hiring/applicants/${sourceApplicationId}`}
              className="flex items-center justify-between rounded-lg border border-slate-200/90 bg-white p-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-slate-400" />
                <span>View Original Hiring Application</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </TenantLink>

            <TenantLink
              href={`/dashboard/attendance/${employeeId}`}
              className="flex items-center justify-between rounded-lg border border-slate-200/90 bg-white p-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>View Attendance Logs & Timesheets</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </TenantLink>
          </div>
        </div>
      </div>
    </div>
  );
}
