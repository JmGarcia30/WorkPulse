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
import { ScrollableMainContent } from '@/components/layout/ScrollableMainContent';
import { formatStatusLabel } from '@/lib/ui/format-status';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getBackOfficeReadContext();
  } catch {
    redirect('/login');
  }
  if (user.role === Role.EMPLOYEE) redirect('/employee');
  const brand = await getRequestOrganizationBranding(user.organizationId);
  if (!brand) redirect('/login');
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <TenantTheme branding={brand}>
      <div className="wp-workspace wp-tenant-shell flex h-screen h-[100dvh] overflow-hidden text-[var(--wp-text)] bg-white">
        <a
          href="#workspace-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 wp-button-primary"
        >
          Skip to content
        </a>

        {/* Existing sidebar outside the container */}
        <aside className="wp-tenant-sidebar sticky top-0 z-30 hidden h-full w-60 shrink-0 flex-col bg-transparent md:flex">
          <div className="px-3 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <TenantLogo
                branding={brand}
                size={40}
                className="h-10 w-10 rounded-lg bg-white object-contain"
                fallbackClassName="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-sm font-black text-[var(--tenant-primary-foreground)]"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{brand.displayName}</p>
                <p className="text-sm font-semibold uppercase tracking-wider text-[var(--tenant-accent)]">
                  WorkPulse HR
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DashboardSidebarNav orgSlug={brand.slug} role={user.role} />
          </div>
          <div className="p-3 pb-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tenant-tint-strong)] text-sm font-bold text-[var(--tenant-primary)]">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{user.name}</p>
                <p className="truncate text-sm text-[var(--wp-text-muted)]">
                  {formatStatusLabel(user.role)}
                </p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--wp-text-muted)] hover:bg-red-50 hover:text-[var(--wp-danger)]"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </aside>

        {/* Outer margin wrapper */}
        <div className="flex-1 min-w-0 h-full p-2.5 sm:p-3 lg:p-3.5 flex flex-col">
          {/* One unified rounded rectangular container enclosing header and content */}
          <div className="flex-1 min-h-0 flex flex-col rounded-xl lg:rounded-2xl border border-[var(--wp-border)] wp-content-canvas shadow-2xs overflow-hidden">
            {/* Header Bar (fixed within container) */}
            <DashboardHeader orgName={brand.displayName} orgSlug={brand.slug} role={user.role} />

            {/* Inset horizontal divider (16px on mobile, 24px on desktop) */}
            <div className="shrink-0 mx-4 sm:mx-6 h-[1px] bg-[var(--wp-border)]" aria-hidden="true" />

            {/* Main Content with Conditional Bottom Blur */}
            <ScrollableMainContent id="workspace-content">
              {children}
            </ScrollableMainContent>
          </div>
        </div>
      </div>
    </TenantTheme>
  );
}
