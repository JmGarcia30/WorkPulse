import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageEmploymentLifecycle } from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { isSagaProbationOrganization, organizationProbationPolicySchema } from '@/features/employees/probation-policy';
import { ProbationPolicySettings } from '@/components/employees/ProbationPolicySettings';

export default async function ProbationSettingsPage() {
  const user = await requireBackOfficeContext();
  if (!canManageEmploymentLifecycle(user)) redirect('/dashboard/employees');
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { name: true, slug: true, probationPolicy: true } });
  const policy = organizationProbationPolicySchema.safeParse(organization.probationPolicy);
  return <div className="space-y-5"><Link href="/dashboard/employees" className="text-sm underline">Back to Employees</Link><h1 className="text-2xl font-bold">{organization.name} probation policy</h1>{isSagaProbationOrganization(organization) ? <p className="rounded-xl border bg-white p-5">SAGA retains its approved policy: Teaching appointments use exact school-year dates with at most two renewals and a defensive three-year total limit. Non-Teaching appointments use six calendar months without renewal. Historical records and HR decisions remain unchanged.</p> : <ProbationPolicySettings policy={policy.success ? policy.data : null} />}</div>;
}
