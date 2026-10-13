'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BriefcaseBusiness, CalendarDays, FileText, LayoutDashboard, ReceiptText, UserRound } from 'lucide-react';

const links = [
  { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee/attendance', label: 'Attendance', icon: CalendarDays },
  { href: '/employee/leave', label: 'Leave', icon: FileText },
  { href: '/employee/payroll', label: 'Payroll', icon: ReceiptText },
  { href: '/employee/employment', label: 'Employment', icon: BriefcaseBusiness },
  { href: '/employee/profile', label: 'Profile', icon: UserRound },
];

export function EmployeeNav() {
  const pathname = usePathname();
  return <nav className="space-y-2 p-4">
    {links.map(({ href, label, icon: Icon }) => {
      const active = href === '/employee' ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} className={`flex items-center gap-3 border-l-2 px-4 py-2.5 text-sm font-semibold ${active ? 'border-[var(--tenant-accent)] bg-[var(--wp-surface-subtle)] text-[var(--wp-text)]' : 'border-transparent text-[var(--wp-text-muted)] hover:bg-[var(--wp-surface-subtle)]'}`}><Icon className="h-4 w-4" />{label}</Link>;
    })}
  </nav>;
}
