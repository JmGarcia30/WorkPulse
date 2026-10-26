'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Menu, X, LogOut, User } from 'lucide-react';
import { EmployeeNav } from './EmployeeNav';
import { DialogFrame } from '@/components/ui/DialogFrame';
import { logoutAction } from '@/lib/auth/actions';
import { resolveTenantHref, stripTenantPrefix } from '@/lib/tenant/navigation';

export function EmployeeHeader({
  orgName,
  orgSlug: _orgSlug,
  employeeName,
  employeeNumber,
}: {
  orgName: string;
  orgSlug?: string;
  employeeName: string;
  employeeNumber: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const labelMap: Record<string, string> = {
    employee: 'Dashboard',
    attendance: 'Attendance',
    leave: 'Leave',
    new: 'Apply',
    payroll: 'Payroll',
    profile: 'Profile',
    employment: 'Employment',
    resignation: 'Resignation',
    form: 'Print form',
  };

  const normalizedPath = stripTenantPrefix(pathname);
  const segments = normalizedPath.split('/').filter(Boolean).slice(1);
  const breadcrumbs = [
    { label: 'Dashboard', href: resolveTenantHref('/employee', pathname) },
    ...segments.map((segment, index) => {
      const canonical = `/employee/${segments.slice(0, index + 1).join('/')}`;
      return {
        label: labelMap[segment] ?? 'Details',
        href: resolveTenantHref(canonical, pathname),
      };
    }),
  ];

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[var(--wp-border)] bg-white px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--wp-border)] text-[var(--wp-text)] md:hidden hover:bg-[var(--wp-surface-subtle)] focus-visible:outline-2"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-haspopup="dialog"
          >
            <Menu className="h-5 w-5" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
            <ol className="flex items-center gap-2">
              {breadcrumbs.map((crumb, index) => (
                <li key={`${index}:${crumb.href}`} className="flex min-w-0 items-center gap-2">
                  {index > 0 ? (
                    <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-[var(--wp-text-muted)] sm:block" aria-hidden="true" />
                  ) : null}
                  {index === breadcrumbs.length - 1 ? (
                    <span aria-current="page" className="truncate font-semibold text-[var(--wp-text)]">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="hidden text-[var(--wp-text-muted)] hover:text-[var(--tenant-primary)] sm:block"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs font-semibold uppercase tracking-wider text-[var(--tenant-accent)] sm:inline">
            ESS Portal
          </span>
          <span className="max-w-36 truncate text-sm font-medium text-[var(--wp-text-muted)] sm:max-w-64">
            {orgName}
          </span>
        </div>
      </header>

      {mobileOpen ? (
        <DialogFrame label="WorkPulse Employee Navigation" onClose={() => setMobileOpen(false)} className="wp-mobile-nav">
          <div className="flex min-h-full flex-col bg-white">
            <div className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--wp-border)] px-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--wp-text)]">{orgName}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tenant-accent)]">WorkPulse ESS</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--wp-border)] text-[var(--wp-text)] hover:bg-[var(--wp-surface-subtle)]"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <EmployeeNav onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-[var(--wp-border)] p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tenant-tint-strong)] text-sm font-bold text-[var(--tenant-primary)]">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--wp-text)]">{employeeName}</p>
                  <p className="truncate text-xs text-[var(--wp-text-muted)]">{employeeNumber}</p>
                </div>
              </div>
              <form action={logoutAction}>
                <button type="submit" className="wp-button-secondary w-full text-xs font-bold text-[var(--wp-danger)] hover:bg-red-50">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </DialogFrame>
      ) : null}
    </>
  );
}
