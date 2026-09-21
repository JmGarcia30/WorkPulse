'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FileText, LayoutDashboard, ReceiptText, UserRound } from 'lucide-react';

const links = [
  { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee/profile', label: 'My Profile', icon: UserRound },
  { href: '/employee/attendance', label: 'My Attendance', icon: CalendarDays },
  { href: '/employee/leave', label: 'My Leave', icon: FileText },
];

export function EmployeeNav() {
  const pathname = usePathname();
  return <nav className="space-y-2 p-4">
    {links.map(({ href, label, icon: Icon }) => {
      const active = href === '/employee' ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} className={`flex items-center gap-3 border-l-2 px-4 py-2.5 text-sm font-semibold ${active ? 'border-[var(--tenant-accent)] bg-[var(--wp-surface-subtle)] text-[var(--wp-text)]' : 'border-transparent text-[var(--wp-text-muted)] hover:bg-[var(--wp-surface-subtle)]'}`}><Icon className="h-4 w-4" />{label}</Link>;
    })}
    <div className="pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Coming Soon</div>
    {[['Payslips', ReceiptText], ['Documents', FileText]].map(([label, Icon]) => <div key={String(label)} aria-disabled="true" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400"><Icon className="h-4 w-4" />{String(label)}</div>)}
  </nav>;
}
