'use client';
import { useActionState, useEffect, useState } from 'react';
import { forgotPasswordAction, resetPasswordAction } from './recovery-actions';

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});
  return <form action={action} aria-busy={pending} className="wp-card space-y-4 p-6">
    <label className="wp-label">Account email<input className="wp-input mt-2" name="email" type="email" required maxLength={254} autoComplete="email" /></label>
    {state.success && <p role="status">{state.success}</p>}
    <button className="wp-button-primary" disabled={pending}>{pending ? 'Requesting…' : 'Send password reset email'}</button>
  </form>;
}
export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  const [token, setToken] = useState('');
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    // Bootstrap client-only secret state from the browser fragment before removing it.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- External browser state is unavailable during server rendering.
    setToken(/^[a-f0-9]{64}$/.test(value) ? value : '');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);
  return <form action={action} aria-busy={pending} className="wp-card space-y-4 p-6">
    <input type="hidden" name="token" value={token} />
    <p className="text-sm">Use 14–72 characters, at most 72 UTF-8 bytes. Resetting your password signs out every previous session.</p>
    <label className="wp-label">New password<input className="wp-input mt-2" name="password" type="password" required minLength={14} maxLength={72} autoComplete="new-password" /></label>
    <label className="wp-label">Confirm new password<input className="wp-input mt-2" name="confirmation" type="password" required minLength={14} maxLength={72} autoComplete="new-password" /></label>
    {state.error && <p role="alert" className="wp-alert-danger">{state.error}</p>}
    {state.success && <p role="status">{state.success}</p>}
    <button className="wp-button-primary" disabled={pending || !token || !!state.success}>{pending ? 'Resetting…' : 'Reset password'}</button>
    {!token && <p role="alert">Open the complete password reset link from your email.</p>}
  </form>;
}
