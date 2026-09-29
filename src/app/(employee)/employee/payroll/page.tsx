import Link from 'next/link';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { listFinalizedPayslipsForEmployee } from '@/features/payroll/payslip';

const dateLabel = (value: string) => new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const money = (value: string, currency: string) => new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(value));

export default async function MyPayslipsPage() {
  const context = await requireEmployeeSelfContext();
  const payslips = await listFinalizedPayslipsForEmployee({ organizationId: context.organization.id, userId: context.user.id });
  return <div className="space-y-6"><header><p className="text-xs font-bold uppercase tracking-wider text-slate-500">My Payroll</p><h1 className="text-2xl font-black">My Payslips</h1></header>{payslips.length === 0 ? <div className="rounded-3xl border bg-white p-10 text-center text-sm text-slate-500">No finalized payslips are available yet.</div> : <div className="space-y-3">{payslips.map(item => <article key={item.entryId} className="flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{dateLabel(item.periodStart)} – {dateLabel(item.periodEnd)}</p><p className="mt-1 text-sm text-slate-500">Pay Date: {dateLabel(item.payDate)}</p><p className="mt-2 text-sm">Net Pay: <span className="font-black">{money(item.netPay, item.currency)}</span></p></div><Link href={`/employee/payroll/${item.entryId}`} className="rounded-xl bg-slate-900 px-4 py-2.5 text-center text-xs font-bold text-white">View Payslip</Link></article>)}</div>}</div>;
}
