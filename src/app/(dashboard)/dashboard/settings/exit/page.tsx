import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageSeparation } from '@/lib/permissions/rbac';
import { getResignationPolicySettings, getFinalPayPolicySettings } from '@/features/separation/service';
import { FinalPayForm } from '@/features/separation/components/FinalPayForm';
import { Field } from '@/features/separation/components/Fields';
import { SeparationError } from '@/features/separation/domain';
import { PolicySettingsForm } from '@/features/separation/components/PolicySettingsForm';
import { TenantLink } from '@/components/ui/TenantLink';
import { WorkspacePanel } from '@/components/ui/Workspace';

export default async function ExitSettingsPage() {
  // Organization policy and permissions are resolved only for a live request.
  await connection();
  const actor = await requireBackOfficeContext().catch(() => null);
  if (!actor || !canManageSeparation(actor)) notFound();
  const finalPay = await getFinalPayPolicySettings();
  const settings = await getResignationPolicySettings().catch(error => {
    if (error instanceof SeparationError && error.code === 'FORBIDDEN') notFound();
    throw error;
  });
  return <div className="max-w-2xl space-y-6">
    <header><p className="wp-eyebrow">Organization settings</p><h1 className="wp-page-title">Resignation notice policy</h1></header>
    <WorkspacePanel title="Notice requirements" description="Applies to this organization only. Existing configured exit cases retain their recorded policy; termination and clearance requirements are unchanged.">
      {settings.locked ? <p>SAGA retains its approved one-calendar-month notice policy, verified superior and HRMO reviews, and authorized short-notice exceptions.</p> : <>
        {!settings.configured && <p role="status" className="mb-4 text-sm text-amber-800">No resignation policy is configured. The HR Administrator must save notice requirements before resignation cases can pass readiness.</p>}
        {settings.canEdit ? <PolicySettingsForm policy={settings.configured?.policy ?? null} /> : <p className="text-sm">Only your organization’s HR Administrator can change this policy.{settings.configured && ` Current notice: ${settings.configured.policy.noticePeriod} ${settings.configured.policy.noticeUnit === 'CALENDAR_DAYS' ? 'calendar days' : 'calendar months'}. Short-notice exceptions ${settings.configured.policy.allowExceptions ? 'allowed' : 'not allowed'}.`}</p>}
        {settings.configured && <p className="mt-4 text-xs text-slate-600">Last configured at {settings.configured.configuredAt} by {settings.configured.configuredById}.</p>}
      </>}
    </WorkspacePanel>
    <WorkspacePanel title="Final-pay payment deadline" description="Philippine private-sector final pay: within 30 calendar days from separation, or a shorter favorable policy, contract or CBA term. Clearance does not restart the clock. Saved favorable deadlines may only be shortened.">
      {finalPay.canEdit ? <FinalPayForm operation="deadlinePolicy" label="Save favorable final-pay deadline"><Field name="days" title="Calendar days from separation (0–30)" type="number" required value={String(finalPay.policy.days)} /><Field name="basis" title="Legal / organization policy / agreement reference" required value={finalPay.policy.basis} /></FinalPayForm> : <p>{finalPay.policy.days} calendar days. {finalPay.policy.basis} Only HR Administrators can change this setting.</p>}
    </WorkspacePanel>
    <TenantLink href="/dashboard/employees/exit" className="text-sm underline">Back to Exit Management</TenantLink>
  </div>;
}
