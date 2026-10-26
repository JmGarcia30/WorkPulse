import '../../(dashboard)/workspace.css';
import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { logoutAction } from '@/lib/auth/actions';
import { EmployeeSelfAccessError, requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { getRequestOrganizationBranding } from '@/lib/tenant/server';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { EmployeeNav } from '@/components/employee-self-service/EmployeeNav';
import { EmployeeHeader } from '@/components/employee-self-service/EmployeeHeader';
import { TenantLogo } from '@/components/layout/TenantLogo';

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  let context;
  try {
    context = await requireEmployeeSelfContext();
  } catch (error) {
    if (error instanceof EmployeeSelfAccessError && error.code === 'FORBIDDEN') {
      redirect('/dashboard');
    }
    redirect('/login?access=unavailable');
  }

  const brand = await getRequestOrganizationBranding(context.organization.id);
  if (!brand) redirect('/login');

  const fullName = `${context.employee.firstName} ${context.employee.lastName}`.trim();
  const initials = [context.employee.firstName?.[0], context.employee.lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || 'E';

  return (
    <TenantTheme branding={brand}>
      <div className="wp-workspace wp-tenant-shell flex min-h-screen text-[var(--wp-text)]">
        <a
          href="#employee-workspace-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 wp-button-primary"
        >
          Skip to content
        </a>

        {/* Desktop Sidebar */}
        <aside className="wp-tenant-sidebar sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r md:flex">
          <div className="wp-tenant-rule border-b px-5 py-5">
            <div className="flex items-center gap-3">
              <TenantLogo
                branding={brand}
                size={40}
                className="h-10 w-10 rounded-lg bg-white object-contain"
                fallbackClassName="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tenant-primary)] text-sm font-black text-[var(--tenant-primary-foreground)]"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{brand.displayName}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tenant-accent)]">
                  WorkPulse ESS
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <EmployeeNav />
          </div>

          <div className="wp-tenant-rule border-t p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tenant-tint-strong)] text-sm font-bold text-[var(--tenant-primary)]">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{fullName}</p>
                <p className="truncate text-xs text-[var(--wp-text-muted)]">{context.employee.employeeNumber}</p>
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

        {/* Main Workspace Body with Header and Content */}
        <div className="min-w-0 flex-1">
          <EmployeeHeader
            orgName={brand.displayName}
            orgSlug={brand.slug}
            employeeName={fullName}
            employeeNumber={context.employee.employeeNumber}
          />
          <main
            id="employee-workspace-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-[100rem] p-4 sm:p-6 lg:p-8 xl:p-8"
          >
            {children}
          </main>
        </div>
      </div>
    </TenantTheme>
  );
}
