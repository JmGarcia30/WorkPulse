'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Banknote, BriefcaseBusiness, Building2, CalendarDays, Clock3, ExternalLink, LayoutDashboard, Settings, Users } from 'lucide-react';
import { Role } from '@prisma/client';

type NavItem = { href: string; label: string };

export function DashboardSidebarNav({ orgSlug, role, onNavigate }: { orgSlug?: string; role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const hrAccess = role === Role.ORGANIZATION_ADMIN || role === Role.HR_ADMIN;
  const active = (href: string) => href === '/dashboard' ? pathname === href : pathname.startsWith(href);
  const sections: Array<{ href: string; label: string; icon: typeof LayoutDashboard; children?: NavItem[] }> = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/hiring/pipeline', label: 'Hiring', icon: BriefcaseBusiness, children: [
      { href: '/dashboard/hiring/pipeline', label: 'Hiring Pipeline' },
      { href: '/dashboard/hiring/jobs', label: 'Job Openings' },
      { href: '/dashboard/hiring/applicants', label: 'Applicants' },
      { href: '/dashboard/hiring/interviews', label: 'Interviews' },
      { href: '/dashboard/hiring/assessments', label: 'Assessments' },
      { href: '/dashboard/hiring/offers', label: 'Offers' },
      { href: '/dashboard/hiring/onboarding', label: 'Onboarding' },
    ] },
    ...(hrAccess ? [
      { href: '/dashboard/employees', label: 'Employees', icon: Users, children: [{ href: '/dashboard/employees', label: 'Employee Records' }] },
      { href: '/dashboard/attendance', label: 'Attendance', icon: Clock3, children: [{ href: '/dashboard/attendance', label: 'Employee Attendance' }, { href: '/dashboard/attendance/schedules', label: 'Work Schedules' }] },
      { href: '/dashboard/leave', label: 'Leave', icon: CalendarDays, children: [{ href: '/dashboard/leave', label: 'Leave Requests' }, { href: '/dashboard/leave/balances', label: 'Leave Balances' }, { href: '/dashboard/leave/settings', label: 'Leave Settings' }] },
      { href: '/dashboard/payroll', label: 'Payroll', icon: Banknote },
    ] : []),
    { href: '/dashboard/organization', label: 'Organization Settings', icon: Settings },
  ];

  return <nav aria-label="Main navigation" className="space-y-1 p-3">{sections.map(section => {
    const Icon = section.icon;
    const sectionActive = active(section.href) || (section.label === 'Hiring' && pathname.startsWith('/dashboard/hiring'));
    return <div key={section.label}>
      <Link href={section.href} onClick={onNavigate} aria-current={sectionActive ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${sectionActive ? 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)]' : 'text-[var(--wp-text-muted)] hover:bg-[var(--tenant-tint-strong)] hover:text-[var(--wp-text)]'}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{section.label}</span></Link>
      {section.children && sectionActive ? <div className="ml-5 mt-1 space-y-0.5 border-l border-[var(--tenant-border)] pl-3">{section.children.map(child => <Link key={child.href} href={child.href} onClick={onNavigate} aria-current={pathname === child.href ? 'page' : undefined} className={`block rounded-lg px-3 py-2 text-xs font-semibold ${pathname === child.href || pathname.startsWith(`${child.href}/`) ? 'bg-[var(--tenant-tint-strong)] text-[var(--tenant-primary)]' : 'text-[var(--wp-text-muted)] hover:bg-[var(--tenant-tint)] hover:text-[var(--wp-text)]'}`}>{child.label}</Link>)}</div> : null}
    </div>;
  })}
  {orgSlug ? <div className="mt-3 border-t border-[var(--tenant-border)] pt-3"><Link href="/careers" target="_blank" onClick={onNavigate} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--wp-text-muted)] hover:bg-[var(--tenant-tint)] hover:text-[var(--wp-text)]"><Building2 className="h-4 w-4" aria-hidden="true" /><span>Public Career Site</span><ExternalLink className="ml-auto h-3.5 w-3.5" aria-hidden="true" /></Link></div> : null}
  </nav>;
}
