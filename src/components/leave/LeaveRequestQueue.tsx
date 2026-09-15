import Link from 'next/link';

export interface LeaveQueueRequest {
  id: string; type: string; category: string | null; from: string; to: string; units: number;
  status: string; submittedAt: string; documents: Array<{ id: string }>;
  employee: { employeeNumber: string; firstName: string; lastName: string };
}

export function LeaveRequestQueue({ requests }: { requests: LeaveQueueRequest[] }) {
  if (!requests.length) return <div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">No pending leave requests.</div>;
  return <div className="overflow-x-auto rounded-3xl border bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-4">Employee</th><th>Leave</th><th>Dates</th><th>Units</th><th>Submitted</th><th>Documents</th><th>Status</th><th className="pr-4">Actions</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id} className="border-b"><td className="p-4"><strong>{request.employee.firstName} {request.employee.lastName}</strong><span className="block text-xs text-slate-500">{request.employee.employeeNumber}</span></td><td>{request.type}<span className="block text-xs text-slate-500">{request.category ?? '—'}</span></td><td>{request.from}–{request.to}</td><td>{request.units}</td><td>{new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(request.submittedAt))}</td><td>{request.documents.length ? `${request.documents.length} attached` : 'None'}</td><td><strong>{request.status}</strong></td><td className="pr-4"><Link href={`/dashboard/leave/requests/${request.id}`} className="rounded-lg border px-3 py-2 font-bold">View / Review</Link></td></tr>)}</tbody></table></div>;
}
