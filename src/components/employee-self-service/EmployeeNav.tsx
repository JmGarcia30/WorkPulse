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
    <nav aria-label="Employee navigation" className="space-y-1 pl-[26px] pr-3 py-2">
      {employeeNavLinks.map(({ href, label, icon: Icon }) => {
        const active = isRouteActive(href, pathname);
        return (
          <Link
            key={href}
            href={resolveTenantHref(href, pathname)}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex min-h-10 items-center gap-3.5 rounded-lg px-1.5 py-1 text-[13px] font-medium leading-normal transition-colors duration-150 ${active
              ? 'text-[#C7A759]'
              : 'text-white'
              }`}
          >
            {active ? (
              <span
                className="pointer-events-none absolute left-1 md:-left-[26px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full md:rounded-r-full bg-[#C7A759]"
                aria-hidden="true"
              />
            ) : (
              <span
                className="pointer-events-none absolute left-1 md:-left-[26px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full md:rounded-r-full bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                aria-hidden="true"
              />
            )}
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] transition-colors duration-150 ${active
                ? 'bg-[#383A40]'
                : 'bg-transparent group-hover:bg-white/[0.06]'
                }`}
            >
              <Icon
                className={`h-[17px] w-[17px] shrink-0 transition-colors duration-150 ${active
                  ? 'text-[#C7A759]'
                  : 'text-[#B4B5C0] group-hover:text-white'
                  }`}
                aria-hidden="true"
              />
            </span>
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
