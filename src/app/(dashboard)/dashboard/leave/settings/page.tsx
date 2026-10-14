import { redirect } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageLeaveTypes } from '@/lib/permissions/rbac';
import { getLeaveAdminSettings } from '@/features/leave/hr-queries';
import { LeaveSettingsPanel } from '@/components/leave/LeaveSettingsPanel';
import { prisma } from '@/lib/db/prisma';

export default async function LeaveSettingsPage() {
  const user = await requireBackOfficeContext();
  if (!canManageLeaveTypes(user)) redirect('/dashboard/leave');

  const [types, organization] = await Promise.all([
    getLeaveAdminSettings(user.organizationId),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true },
    }),
  ]);

  return <LeaveSettingsPanel types={types} organizationName={organization?.name} />;
}
