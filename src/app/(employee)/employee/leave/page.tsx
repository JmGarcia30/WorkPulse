import Link from 'next/link';
import { CalendarDays, Clock, FilePlus2, FileText } from 'lucide-react';
import { getMyLeaveOverview } from '@/features/leave/self-queries';

function LeaveStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
    WITHDRAWN: 'bg-slate-100 text-slate-600 border-slate-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const style = map[status] ?? 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${style}`}>
      {status}
    </span>
  );
}

export default async function MyLeavePage() {
  const data = await getMyLeaveOverview();
  const pending = data.requests.filter((request) => request.status === 'PENDING');
  const history = data.requests.filter((request) => request.status !== 'PENDING');

  const renderTable = (requests: typeof data.requests, emptyMessage: string) => (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <th className="py-3 px-4">Leave Type</th>
            <th className="py-3 px-4">Requested Dates</th>
            <th className="py-3 px-4">Units (Days)</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {requests.map((request) => (
            <tr key={request.id} className="hover:bg-slate-50/50 transition">
              <td className="py-3.5 px-4 font-semibold text-slate-900">
                <Link
                  href={`/employee/leave/${request.id}`}
                  className="hover:text-[var(--tenant-primary)] hover:underline"
                >
                  {request.leaveTypeNameSnapshot}
                </Link>
              </td>
              <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                {request.requestedStartDate} – {request.requestedEndDate}
              </td>
              <td className="py-3.5 px-4 text-slate-700 font-semibold tabular-nums">
                {request.requestedUnits != null ? `${request.requestedUnits} d` : 'Pending calculation'}
              </td>
              <td className="py-3.5 px-4">
                <LeaveStatusBadge status={request.status} />
              </td>
              <td className="py-3.5 px-4 text-right">
                <Link
                  href={`/employee/leave/${request.id}`}
                  className="inline-flex items-center text-xs font-bold text-[var(--tenant-accent)] hover:underline"
                >
                  View Details
                </Link>
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--tenant-accent)]">
            Employee Self-Service • Leave Management
          </p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
            My Leave
          </h1>
          <p className="text-sm text-slate-500">
            View available leave entitlements, active requests, and past submissions.
          </p>
        </div>

        <Link
          href="/employee/leave/new"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-primary)] px-4 py-2 text-sm font-semibold text-white shadow-2xs hover:brightness-95 transition"
        >
          <FilePlus2 className="h-4 w-4" />
          <span>Apply for Leave</span>
        </Link>
      </header>

      {/* Leave Balances Cards */}
      {data.balances.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
              <CalendarDays className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Leave Balances</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.balances.map((balance) => (
              <div
                key={balance.cycleId}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {balance.cycleName}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {balance.leaveTypeCode}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {balance.leaveTypeName}
                  </h3>
                  <div className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
                    {balance.pendingCalculation
                      ? 'Review'
                      : `${balance.remaining} days`}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-xs">
                  <div>
                    <span className="text-slate-400">Total</span>
                    <p className="font-bold text-slate-700">{balance.annualEntitlement}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Used</span>
                    <p className="font-bold text-slate-700">{balance.used}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Pending</span>
                    <p className="font-bold text-slate-700">
                      {balance.pendingCalculation ? '—' : balance.pending}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending Requests Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <Clock className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Pending Requests</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {pending.length} pending approval
          </span>
        </div>
        {renderTable(pending, 'No pending leave requests at this time.')}
      </section>

      {/* Leave History Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <FileText className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Leave History</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {history.length} finalized records
          </span>
        </div>
        {renderTable(history, 'No previous leave history recorded.')}
      </section>
    </div>
  );
}
