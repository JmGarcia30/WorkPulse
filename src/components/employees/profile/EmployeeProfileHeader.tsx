import React from 'react';
import { EmployeeStatus, EmploymentCategory } from '@prisma/client';
import { ArrowLeft, Mail, Phone, Building2, Briefcase, AlertTriangle } from 'lucide-react';
import { TenantLink } from '@/components/ui/TenantLink';
import { formatStatusLabel } from '@/lib/ui/format-status';

interface EmployeeProfileHeaderProps {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    employeeStatus: EmployeeStatus;
  };
  currentRecord: {
    jobTitle: string;
    department: string;
    employmentCategory: EmploymentCategory;
    employmentStatus: import('@prisma/client').EmploymentStatus;
  } | null;
  isHistoricalOnly: boolean;
}

function getInitials(firstName: string, lastName: string): string {
  const f = firstName?.trim() || '';
  const l = lastName?.trim() || '';
  if (!f && !l) return '—';
  if (!l) return f.slice(0, 2).toUpperCase();
  if (!f) return l.slice(0, 2).toUpperCase();
  return `${f[0]}${l[0]}`.toUpperCase();
}

function renderStatusBadge(status: EmployeeStatus) {
  switch (status) {
    case EmployeeStatus.ACTIVE:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Active
        </span>
      );
    case EmployeeStatus.INACTIVE:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200/70">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
          Inactive
        </span>
      );
    case EmployeeStatus.SEPARATED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200/70">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
          Separated
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {formatStatusLabel(status)}
        </span>
      );
  }
}

export function EmployeeProfileHeader({
  employee,
  currentRecord,
  isHistoricalOnly,
}: EmployeeProfileHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Back button */}
      <div>
        <TenantLink
          href="/dashboard/employees"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Employee Records
        </TenantLink>
      </div>

      {/* Main Identity Card */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          {/* Avatar & Details */}
          <div className="flex items-start gap-4 min-w-0">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-800 ring-1 ring-slate-200/80 shadow-2xs">
              {getInitials(employee.firstName, employee.lastName)}
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
                  {employee.firstName} {employee.lastName}
                </h1>
                {renderStatusBadge(employee.employeeStatus)}
                {currentRecord && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200/60">
                    {formatStatusLabel(currentRecord.employmentStatus)}
                  </span>
                )}
              </div>

              {/* Subtitle: Position, Department, Category */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                {currentRecord?.jobTitle && (
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                    {currentRecord.jobTitle}
                  </span>
                )}
                {currentRecord?.department && (
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    {currentRecord.department}
                  </span>
                )}
                {currentRecord?.employmentCategory && (
                  <span className="text-slate-500">
                    · {formatStatusLabel(currentRecord.employmentCategory)}
                  </span>
                )}
              </div>

              {/* Contact info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3 text-slate-400" />
                  {employee.email}
                </span>
                {employee.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-400" />
                    {employee.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Employee Number */}
          <div className="sm:text-right shrink-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Employee Number
            </span>
            <span className="mt-0.5 inline-block font-mono text-sm font-semibold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/70">
              {employee.employeeNumber}
            </span>
          </div>
        </div>

        {/* Inactive employee notice banner if applicable */}
        {isHistoricalOnly && (
          <div className="mt-4 rounded-lg bg-amber-50/80 border border-amber-200/70 p-3 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Inactive Employee Record</p>
              <p className="text-amber-700 mt-0.5">
                This employee has no active employment relationship today. The information shown
                reflects their latest historical employment appointment. This does not indicate
                completed Exit, clearance, or formal separation.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
