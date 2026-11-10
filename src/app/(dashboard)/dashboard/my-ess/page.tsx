import { redirect, notFound } from 'next/navigation';
import { Role } from '@prisma/client';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { TenantLink } from '@/components/ui/TenantLink';

/**
 * HR keeps their existing WorkPulse login and role; personal ESS is resolved
 * through one tenant-bound, active EmployeeAccount. Never self-provision HR
 * permissions or create duplicate users from an email address.
 */
export default async function MyEssPage() {
  const actor = await requireBackOfficeContext();
  if (actor.role !== Role.HR_ADMIN) notFound();

  const account = await prisma.employeeAccount.findFirst({
    where: { userId: actor.userId, organizationId: actor.organizationId },
    select: { status: true, employee: { select: { employeeStatus: true } } },
  });

  if (account?.status === 'ACTIVE' && account.employee.employeeStatus === 'ACTIVE') {
    redirect('/employee');
  }

  const message = !account
    ? 'Your HR login is not yet linked to an employee record. An Organization Administrator must link your existing HR account to your active employee record.'
    : account.status === 'INVITED'
      ? 'Your employee self-service access is awaiting activation. Ask your Organization Administrator to review the invitation.'
      : 'Your employee self-service access is currently unavailable. Ask your Organization Administrator to review the linked employee account.';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="wp-page-title">My Employee Self-Service</h1>
        <p className="mt-2 text-sm italic text-[var(--wp-text-muted)]">
          Access your own attendance, leave, payslips, employment details and personal information.
        </p>
      </header>
      <section className="wp-card space-y-4 p-6">
        <h2 className="text-base font-semibold text-[#282934]">Employee account setup required</h2>
        <p className="text-sm text-[var(--wp-text-muted)]">{message}</p>
        <p className="text-sm text-[var(--wp-text-muted)]">
          Your HR permissions and password will stay the same. If your employee record already exists,
          the Organization Administrator can use the existing-account linking option in Employee Records.
          If it does not exist, they can register you as an existing employee, choose the HR Administrator role,
          and link your current activated login. Do not create another HR account.
        </p>
        <TenantLink href="/dashboard/employees" className="wp-button-secondary inline-flex">
          Open Employee Records
        </TenantLink>
      </section>
    </div>
  );
}
