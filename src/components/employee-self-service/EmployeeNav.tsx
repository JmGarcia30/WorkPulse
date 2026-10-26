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
    <nav aria-label="Employee navigation" className="space-y-1 p-3">
      {employeeNavLinks.map(({ href, label, icon: Icon }) => {
        const active = isRouteActive(href, pathname);
        return (
          <Link
            key={href}
            href={resolveTenantHref(href, pathname)}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${
              active
                ? 'border-l-2 border-[var(--tenant-primary)] bg-[var(--tenant-tint)] text-[var(--tenant-primary)]'
                : 'text-[var(--wp-text-muted)] hover:bg-[var(--tenant-tint-strong)] hover:text-[var(--wp-text)]'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
