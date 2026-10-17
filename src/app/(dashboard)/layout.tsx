import './workspace.css';
import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Role } from '@prisma/client';
import { logoutAction } from '@/lib/auth/actions';
import { getBackOfficeReadContext } from '@/lib/auth/guards';
import { getRequestOrganizationBranding } from '@/lib/tenant/server';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { DashboardSidebarNav } from '@/components/layout/DashboardSidebarNav';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { TenantLogo } from '@/components/layout/TenantLogo';
import { formatStatusLabel } from '@/lib/ui/format-status';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user; try { user = await getBackOfficeReadContext(); } catch { redirect('/login'); }
  if (user.role === Role.EMPLOYEE) redirect('/employee');
  const brand = await getRequestOrganizationBranding(user.organizationId); if (!brand) redirect('/login');
  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return <TenantTheme branding={brand}><div className="wp-workspace wp-tenant-shell flex min-h-screen text-[var(--wp-text)]"><a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 wp-button-primary">Skip to content</a><aside className="wp-tenant-sidebar sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r md:flex"><div className="wp-tenant-rule border-b px-5 py-5"><div className="flex items-center gap-3"><TenantLogo branding={brand} size={40} className="h-10 w-10 rounded-lg bg-white object-contain" fallbackClassName="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-sm font-black text-[var(--tenant-primary-foreground)]" /><div className="min-w-0"><p className="truncate text-sm font-bold">{brand.displayName}</p><p className="text-sm font-semibold uppercase tracking-wider text-[var(--tenant-accent)]">WorkPulse HR</p></div></div></div><div className="flex-1 overflow-y-auto"><DashboardSidebarNav orgSlug={brand.slug} role={user.role} /></div><div className="wp-tenant-rule border-t p-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tenant-tint-strong)] text-sm font-bold text-[var(--tenant-primary)]">{initials}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user.name}</p><p className="truncate text-sm text-[var(--wp-text-muted)]">{formatStatusLabel(user.role)}</p></div><form action={logoutAction}><button type="submit" aria-label="Sign out" title="Sign out" className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--wp-text-muted)] hover:bg-red-50 hover:text-[var(--wp-danger)]"><LogOut className="h-4 w-4" /></button></form></div></div></aside><div className="min-w-0 flex-1"><DashboardHeader orgName={brand.displayName} orgSlug={brand.slug} role={user.role} /><main id="workspace-content" tabIndex={-1} className="mx-auto w-full max-w-[100rem] p-4 sm:p-6 lg:p-8 xl:p-8">{children}</main></div></div></TenantTheme>;
}
