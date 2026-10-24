'use client';

import { useActionState } from 'react';
import { platformAccountAction, platformLoginAction } from './actions';

export function PlatformLoginForm() {
  const [state, action, pending] = useActionState(platformLoginAction, {});
  return <form action={action} className="space-y-5">
    <label className="wp-label">Email<input className="wp-input mt-2" type="email" name="email" autoComplete="username" required maxLength={254} /></label>
    <label className="wp-label">Password<input className="wp-input mt-2" type="password" name="password" autoComplete="current-password" required maxLength={72} /></label>
    {state.error && <p role="alert" className="wp-alert-danger">{state.error}</p>}
    <button className="wp-button-primary w-full" disabled={pending}>{pending ? 'Signing in…' : 'Sign in to platform administration'}</button>
  </form>;
}

export function PlatformAccountForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(platformAccountAction, {});
  return <form action={action} className="wp-card max-w-xl space-y-5 p-6">
    <p className="text-sm break-all">Sign-in email: {email}</p>
    <label className="wp-label">Name<input className="wp-input mt-2" name="name" defaultValue={name} minLength={2} maxLength={100} required autoComplete="name" /></label>
    <label className="wp-label">Current password<input className="wp-input mt-2" type="password" name="currentPassword" required maxLength={72} autoComplete="current-password" /></label>
    <label className="wp-label">New password (optional)<input className="wp-input mt-2" type="password" name="newPassword" minLength={14} maxLength={72} autoComplete="new-password" /></label>
    <p className="text-sm text-[var(--wp-text-muted)]">Use 14–72 characters, at most 72 UTF-8 bytes. Changing your password signs out every platform session.</p>
    {state.error && <p className="wp-alert-danger" role="alert">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-[var(--wp-success)]">{state.success}</p>}
    <button className="wp-button-primary" disabled={pending}>{pending ? 'Saving…' : 'Save account settings'}</button>
  </form>;
}
