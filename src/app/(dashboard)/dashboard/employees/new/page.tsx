import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageEmployees } from '@/lib/permissions/rbac';
import { employeeAccessRoles } from '@/lib/auth/access-roles';
import { EmployeeRegistrationForm } from '@/features/employees/registration-form';
import { TenantLink } from '@/components/ui/TenantLink';

export default async function AddExistingEmployeePage() {
  const actor = await requireBackOfficeContext();
  if (!canManageEmployees(actor)) notFound();
  const managementRoles = actor.role === 'ORGANIZATION_ADMIN';
  const existingAccounts = managementRoles ? await prisma.user.findMany({ where:{ organizationId:actor.organizationId,role:{ in:employeeAccessRoles },employeeAccount:null,passwordHash:{ not:null } },select:{ id:true,name:true,email:true,role:true },orderBy:{ name:'asc' },take:200 }) : [];
  return <div className="mx-auto max-w-4xl space-y-5"><header><TenantLink href="/dashboard/employees" className="text-sm underline">Back to employees</TenantLink><h1 className="wp-page-title mt-3">Add Existing Employee</h1><p className="mt-2 text-sm text-[var(--wp-text-muted)]">Register an existing member of your organization directly. No recruitment or hiring records are created.</p></header><EmployeeRegistrationForm registrationKey={randomUUID()} managementRoles={managementRoles} existingAccounts={existingAccounts}/></div>;
}
