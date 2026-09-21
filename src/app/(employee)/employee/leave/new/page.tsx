import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm';
import { getMyLeaveOverview } from '@/features/leave/self-queries';

export default async function NewLeavePage() { const data = await getMyLeaveOverview(); return <div className="mx-auto max-w-2xl space-y-4"><h1 className="text-2xl font-black">File Leave</h1><p className="text-sm text-slate-600">Your request will be reviewed by HR. Final leave days and balance deductions are confirmed during approval.</p><LeaveRequestForm types={data.leaveTypes} /></div>; }
