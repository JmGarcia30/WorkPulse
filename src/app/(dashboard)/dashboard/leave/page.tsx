import { redirect } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canViewOrganizationLeave } from '@/lib/permissions/rbac';
import { getLeaveAdminOverview } from '@/features/leave/hr-queries';
import { LeaveDashboardView } from '@/components/leave/LeaveDashboardView';

export default async function LeaveAdminPage() {
  const user = await requireBackOfficeContext();
  if (!canViewOrganizationLeave(user)) redirect('/dashboard');
  const data = await getLeaveAdminOverview(user.organizationId);

  return <LeaveDashboardView data={data} />;
}
