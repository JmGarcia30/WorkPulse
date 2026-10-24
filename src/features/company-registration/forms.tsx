'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { registerCompanyAction, resendCompanyVerificationAction, verifyCompanyRegistrationAction } from './actions';

export function CompanyRegistrationForm() {
  const [state, action, pending] = useActionState(registerCompanyAction, {});
  const [resend, resendAction, resending] = useActionState(resendCompanyVerificationAction, {});
  return <div className="space-y-5">
    {!state.email && <form action={action} className="space-y-5">
      <label className="wp-label block">Company name<input name="companyName" className="wp-input mt-2" autoComplete="organization" minLength={2} maxLength={150} required /></label>
      <label className="wp-label block">Your name<input name="administratorName" className="wp-input mt-2" autoComplete="name" minLength={2} maxLength={100} required /></label>
      <label className="wp-label block">Work email<input name="email" type="email" className="wp-input mt-2" autoComplete="email" maxLength={254} required /></label>
      <label className="wp-label block">Password<input name="password" type="password" className="wp-input mt-2" autoComplete="new-password" minLength={14} maxLength={72} aria-describedby="password-help" required /></label>
      <p id="password-help" className="text-sm text-[var(--wp-text-muted)]">Use 14–72 characters, at most 72 UTF-8 bytes.</p>
      <p className="text-sm text-[var(--wp-text-muted)]">We will create your workspace after you verify your email. Your workspace address is generated automatically. Open the verification email in this browser.</p>
      <button disabled={pending} className="wp-button-primary w-full">{pending ? 'Sending verification…' : 'Create company workspace'}</button>
    </form>}
    {state.error && <p role="alert" className="wp-alert-danger">{state.error}</p>}
    {state.success && <p role="status" className="text-sm">{state.success}</p>}
    {state.email && <form action={resendAction} className="space-y-3">
      <input type="hidden" name="email" value={state.email} />
      <p className="text-sm text-[var(--wp-text-muted)]">Check your inbox and spam folder. You can send a replacement link after 60 seconds. Links expire after 24 hours.</p>
      <button disabled={resending} className="wp-button-secondary w-full">{resending ? 'Sending…' : 'Resend verification email'}</button>
      {resend.error && <p role="alert" className="wp-alert-danger">{resend.error}</p>}
      {resend.success && <p role="status" className="text-sm">{resend.success}</p>}
    </form>}
  </div>;
}

export function CompanyVerificationForm() {
  const retained = useRef('');
  const [token, setToken] = useState('');
  const [state, action, pending] = useActionState(verifyCompanyRegistrationAction, {});
  useEffect(() => {
    const capture = () => {
      if (window.location.hash) retained.current = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
      setToken(retained.current);
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    };
    capture();
    window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, []);
  return <form action={action} className="space-y-5">
    <input type="hidden" name="token" value={token} />
    <p className="text-sm">Verify your email to create your company workspace. You will then sign in securely with the email and password you registered.</p>
    <button disabled={pending || !token} className="wp-button-primary w-full">{pending ? 'Creating your workspace…' : 'Verify email and create workspace'}</button>
    {!token && <p role="status" className="text-sm">Open the complete verification link from your email in the browser where you registered.</p>}
    {state.error && <p role="alert" className="wp-alert-danger">{state.error}</p>}
  </form>;
}
