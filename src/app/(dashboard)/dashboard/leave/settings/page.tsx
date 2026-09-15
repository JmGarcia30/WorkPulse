import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageLeaveTypes } from '@/lib/permissions/rbac';
import { getLeaveAdminSettings } from '@/features/leave/hr-queries';
import { LeaveSettingsPanel } from '@/components/leave/LeaveSettingsPanel';

export default async function LeaveSettingsPage() { const user = await requireBackOfficeContext(); if (!canManageLeaveTypes(user)) redirect('/dashboard/leave'); const types = await getLeaveAdminSettings(user.organizationId); return <div className="space-y-6"><div><Link href="/dashboard/leave" className="text-sm underline">Back to Leave Management</Link><h1 className="mt-2 text-2xl font-black">Leave Settings / Policies</h1></div><LeaveSettingsPanel types={types} /></div>; }
