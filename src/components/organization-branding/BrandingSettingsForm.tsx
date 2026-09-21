'use client';

import { useActionState } from 'react';
import { updateBrandingAction, uploadBrandAssetAction, type BrandingActionState } from '@/features/organization-branding/actions';
import type { OrganizationBrandingView } from '@/features/organization-branding/read-model';

const initial: BrandingActionState = { ok: false, message: '' };

function Result({ state }: { state: BrandingActionState }) {
  return state.message ? <p role="status" className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}>{state.message}</p> : null;
}

export function BrandingSettingsForm({ branding }: { branding: OrganizationBrandingView }) {
  const [state, action, pending] = useActionState(updateBrandingAction, initial);
  const [assetState, assetAction, assetPending] = useActionState(uploadBrandAssetAction, initial);
  return <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <form action={action} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="wp-label">Display name<input className="wp-input mt-2" name="displayName" defaultValue={branding.displayName} maxLength={120} /></label>
        <label className="wp-label">Tagline<input className="wp-input mt-2" name="tagline" defaultValue={branding.tagline || ''} maxLength={180} /></label>
        <label className="wp-label">Primary color<input className="wp-input mt-2 h-12" name="primaryColor" type="color" defaultValue={branding.primary} /></label>
        <label className="wp-label">Accent color<input className="wp-input mt-2 h-12" name="accentColor" type="color" defaultValue={branding.accent} /></label>
        <label className="wp-label sm:col-span-2">Address<textarea className="wp-input mt-2 min-h-24" name="address" defaultValue={branding.address || ''} maxLength={500} /></label>
        <label className="wp-label">Contact email<input className="wp-input mt-2" name="contactEmail" type="email" defaultValue={branding.contactEmail || ''} /></label>
        <label className="wp-label">Contact phone<input className="wp-input mt-2" name="contactPhone" defaultValue={branding.contactPhone || ''} maxLength={40} /></label>
      </div>
      <Result state={state} /><button className="wp-button-primary" disabled={pending}>{pending ? 'Saving…' : 'Save branding'}</button>
    </form>
    <div className="space-y-8 border-l-0 lg:border-l lg:pl-8">
      {(['logo', 'loginImage'] as const).map((kind) => <form action={assetAction} key={kind} className="space-y-3 border-b pb-7">
        <input type="hidden" name="kind" value={kind} /><p className="wp-label">{kind === 'logo' ? 'Organization logo' : 'Login image'}</p>
        <p className="text-xs text-[var(--wp-text-muted)]">PNG, JPEG, or WebP. {kind === 'logo' ? 'Maximum 2 MB.' : 'Maximum 5 MB.'}</p>
        <input required name="file" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm" />
        <button className="wp-button-secondary" disabled={assetPending}>Upload</button>
      </form>)}
      <Result state={assetState} />
    </div>
  </div>;
}
