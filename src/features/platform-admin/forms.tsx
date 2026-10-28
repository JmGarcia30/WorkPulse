'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { platformAccountAction, platformLoginAction } from './actions';

function PasswordInput({ name, label, autoComplete, minLength }: { name: string; label: string; autoComplete: 'current-password' | 'new-password'; minLength?: number }) {
  const [visible, setVisible] = useState(false);
  return <label className="wp-label">{label}
    <span className="relative mt-2 block">
      <input className="wp-input w-full pr-12" type={visible ? 'text' : 'password'} name={name} autoComplete={autoComplete} required={name !== 'newPassword'} minLength={minLength} maxLength={72} />
      <button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Hide ' + label.toLowerCase() : 'Show ' + label.toLowerCase()} aria-pressed={visible} title={visible ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600">
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  </label>;
}

export function PlatformLoginForm() {
  const [state, action, pending] = useActionState(platformLoginAction, {});
  return <form action={action} className="space-y-5" aria-busy={pending}>
    <label className="wp-label">Email address<input className="wp-input mt-2" type="email" name="email" autoComplete="username" placeholder="admin@example.com" required maxLength={254} autoCapitalize="none" spellCheck={false} /></label>
    <PasswordInput name="password" label="Password" autoComplete="current-password" />
    {state.error && <p role="alert" className="wp-alert-danger">{state.error}</p>}
    <button className="wp-button-primary w-full" disabled={pending}>{pending ? 'Signing in…' : 'Sign in to platform administration'}</button>
  </form>;
}

export function PlatformAccountForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(platformAccountAction, {});
  return <form action={action} className="wp-card max-w-xl space-y-5 p-6">
    <p className="text-sm break-all">Sign-in email: {email}</p>
    <label className="wp-label">Name<input className="wp-input mt-2" name="name" defaultValue={name} minLength={2} maxLength={100} required autoComplete="name" /></label>
    <PasswordInput name="currentPassword" label="Current password" autoComplete="current-password" />
    <PasswordInput name="newPassword" label="New password (optional)" autoComplete="new-password" minLength={14} />
    <p className="text-sm text-[var(--wp-text-muted)]">Use 14–72 characters, at most 72 UTF-8 bytes. Changing your password signs out every platform session.</p>
    {state.error && <p className="wp-alert-danger" role="alert">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-[var(--wp-success)]">{state.success}</p>}
    <button className="wp-button-primary" disabled={pending}>{pending ? 'Saving…' : 'Save account settings'}</button>
  </form>;
}
