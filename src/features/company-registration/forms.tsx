'use client';

import { useActionState, useEffect, useState } from 'react';
import { registerCompanyAction, resendCompanyVerificationAction, verifyCompanyRegistrationAction } from './actions';
import styles from '@/app/request-demo/request-demo.module.css';

export function CompanyRegistrationForm() {
  const [state, action, pending] = useActionState(registerCompanyAction, {});
  const [resend, resendAction, resending] = useActionState(resendCompanyVerificationAction, {});
  return <div>
    {!state.email && <form action={action} className={styles.form}>
      <label >Company name<input name="companyName" autoComplete="organization" minLength={2} maxLength={150} required /></label>
      <label >Your name<input name="administratorName" autoComplete="name" minLength={2} maxLength={100} required /></label>
      <label >Work email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label >Password<input name="password" type="password" autoComplete="new-password" minLength={14} maxLength={72} aria-describedby="password-help" required /></label>
      <p id="password-help" style={{ fontSize: 13, lineHeight: 1.6, color: '#625e5a' }}>Use 14–72 characters, at most 72 UTF-8 bytes.</p>
      <p className="text-sm text-[var(--wp-text-muted)]">We will create your workspace after you verify your email. Your workspace address is generated automatically. Open the verification email in this browser.</p>
      <button disabled={pending} type="submit">{pending ? 'Sending verification…' : 'Create company workspace'}</button>
    </form>}
    {state.error && <p role="alert" className={styles.errorMessage}>{state.error}</p>}
    {state.success && <p role="status" className="text-sm">{state.success}</p>}
    {state.email && <form action={resendAction} className={styles.form}>
      <input type="hidden" name="email" value={state.email} />
      <p className="text-sm text-[var(--wp-text-muted)]">Check your inbox and spam folder. You can send a replacement link after 60 seconds. Links expire after 24 hours.</p>
      <button disabled={resending} type="submit">{resending ? 'Sending…' : 'Resend verification email'}</button>
      {resend.error && <p role="alert" className="wp-alert-danger">{resend.error}</p>}
      {resend.success && <p role="status" className="text-sm">{resend.success}</p>}
    </form>}
  </div>;
}

// Keep the token in the URL fragment (never sent in HTTP request headers).
// Email apps can open just /register/verify; users may paste the full
// verification link or the code printed in the email as a recovery path.
function verificationToken(raw: string): string {
  const value = raw.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.origin !== window.location.origin || url.pathname !== '/register/verify') return '';
    const token = new URLSearchParams(url.hash.slice(1)).get('token') ?? '';
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : '';
  } catch {
    return '';
  }
}

export function CompanyVerificationForm() {
  const [token, setToken] = useState('');
  const [pasted, setPasted] = useState('');
  const [password, setPassword] = useState('');
  const [state, action, pending] = useActionState(verifyCompanyRegistrationAction, {});

  useEffect(() => {
    const capture = () => {
      const current = verificationToken(window.location.href);
      if (current) setToken(current);
    };
    capture();
    window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, []);

  return <form action={action} className="space-y-5">
    <input type="hidden" name="token" value={token} />
    <p className="text-sm">Confirm your email to create the company workspace and first HR administrator account. Use the verification link sent to your inbox.</p>

    <label className="block space-y-2 text-sm font-medium">
      <span>Verification link or code</span>
      <input
        className="wp-input w-full"
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={pasted}
        onChange={(event) => { const next = event.target.value; setPasted(next); setToken(verificationToken(next)); }}
        placeholder="Paste your complete email link or verification code"
        aria-describedby="registration-token-help"
      />
    </label>
    <p id="registration-token-help" className="text-xs text-[var(--wp-text-muted)]">
      If the email button opens this page without a token, copy the complete link from the email and paste it here. If the token is detected from the link automatically, you do not need to paste it.
    </p>
    <label className="block space-y-2 text-sm font-medium">
      <span>Original registration password (if verifying in another browser)</span>
      <input
        className="wp-input w-full"
        type="password"
        name="registrationPassword"
        autoComplete="off"
        minLength={14}
        maxLength={72}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Not needed when using the original browser"
      />
    </label>
    <button disabled={pending || !token} className="wp-button-primary w-full" type="submit">{pending ? 'Creating your workspace…' : 'Verify email and create workspace'}</button>
    {!token && <p role="status" className="text-sm text-[var(--wp-text-muted)]">A valid 43-character verification code is needed. Copy the full link from the latest WorkPulse email if it was not detected automatically.</p>}
    {state.error && <p role="alert" className="wp-alert-danger">{state.error}</p>}
  </form>;
}
