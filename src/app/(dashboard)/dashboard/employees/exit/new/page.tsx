import { randomUUID } from 'node:crypto';
import { searchSeparationEmployees, getResignationPolicySettings } from '@/features/separation/service';
import { PolicyGuidance } from '@/features/separation/components/PolicyGuidance';
import { ActionForm } from '@/features/separation/components/ActionForm';
import { CaseFields, Field, fieldClass } from '@/features/separation/components/Fields';
import { TenantLink } from '@/components/ui/TenantLink';
import { WorkspacePanel } from '@/components/ui/Workspace';

export default async function NewExitPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const query = await searchParams;
  const settings = await getResignationPolicySettings();
  const employees = await searchSeparationEmployees((query.search ?? '').slice(0, 100));
  return <>
    <TenantLink href="/dashboard/employees/exit" className="text-sm underline">Back to Exit Management</TenantLink>
    <h1 className="text-2xl font-semibold">Create exit case</h1>
    {settings.policy.noticeCalendarMonths === null && settings.policy.noticeCalendarDays == null && <PolicyGuidance />}
    <WorkspacePanel title="Employee and proposed separation" description="Creating a case leaves employment status and ESS access unchanged. Termination records require verified review before approval.">
      <form className="mb-5 flex items-end gap-3"><label className="text-sm">Find employee<input className={fieldClass} name="search" maxLength={100} defaultValue={query.search} /></label><button className="rounded-md border border-slate-300 px-4 py-2 text-sm">Search</button></form>
      <p className="mb-3 text-sm text-slate-600">Showing up to 20 active or inactive employees. Search to narrow the selection.</p>
      <ActionForm operation="create" label="Create draft case" navigate>
        <input type="hidden" name="requestKey" value={randomUUID()} />
        <label className="block text-sm font-medium">Employee<select name="employeeId" required className={fieldClass} defaultValue=""><option value="" disabled>Select employee</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.lastName}, {employee.firstName} · {employee.employeeStatus}</option>)}</select></label>
        <Field name="inactiveEmployeeJustification" title="Administrative exit justification (required for an inactive employee)" />
        <CaseFields />
      </ActionForm>
    </WorkspacePanel>
  </>;
}
