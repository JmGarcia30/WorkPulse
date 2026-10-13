import Link from 'next/link';
import { getMyProfile } from '@/features/employee-self-service/queries';

const date = (value: Date | null | undefined) => value ? value.toISOString().slice(0, 10) : 'Not available';

export default async function MyEmploymentPage() {
  const profile = await getMyProfile();
  if (!profile) return <p>Employment information is unavailable.</p>;
  const employment = profile.employee.employmentRecords[0];
  const fields = [
    ['Employee number', profile.employee.employeeNumber],
    ['Employee status', profile.employee.employeeStatus],
    ['Position', employment?.jobTitle],
    ['Department', employment?.department],
    ['Employment type', employment?.employmentType],
    ['Category', employment?.employmentCategory],
    ['Employment classification', employment?.employmentStatus],
    ['Hire date', date(employment?.hireDate)],
    ['Start date', date(employment?.startDate)],
    ['Effective from', date(employment?.effectiveFrom)],
    ['Current pay frequency', employment?.payFrequency],
  ];
  return <div className="space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Self-Service</p><h1 className="text-2xl font-black">My Employment</h1><p className="text-sm text-slate-500">Read-only employment information maintained by HR.</p></header>
    {!employment && <p className="rounded-2xl border bg-white p-5 text-sm text-slate-500">No current employment record is available.</p>}
    <section className="rounded-3xl border bg-white p-6"><dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">{fields.map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-bold">{value || 'Not available'}</dd></div>)}</dl></section>
    {employment?.probation && <section className="rounded-3xl border bg-white p-6"><h2 className="font-bold">Probation</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Status</dt><dd>{employment.probation.probationStatus}</dd></div><div><dt className="text-slate-500">Started</dt><dd>{date(employment.probation.startedAt)}</dd></div><div><dt className="text-slate-500">Expected end</dt><dd>{date(employment.probation.expectedEndAt)}</dd></div></dl></section>}
    <Link href="/employee/payroll" className="inline-block rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">View finalized payroll and payslips</Link>
  </div>;
}
