import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canViewOrganizationLeave } from '@/lib/permissions/rbac';
import { getLeaveAdminOverview } from '@/features/leave/hr-queries';
import { LeaveRequestQueue } from '@/components/leave/LeaveRequestQueue';

export default async function LeaveAdminPage() {
  const user = await requireBackOfficeContext(); if (!canViewOrganizationLeave(user)) redirect('/dashboard');
  const data = await getLeaveAdminOverview(user.organizationId);
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black">Leave Management</h1><p className="text-sm text-slate-500">Operational leave review and approval</p></div><nav className="flex gap-2"><Link href="/dashboard/leave/balances" className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Balances</Link><Link href="/dashboard/leave/settings" className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Settings / Policies</Link></nav></div><section className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Pending</p><strong className="text-3xl">{data.counts.pending}</strong></article><article className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Approved</p><strong className="text-3xl">{data.counts.approved}</strong></article><article className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Rejected / Cancelled</p><strong className="text-3xl">{data.counts.closed}</strong></article></section><section className="space-y-3"><h2 className="text-lg font-bold">Pending Leave Requests</h2><LeaveRequestQueue requests={data.pendingRequests} /></section></div>;
}
