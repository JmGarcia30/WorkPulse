import { SeparationCaseStatus } from '@prisma/client';
import { getOrganizationSeparationCases, getResignationPolicySettings } from '@/features/separation/service';
import { PolicyGuidance } from '@/features/separation/components/PolicyGuidance';
import { label, fieldClass } from '@/features/separation/components/Fields';
import { TenantLink } from '@/components/ui/TenantLink';
import { WorkspacePanel } from '@/components/ui/Workspace';

export default async function ExitPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string; page?: string }> }) {
  const query = await searchParams;
  const settings = await getResignationPolicySettings();
  const status = Object.values(SeparationCaseStatus).find(status => status === query.status);
  const page = Math.max(1, Math.min(100000, Number(query.page) || 1));
  const result = await getOrganizationSeparationCases({ search: (query.search ?? '').slice(0, 100), status, page: Math.floor(page), pageSize: 20 });
  const pageHref = (next: number) => `/dashboard/employees/exit?${new URLSearchParams({ search: query.search ?? '', status: status ?? '', page: String(next) })}`;
  return <>
    <TenantLink href="/dashboard/settings/exit" className="text-sm underline">Resignation notice policy settings</TenantLink>
    {settings.policy.noticeCalendarMonths === null && settings.policy.noticeCalendarDays == null && <PolicyGuidance />}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Exit Management</h1><p className="text-sm text-slate-600">Clearance, verified reviews and final separation.</p></div><TenantLink href="/dashboard/employees/exit/new" className="rounded-md bg-[var(--tenant-primary)] px-4 py-2 text-sm font-semibold text-white">Create exit case</TenantLink></div>
    <WorkspacePanel title="Separation cases">
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">Employee name or number<input className={fieldClass} name="search" defaultValue={query.search} maxLength={100} /></label>
        <label className="text-sm">Status<select className={fieldClass} name="status" defaultValue={status ?? ''}><option value="">All statuses</option>{Object.values(SeparationCaseStatus).map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm">Search</button>
      </form>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b">{['Employee', 'Type / status', 'Effective date', 'Clearance', 'Readiness'].map(title => <th className="p-3" key={title}>{title}</th>)}</tr></thead><tbody>{result.items.map(item => <tr key={item.id} className="border-b">
        <td className="p-3"><TenantLink className="font-semibold text-[var(--tenant-primary)] underline" href={`/dashboard/employees/exit/${item.id}`}>{item.employee.lastName}, {item.employee.firstName}</TenantLink><p className="text-slate-600">{item.employee.employeeNumber}</p></td>
        <td className="p-3">{label(item.separationType)}<p>{label(item.status)}</p>{item.submissionSource === 'ESS' && <p className="text-xs text-slate-600">Employee notice · {item.acknowledgedAt ? 'Receipt acknowledged' : 'Receipt not yet acknowledged'}</p>}</td><td className="p-3">{item.proposedEffectiveDate ?? 'Pending'}</td>
        <td className="p-3">{item.clearanceProgress.completed}/{item.clearanceProgress.required} required</td><td className="p-3">{item.status === 'COMPLETED' ? 'Completed' : item.status === 'CANCELLED' ? 'Cancelled' : item.readiness.ready ? 'Ready' : `${item.readiness.blockers.length} blockers`}<p className="text-slate-600">Notice: {label(item.noticeCompliance)}</p></td>
      </tr>)}</tbody></table></div>
      {!result.items.length && <p className="py-6 text-sm text-slate-600">No separation cases match these filters.</p>}
      <div className="mt-4 flex gap-4 text-sm"><span>{result.total} cases · Page {result.page}</span>{result.page > 1 && <TenantLink href={pageHref(result.page - 1)}>Previous</TenantLink>}{result.page * result.pageSize < result.total && <TenantLink href={pageHref(result.page + 1)}>Next</TenantLink>}</div>
    </WorkspacePanel>
  </>;
}
