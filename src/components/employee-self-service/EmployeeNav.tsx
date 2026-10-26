'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  LayoutDashboard,
  LogOut,
  UserRound,
} from 'lucide-react';
import { isRouteActive, resolveTenantHref } from '@/lib/tenant/navigation';

export interface EmployeeNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export const employeeNavLinks: EmployeeNavItem[] = [
  { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee/attendance', label: 'Attendance', icon: Clock3 },
  { href: '/employee/leave', label: 'Leave', icon: CalendarDays },
  { href: '/employee/payroll', label: 'Payroll', icon: Banknote },
  { href: '/employee/employment', label: 'Employment', icon: BriefcaseBusiness },
  { href: '/employee/resignation', label: 'Resignation', icon: LogOut },
  { href: '/employee/profile', label: 'Profile', icon: UserRound },
];

export function EmployeeNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Employee navigation" className="space-y-1 pl-4 pr-2 py-2">
      {employeeNavLinks.map(({ href, label, icon: Icon }) => {
        const active = isRouteActive(href, pathname);
        return (
          <Link
            key={href}
            href={resolveTenantHref(href, pathname)}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active
                ? 'bg-[var(--tenant-tint)] font-semibold text-[var(--tenant-primary)]'
                : 'font-medium text-[var(--wp-text-muted)] hover:bg-[var(--tenant-tint)] hover:text-[var(--wp-text)]'
              }`}
          >
            {active ? (
              <span
                className="pointer-events-none absolute left-1 md:-left-4 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full md:rounded-r-full bg-[var(--tenant-primary)]"
                aria-hidden="true"
              />
            ) : null}
            <Icon
              className={`h-4 w-4 shrink-0 transition-colors ${active
                  ? 'text-[var(--tenant-primary)]'
                  : 'text-[var(--wp-text-muted)] group-hover:text-[var(--wp-text)]'
                }`}
              aria-hidden="true"
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
