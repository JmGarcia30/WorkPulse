import { redirect } from 'next/navigation';
import { logoutAction } from '@/lib/auth/actions';
import { getSession } from '@/lib/auth/session';
import { EmployeeSelfAccessError, requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { EmployeeNav } from '@/components/employee-self-service/EmployeeNav';

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  let context;
  try { context = await requireEmployeeSelfContext(); }
  catch (error) {
    if (error instanceof EmployeeSelfAccessError && error.code === 'FORBIDDEN') redirect('/dashboard');
    redirect('/login?access=unavailable');
  }
  return <div className="flex min-h-screen bg-slate-50 text-slate-900">
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r bg-white">
      <div className="border-b p-5"><p className="font-black">WorkPulse</p><p className="truncate text-xs text-slate-500">{context.organization.name}</p></div>
      <div className="flex-1"><EmployeeNav /></div>
      <div className="border-t p-4"><p className="truncate text-sm font-bold">{context.employee.firstName} {context.employee.lastName}</p><p className="truncate text-xs text-slate-500">{context.employee.employeeNumber}</p><form action={logoutAction}><button className="mt-3 text-xs font-bold text-rose-600">Sign out</button></form></div>
    </aside>
    <main className="mx-auto w-full max-w-7xl p-6 sm:p-8">{children}</main>
  </div>;
}
