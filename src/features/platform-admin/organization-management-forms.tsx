'use client';

import { useActionState } from 'react';
import { changeCareerPortalAction, saveOrganizationDetailsAction } from '@/features/platform-admin/organization-operations';

type Organization = {
  id: string;
  name: string;
  contactEmail: string | null;
  timeZone: string;
  careersEnabled: boolean;
};

function Feedback({ state }: { state: { error?: string; success?: string } }) {
  return <>{state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    {state.success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.success}</p>}</>;
}

export function OrganizationManagementForms({ organization }: { organization: Organization }) {
  const [details, saveDetails, detailsPending] = useActionState(saveOrganizationDetailsAction, {});
  const [career, saveCareer, careerPending] = useActionState(changeCareerPortalAction, {});
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="wp-card space-y-4 p-6">
      <h2 className="wp-section-title">Edit organization details</h2>
      <p className="text-sm text-slate-600">Update your organization name, contact email and time zone. The workspace URL remains unchanged in this release.</p>
      <form action={saveDetails} className="space-y-4">
        <input type="hidden" name="organizationId" value={organization.id}/>
        <label className="wp-label">Organization name
          <input className="wp-input mt-2" name="name" defaultValue={organization.name} minLength={2} maxLength={150} required/>
        </label>
        <label className="wp-label">Contact email
          <input className="wp-input mt-2" name="contactEmail" type="email" defaultValue={organization.contactEmail ?? ''} maxLength={254}/>
        </label>
        <label className="wp-label">Time zone
          <input className="wp-input mt-2" name="timeZone" defaultValue={organization.timeZone} maxLength={100} required/>
        </label>
        <p className="text-xs text-amber-800">Time-zone changes can affect how future attendance dates and payroll cutoffs are interpreted. Verify with the organization before changing.</p>
        <Feedback state={details}/>
        <button className="wp-button-primary" disabled={detailsPending}>{detailsPending ? 'Saving…' : 'Save organization details'}</button>
      </form>
    </section>
    <section className="wp-card space-y-4 p-6">
      <h2 className="wp-section-title">Career portal access</h2>
      <p className="text-sm">Current status: <strong>{organization.careersEnabled ? 'Enabled' : 'Disabled'}</strong></p>
      <p className="text-sm text-slate-600">Disabling hides public job listings and blocks new public applications for this organization. It does not delete jobs or existing applications and does not suspend HR or ESS access.</p>
      <form action={saveCareer} className="space-y-4">
        <input type="hidden" name="organizationId" value={organization.id}/>
        <input type="hidden" name="enabled" value={organization.careersEnabled ? 'false' : 'true'}/>
        <label className="flex items-start gap-2 text-sm">
          <input className="mt-1" type="checkbox" name="confirmation" value="yes" required/>
          <span>I understand this will {organization.careersEnabled ? 'disable' : 'enable'} this organization's public career portal.</span>
        </label>
        <Feedback state={career}/>
        <button className="wp-button-secondary" disabled={careerPending}>{careerPending ? 'Saving…' : organization.careersEnabled ? 'Disable career portal' : 'Enable career portal'}</button>
      </form>
    </section>
  </div>;
}
