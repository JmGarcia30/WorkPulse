import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Role } from '@prisma/client';
import { logoutAction } from '@/lib/auth/actions';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { getOrganizationBranding } from '@/features/organization-branding/read-model';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { DashboardSidebarNav } from '@/components/layout/DashboardSidebarNav';
import { DashboardHeader } from '@/components/layout/DashboardHeader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user; try { user = await requireBackOfficeContext(); } catch { redirect('/login'); }
  if (user.role === Role.EMPLOYEE) redirect('/employee');
  const brand = await getOrganizationBranding(user.organizationId); if (!brand) redirect('/login');
  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return <TenantTheme branding={brand}><div className="flex min-h-screen bg-[var(--wp-background)] text-[var(--wp-text)]"><aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r bg-[var(--wp-surface)] md:flex"><div className="border-b px-5 py-5"><div className="flex items-center gap-3">{brand.hasLogo ? <img alt="" className="h-9 w-9 object-contain" src="/api/branding/logo" /> : <span className="flex h-9 w-9 items-center justify-center bg-[var(--tenant-primary)] text-xs font-black text-[var(--tenant-primary-foreground)]">{brand.displayName.slice(0, 2).toUpperCase()}</span>}<div className="min-w-0"><p className="truncate text-sm font-bold">{brand.displayName}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wp-text-muted)]">Powered by WorkPulse</p></div></div></div><div className="flex-1 overflow-y-auto"><DashboardSidebarNav orgSlug={brand.slug} /></div><div className="border-t p-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center bg-[var(--wp-surface-subtle)] text-xs font-bold">{initials}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{user.name}</p><p className="truncate text-[10px] text-[var(--wp-text-muted)]">{user.role.replaceAll('_', ' ')}</p></div><form action={logoutAction}><button title="Sign out" className="p-2 text-[var(--wp-text-muted)] hover:text-[var(--wp-danger)]"><LogOut className="h-4 w-4" /></button></form></div></div></aside><div className="min-w-0 flex-1"><DashboardHeader orgName={brand.displayName} /><main className="mx-auto w-full max-w-[92rem] p-5 sm:p-7 lg:p-9">{children}</main></div></div></TenantTheme>;
}
