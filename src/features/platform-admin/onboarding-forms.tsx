'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createOrganizationAction, manageOrganizationInvitationAction, activateOrganizationAdministratorAction } from './onboarding-actions';
import { retainActivationToken } from '@/features/employee-self-service/activation-fragment';

function Feedback({ state }: { state: { error?: string; success?: string } }) {
  return <>{state.error && <p role="alert" className="wp-alert-danger">{state.error}</p>}{state.success && <p role="status" className="text-sm text-[var(--wp-success)]">{state.success}</p>}</>;
}
export function CreateOrganizationForm({ requestKey }: { requestKey: string }) {
  const [state, action, pending] = useActionState(createOrganizationAction, {});
  return <form action={action} className="wp-card max-w-xl space-y-5 p-6">
    <input type="hidden" name="requestKey" value={requestKey} />
    <label className="wp-label">Organization name<input className="wp-input mt-2" name="name" minLength={2} maxLength={150} required /></label>
    <label className="wp-label">Workspace slug<input className="wp-input mt-2" name="slug" minLength={2} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" required /></label>
    <p className="text-sm text-[var(--wp-text-muted)]">A unique workspace subdomain. Use lowercase letters, numbers and hyphens.</p>
    <label className="wp-label">Contact email<input className="wp-input mt-2" type="email" name="contactEmail" maxLength={254} required /></label>
    <label className="wp-label">Timezone<input className="wp-input mt-2" name="timeZone" placeholder="Asia/Manila" maxLength={100} required /></label>
    <label className="wp-label">Initial HR administrator email<input className="wp-input mt-2" type="email" name="administratorEmail" maxLength={254} required /></label>
    <p className="text-sm text-[var(--wp-text-muted)]">The HR administrator receives a single-use activation link. Their email is unverified until the link is used. New workspaces start empty with careers disabled.</p>
    <Feedback state={state} />
    <button className="wp-button-primary" disabled={pending}>{pending ? 'Creating organization…' : 'Create organization and invite HR administrator'}</button>
  </form>;
}
export function OrganizationInvitationControls({ organizationId, resendKey, revokeKey }: { organizationId: string; resendKey: string; revokeKey: string }) {
  return <div className="space-y-4">
    <InvitationActionForm organizationId={organizationId} requestKey={resendKey} operation="RESEND" />
    <InvitationActionForm organizationId={organizationId} requestKey={revokeKey} operation="REVOKE" />
    <p className="text-xs text-[var(--wp-text-muted)]">Wait 60 seconds between invitation issues. Expired pending invitations can be resent.</p>
  </div>;
}
function InvitationActionForm({ organizationId, requestKey, operation }: { organizationId: string; requestKey: string; operation: 'RESEND' | 'REVOKE' }) {
  const [state, action, pending] = useActionState(manageOrganizationInvitationAction, {});
  return <form action={action} className="space-y-4">
    <input type="hidden" name="organizationId" value={organizationId} />
    <input type="hidden" name="requestKey" value={requestKey} />
    <input type="hidden" name="operation" value={operation} />
    <label className="flex gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required />{operation === 'RESEND' ? 'I confirm resending invalidates the previous link.' : 'I confirm revoking permanently cancels this invitation.'}</label>
    <button type="submit" className="wp-button-secondary" disabled={pending}>{pending ? 'Processing…' : operation === 'RESEND' ? 'Resend invitation' : 'Revoke invitation'}</button>
    <Feedback state={state} />
  </form>;
}
export function OrganizationAdministratorActivationForm() {
  const retained = useRef('');
  const [token, setToken] = useState('');
  const [state, action, pending] = useActionState(activateOrganizationAdministratorAction, {});
  useEffect(() => {
    const capture = () => {
      // A resent link can open in this same tab using fragment-only navigation.
      // Preserve only the Strict Mode replay, never a superseded fragment token.
      retained.current = window.location.hash ? retainActivationToken(window.location.hash, '') : retained.current;
      setToken(retained.current);
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    };
    capture();
    window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, []);
  return <form action={action} className="space-y-5">
    <input type="hidden" name="token" value={token} />
    <label className="wp-label">Your name<input className="wp-input mt-2" name="name" minLength={2} maxLength={100} autoComplete="name" required /></label>
    <label className="wp-label">Create password<input className="wp-input mt-2" type="password" name="password" minLength={14} maxLength={72} autoComplete="new-password" required /></label>
    <label className="wp-label">Confirm password<input className="wp-input mt-2" type="password" name="passwordConfirmation" minLength={14} maxLength={72} autoComplete="new-password" required /></label>
    <p className="text-sm text-[var(--wp-text-muted)]">Use 14–72 characters, at most 72 UTF-8 bytes. This single-use link expires after 24 hours. You will sign in normally after activation.</p>
    <Feedback state={state} />
    <button className="wp-button-primary w-full" disabled={pending || !token}>{pending ? 'Activating…' : 'Activate HR administrator account'}</button>
    {!token && <p className="text-sm" role="status">Open the complete activation link from your invitation email.</p>}
  </form>;
}
