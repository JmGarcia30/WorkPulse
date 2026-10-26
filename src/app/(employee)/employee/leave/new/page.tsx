import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm';
import { getMyLeaveOverview } from '@/features/leave/self-queries';

export default async function NewLeavePage() {
  const data = await getMyLeaveOverview();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header with back link */}
      <div>
        <Link
          href="/employee/leave"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Leave Overview</span>
        </Link>
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--tenant-accent)]">
          Employee Self-Service • Leave Application
        </p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
          Apply for Leave
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your request will be routed directly to HR for verification and approval. Final leave units and balance deductions are confirmed during review.
        </p>
      </div>

      <LeaveRequestForm types={data.leaveTypes} />
    </div>
  );
}
