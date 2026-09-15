import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm';
import { getMyLeaveOverview } from '@/features/leave/self-queries';

export default async function NewLeavePage() { const data = await getMyLeaveOverview(); return <div className="mx-auto max-w-2xl space-y-4"><h1 className="text-2xl font-black">New leave request</h1><LeaveRequestForm types={data.leaveTypes} /></div>; }
