'use client';

import { useActionState } from 'react';
import { changeCareerPortalAction, changeOrganizationSlugAction, saveOrganizationDetailsAction } from '@/features/platform-admin/organization-operations';

type Organization = {
  id: string;
  name: string;
  slug: string;
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
  const [slugResult, changeSlug, slugPending] = useActionState(changeOrganizationSlugAction, {});
  return <div className="grid gap-4 lg:grid-cols-2">
    <section className="rounded-2xl border border-[#e9ddd8] bg-[#fffaf7] p-5 space-y-4">
      <h2 className="platform-card-title">Edit organization details</h2>
      <p className="platform-card-description">Update your organization name, contact email and time zone. Workspace URL is managed separately below.</p>
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
    <section className="rounded-2xl border border-[#e9ddd8] bg-[#fffaf7] p-5 space-y-4">
      <h2 className="platform-card-title">Workspace URL</h2>
      <p className="text-sm">Current workspace identifier: <strong className="font-mono">{organization.slug}</strong></p>
      {organization.slug === 'st-aloysius' ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        SAGA uses the protected /saga URL. Rename is disabled to preserve its existing login, RFID, and institutional links.
      </p> : <form action={changeSlug} className="space-y-4">
        <input type="hidden" name="organizationId" value={organization.id}/>
        <label className="wp-label">New workspace identifier
          <input className="wp-input mt-2" name="nextSlug" type="text" defaultValue={organization.slug === 'infant-jesus-academy-pampanga' ? 'ijap' : organization.slug}
            minLength={2} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" required/>
        </label>
        <p className="text-xs text-slate-600">Use lowercase letters, numbers and hyphens. The new address will be /w/your-new-identifier on the current hosted platform. Former addresses redirect only for read-only navigation; old URLs cannot be reused by another organization.</p>
        <p className="text-xs text-amber-800">Share the new workspace link with HR and employees. Existing email links, OAuth integrations, bookmarks and active sessions may need fresh sign-in or verification.</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirmation" value="yes" required className="mt-1"/>
          I understand the workspace address will change, and I will notify the organization's administrators.
        </label>
        <Feedback state={slugResult}/>
        <button className="wp-button-secondary" disabled={slugPending}>{slugPending ? 'Updating…' : 'Change workspace URL'}</button>
      </form>}
    </section>
    <section className="rounded-2xl border border-[#e9ddd8] bg-[#fffaf7] p-5 space-y-4">
      <h2 className="platform-card-title">Career portal access</h2>
      <p className="text-sm">Current status: <strong>{organization.careersEnabled ? 'Enabled' : 'Disabled'}</strong></p>
      <p className="platform-card-description">Disabling hides public job listings and blocks new public applications for this organization. It does not delete jobs or existing applications and does not suspend HR or ESS access.</p>
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
