import React from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { TenantLink } from '@/components/ui/TenantLink';

interface EmployeeDirectoryHeaderProps {
  totalEmployees: number;
}

export function EmployeeDirectoryHeader({ totalEmployees }: EmployeeDirectoryHeaderProps) {
  return (
    <div className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 min-w-0">
        {/* Simple Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <TenantLink href="/dashboard" className="hover:text-slate-700 transition">
            Dashboard
          </TenantLink>
          <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" aria-hidden="true" />
          <span className="text-slate-600 font-semibold" aria-current="page">
            Employees
          </span>
        </nav>

        {/* Title & Total Count Badge */}
        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Employee Records
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200/60">
            <Users className="h-3 w-3 text-slate-400" />
            {totalEmployees} {totalEmployees === 1 ? 'employee' : 'employees'}
          </span>
        </div>

        {/* Supporting description */}
        <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
          Manage employee information, employment status, and probation reviews.
        </p>
      </div>
    </div>
  );
}
