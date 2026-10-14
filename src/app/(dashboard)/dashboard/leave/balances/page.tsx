import { redirect } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageLeaveBalances } from '@/lib/permissions/rbac';
import { getLeaveBalanceAdminData } from '@/features/leave/hr-queries';
import { LeaveBalancesPanel } from '@/components/leave/LeaveBalancesPanel';

export default async function LeaveBalancesPage() {
  const user = await requireBackOfficeContext();
  if (!canManageLeaveBalances(user)) redirect('/dashboard/leave');
  const data = await getLeaveBalanceAdminData(user.organizationId);

  return <LeaveBalancesPanel types={data.types} employees={data.employees} />;
}
