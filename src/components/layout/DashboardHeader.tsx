'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Menu, X } from 'lucide-react';
import { Role } from '@prisma/client';
import { DashboardSidebarNav } from './DashboardSidebarNav';

export function DashboardHeader({ orgName, orgSlug, role }: { orgName: string; orgSlug?: string; role: Role }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const labelMap: Record<string, string> = { hiring: 'Hiring', pipeline: 'Hiring Pipeline', jobs: 'Job Openings', applicants: 'Applicants', interviews: 'Interviews', assessments: 'Assessments', offers: 'Offers', onboarding: 'Onboarding', employees: 'Employees', attendance: 'Attendance', schedules: 'Work Schedules', leave: 'Leave', balances: 'Leave Balances', settings: 'Settings', payroll: 'Payroll', payslips: 'Payslips', organization: 'Organization Settings', new: 'Create', edit: 'Edit' };
  const segments = pathname.split('/').filter(Boolean).slice(1);
  const breadcrumbs = [{ label: 'Dashboard', href: '/dashboard' }, ...segments.map((segment, index) => ({ label: labelMap[segment] ?? 'Details', href: `/dashboard/${segments.slice(0, index + 1).join('/')}` }))];

  return <>
    <header className="wp-tenant-rule sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setMobileOpen(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--tenant-border)] text-[var(--wp-text)] md:hidden" aria-label="Open navigation" aria-expanded={mobileOpen}><Menu className="h-5 w-5" /></button><nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">{breadcrumbs.map((crumb, index) => <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">{index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--wp-text-muted)]" aria-hidden="true" /> : null}{index === breadcrumbs.length - 1 ? <span className="max-w-36 truncate font-bold text-[var(--tenant-primary)] sm:max-w-52">{crumb.label}</span> : <Link href={crumb.href} className="hidden font-medium text-[var(--wp-text-muted)] hover:text-[var(--tenant-primary)] sm:block">{crumb.label}</Link>}</span>)}</nav></div>
      <span className="max-w-44 truncate text-xs font-semibold text-[var(--wp-text-muted)] sm:max-w-64">{orgName}</span>
    </header>
    {mobileOpen ? <div className="fixed inset-0 z-50 md:hidden"><button type="button" className="absolute inset-0 bg-slate-950/35" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /><aside className="relative flex h-full w-[min(86vw,20rem)] flex-col bg-white shadow-xl"><div className="flex min-h-16 items-center justify-between border-b border-[var(--tenant-border)] px-4"><div><p className="text-sm font-bold">{orgName}</p><p className="text-xs text-[var(--wp-text-muted)]">WorkPulse navigation</p></div><button type="button" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border" aria-label="Close navigation"><X className="h-5 w-5" /></button></div><div className="flex-1 overflow-y-auto"><DashboardSidebarNav orgSlug={orgSlug} role={role} onNavigate={() => setMobileOpen(false)} /></div></aside></div> : null}
  </>;
}
