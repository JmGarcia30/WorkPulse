'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Menu, X, LogOut } from 'lucide-react';
import { Role } from '@prisma/client';
import { DashboardSidebarNav } from './DashboardSidebarNav';
import { DialogFrame } from '@/components/ui/DialogFrame';
import { logoutAction } from '@/lib/auth/actions';
import { resolveTenantHref, stripTenantPrefix } from '@/lib/tenant/navigation';

export function DashboardHeader({ orgName, orgSlug, role }: { orgName: string; orgSlug?: string; role: Role }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const labelMap: Record<string, string> = {
    hiring: 'Hiring',
    pipeline: 'Pipeline',
    jobs: 'Job openings',
    applicants: 'Applicants',
    interviews: 'Interviews',
    assessments: 'Assessments',
    offers: 'Offers',
    onboarding: 'Onboarding',
    employees: 'Employees',
    attendance: 'Attendance',
    schedules: 'Work schedules',
    leave: 'Leave',
    balances: 'Leave balances',
    settings: 'Settings',
    payroll: 'Payroll',
    payslips: 'Payslips',
    analytics: 'Analytics',
    organization: 'Organization settings',
    new: 'Create',
    edit: 'Edit',
  };

  const normalizedPath = stripTenantPrefix(pathname);
  const segments = normalizedPath.split('/').filter(Boolean).slice(1);
  const breadcrumbs = [
    { label: 'Dashboard', href: resolveTenantHref('/dashboard', pathname) },
    ...segments.map((segment, index) => {
      const canonical = `/dashboard/${segments.slice(0, index + 1).join('/')}`;
      const destination = canonical === '/dashboard/hiring' ? '/dashboard/hiring/pipeline' : canonical;
      return {
        label: labelMap[segment] ?? 'Details',
        href: resolveTenantHref(destination, pathname),
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border md:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-haspopup="dialog"
          >
            <Menu className="h-5 w-5" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
            <ol className="flex items-center gap-2">
              {breadcrumbs.map((crumb, index) => (
                <li key={crumb.href} className="flex min-w-0 items-center gap-2">
                  {index > 0 ? (
                    <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-[var(--wp-text-muted)] sm:block" aria-hidden="true" />
                  ) : null}
                  {index === breadcrumbs.length - 1 ? (
                    <span aria-current="page" className="truncate font-semibold">
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
        <span className="max-w-36 truncate text-sm text-[var(--wp-text-muted)] sm:max-w-64">{orgName}</span>
      </header>
      {mobileOpen ? (
        <DialogFrame label="WorkPulse navigation" onClose={() => setMobileOpen(false)} className="wp-mobile-nav">
          <div className="flex min-h-full flex-col bg-white">
            <div className="flex min-h-16 items-center justify-between gap-3 border-b px-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{orgName}</p>
                <p className="text-sm text-[var(--wp-text-muted)]">WorkPulse</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1">
              <DashboardSidebarNav orgSlug={orgSlug} role={role} onNavigate={() => setMobileOpen(false)} />
            </div>
            <form action={logoutAction} className="border-t p-4">
              <button type="submit" className="wp-button-secondary w-full">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </DialogFrame>
      ) : null}
    </>
  );
}
