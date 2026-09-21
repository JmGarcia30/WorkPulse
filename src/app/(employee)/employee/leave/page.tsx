import Link from 'next/link';
import { getMyLeaveOverview } from '@/features/leave/self-queries';

export default async function MyLeavePage() {
  const data = await getMyLeaveOverview();
  const pending = data.requests.filter((request) => request.status === 'PENDING');
  const history = data.requests.filter((request) => request.status !== 'PENDING');
  const sickPersonal = data.balances.find((balance) => balance.leaveTypeCode === 'SICK_PERSONAL');
  const table = (requests: typeof data.requests) => <div className="overflow-x-auto rounded-3xl border bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-4">Type</th><th>Dates</th><th>Leave days</th><th>Status</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id} className="border-b"><td className="p-4"><Link className="font-bold underline" href={`/employee/leave/${request.id}`}>{request.leaveTypeNameSnapshot}</Link></td><td>{request.requestedStartDate}–{request.requestedEndDate}</td><td>{request.requestedUnits ?? 'Pending calculation'}</td><td>{request.status}</td></tr>)}</tbody></table>{!requests.length && <p className="p-6 text-sm text-slate-500">No requests in this section.</p>}</div>;
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Self-Service</p><h1 className="text-2xl font-black">My Leave</h1></div><Link href="/employee/leave/new" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">File Leave</Link></div>{sickPersonal && <section><h2 className="mb-3 font-bold">Sick / Personal Leave</h2><div className="grid gap-3 sm:grid-cols-4"><Summary label="Annual entitlement" value={sickPersonal.annualEntitlement} /><Summary label="Used" value={sickPersonal.used} /><Summary label="Pending" value={sickPersonal.pendingCalculation ? 'Awaiting schedule calculation' : sickPersonal.pending} /><Summary label="Remaining" value={sickPersonal.pendingCalculation ? 'Confirmed during review' : sickPersonal.remaining} /></div></section>}<section className="space-y-3"><h2 className="font-bold">Pending Requests</h2>{table(pending)}</section><section className="space-y-3"><h2 className="font-bold">Leave History</h2>{table(history)}</section></div>;
}

function Summary({ label, value }: { label: string; value: number | string }) {
  return <article className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><strong className="mt-2 block text-xl">{value}</strong></article>;
}
