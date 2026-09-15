import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageLeaveBalances } from '@/lib/permissions/rbac';
import { getLeaveBalanceAdminData } from '@/features/leave/hr-queries';
import { LeaveBalancesPanel } from '@/components/leave/LeaveBalancesPanel';

export default async function LeaveBalancesPage() { const user = await requireBackOfficeContext(); if (!canManageLeaveBalances(user)) redirect('/dashboard/leave'); const data = await getLeaveBalanceAdminData(user.organizationId); return <div className="space-y-6"><div><Link href="/dashboard/leave" className="text-sm underline">Back to Leave Management</Link><h1 className="mt-2 text-2xl font-black">Leave Balances</h1></div><LeaveBalancesPanel types={data.types} employees={data.employees} /></div>; }
