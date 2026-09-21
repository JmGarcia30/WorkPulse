import { redirect } from 'next/navigation';
import { logoutAction } from '@/lib/auth/actions';
import { EmployeeSelfAccessError, requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { getOrganizationBranding } from '@/features/organization-branding/read-model';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { EmployeeNav } from '@/components/employee-self-service/EmployeeNav';

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  let context; try { context = await requireEmployeeSelfContext(); } catch (error) { if (error instanceof EmployeeSelfAccessError && error.code === 'FORBIDDEN') redirect('/dashboard'); redirect('/login?access=unavailable'); }
  const brand = await getOrganizationBranding(context.organization.id); if (!brand) redirect('/login');
  return <TenantTheme branding={brand}><div className="min-h-screen bg-[var(--wp-background)] text-[var(--wp-text)]"><header className="border-b bg-[var(--wp-surface)] px-5 py-4 md:hidden"><b>{brand.displayName}</b></header><div className="mx-auto flex max-w-[92rem]"><aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-[var(--wp-surface)] md:flex"><div className="border-b p-5"><p className="font-bold">{brand.displayName}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--wp-text-muted)]">Employee self-service</p></div><div className="flex-1"><EmployeeNav /></div><div className="border-t p-4"><p className="truncate text-sm font-bold">{context.employee.firstName} {context.employee.lastName}</p><p className="truncate text-xs text-[var(--wp-text-muted)]">{context.employee.employeeNumber}</p><form action={logoutAction}><button className="mt-3 text-xs font-bold text-[var(--wp-danger)]">Sign out</button></form></div></aside><main className="w-full min-w-0 p-5 sm:p-7 lg:p-9">{children}</main></div></div></TenantTheme>;
}
