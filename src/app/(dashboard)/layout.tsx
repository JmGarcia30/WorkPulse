import './workspace.css';
import { poppins } from '@/lib/fonts';
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
      <div className={`wp-workspace wp-tenant-shell ${poppins.variable} ${poppins.className} flex h-screen h-[100dvh] overflow-hidden text-[var(--wp-text)] bg-[#282934]`}>
        <a
          href="#workspace-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 wp-button-primary"
        >
          Skip to content
        </a>

        {/* Existing sidebar outside the container */}
        <aside className="wp-tenant-sidebar sticky top-0 z-30 hidden h-full w-60 shrink-0 flex-col bg-transparent md:flex">
          <div className="pl-[26px] pr-3 pt-5 pb-1">
            <div className="flex items-center gap-2.5">
              <TenantLogo
                branding={brand}
                size={34}
                className="h-[34px] w-[34px] rounded-lg bg-white object-contain shrink-0"
                fallbackClassName="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-xs font-bold text-[var(--tenant-primary-foreground)]"
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white leading-tight">{brand.displayName}</p>
                <p className="text-[11.5px] font-medium text-[#C7A759] leading-tight mt-0.5">
                  WorkPulse HR
                </p>
              </div>
            </div>
          </div>
          <div className="wp-sidebar-divider mx-6 my-3.5" aria-hidden="true" />
          <div className="flex-1 overflow-y-auto">
            <DashboardSidebarNav orgSlug={brand.slug} role={user.role} />
          </div>
          <div className="pl-[26px] pr-3 pb-7">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tenant-tint-strong)] text-xs font-bold text-[var(--tenant-primary)]">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white leading-tight">{user.name}</p>
                <p className="truncate text-[11.5px] font-normal text-[#B4B5C0] leading-tight mt-0.5">
                  {formatStatusLabel(user.role)}
                </p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B4B5C0] hover:bg-white/10 hover:text-white transition-colors duration-150"
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
