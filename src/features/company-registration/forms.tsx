'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { registerCompanyAction, resendCompanyVerificationAction, verifyCompanyRegistrationAction } from './actions';
import type { RegistrationState } from './schema';
import styles from '@/app/request-demo/request-demo.module.css';

function RegistrationPassword({ name = 'password', optional = false }: { name?: string; optional?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <label>Password{optional ? ' (required in another browser)' : ''}
    <input name={name} type={visible ? 'text' : 'password'} autoComplete={optional ? 'current-password' : 'new-password'} minLength={14} maxLength={72} required={!optional} aria-describedby={optional ? 'cross-browser-help' : 'password-help'} />
    <button type="button" style={{ minHeight: 32, justifySelf: 'end', padding: '4px 10px', background: 'transparent', color: '#7a0000' }} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? 'Hide password' : 'Show password'}</button>
  </label>;
}

export function CompanyRegistrationForm() {
  const [state, action, pending] = useActionState(registerCompanyAction, {});
  return <form action={action} className={styles.form}>
    <label>Company name<input name="companyName" autoComplete="organization" minLength={2} maxLength={150} required /></label>
    <label>Your name<input name="administratorName" autoComplete="name" minLength={2} maxLength={100} required /></label>
    <label>Work email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    <RegistrationPassword />
    <p id="password-help" style={{ fontSize: 13, lineHeight: 1.6, color: '#625e5a' }}>Use 14–72 characters, at most 72 UTF-8 bytes.</p>
    <p className="text-sm text-[var(--wp-text-muted)]">We will create your workspace after you verify your email with a six-digit code.</p>
    <button disabled={pending} type="submit">{pending ? 'Sending verification…' : 'Create company workspace'}</button>
    {state.error && <p role="alert" className={styles.errorMessage}>{state.error}</p>}
    {state.email && <a href={'/register/verify#email=' + encodeURIComponent(state.email)}>Continue to verification or resend your code</a>}
  </form>;
}

export function CompanyVerificationForm() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [retryAt, setRetryAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [state, action, pending] = useActionState(verifyCompanyRegistrationAction, {});
  const [resend, resendAction, resending] = useActionState(async (previous: RegistrationState, form: FormData) => {
    const result = await resendCompanyVerificationAction(previous, form);
    if (result.retryAt) { setRetryAt(result.retryAt); setSeconds(Math.max(0, Math.ceil((result.retryAt - Date.now()) / 1000))); }
    if (result.success) { setDigits(Array(6).fill('')); setToken(''); }
    return result;
  }, {});

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const legacy = fragment.get('token') ?? '';
    const address = fragment.get('email') ?? '';
    startTransition(() => {
      if (/^[A-Za-z0-9_-]{43}$/.test(legacy)) setToken(legacy);
      if (address) { setEmail(address); setRetryAt(Date.now() + 60000); setSeconds(60); }
    });
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  function enter(index: number, raw: string) {
    const value = raw.replace(/[^0-9]/g, '').slice(0, 6);
    setDigits(previous => {
      const next = [...previous];
      if (!value) next[index] = '';
      else for (let offset = 0; offset < value.length && index + offset < 6; offset++) next[index + offset] = value[offset];
      return next;
    });
    if (value) inputs.current[Math.min(5, index + value.length)]?.focus();
  }

  return <form action={action} className={styles.form}>
    <p className="text-sm">Check your email for a six-digit code. Codes expire after 10 minutes. Check your spam folder too.</p>
    <label>Work email<input name="email" type="email" autoComplete="email" maxLength={254} required={!token} value={email} onChange={event => setEmail(event.target.value)} /></label>
    {token ? <>
      <input type="hidden" name="token" value={token} />
      <p role="status">Your pending verification link is still supported. Verify below, or resend to switch to a six-digit code.</p>
    </> : <fieldset disabled={pending || resending}>
      <legend>Six-digit verification code</legend>
      <input type="hidden" name="code" value={digits.join('')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
        {digits.map((digit, index) => <input key={index} ref={element => { inputs.current[index] = element; }} aria-label={'Verification digit ' + (index + 1)} type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} pattern="[0-9]*" maxLength={6} value={digit}
          style={{ width: '100%', minWidth: 0, padding: '12px 0', textAlign: 'center', fontSize: 24 }}
          onChange={event => enter(index, event.target.value)}
          onFocus={event => event.target.select()}
          onPaste={event => { event.preventDefault(); const pasted = event.clipboardData.getData('text').replace(/[^0-9]/g, ''); enter(pasted.length === 6 ? 0 : index, pasted); }}
          onKeyDown={event => {
            if (event.key === 'Backspace' && !digit && index > 0) { event.preventDefault(); enter(index - 1, ''); inputs.current[index - 1]?.focus(); }
            if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
            if (event.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus();
          }} />)}
      </div>
    </fieldset>}
    <RegistrationPassword name="registrationPassword" optional />
    <p id="cross-browser-help" className="text-xs text-[var(--wp-text-muted)]">On another device or browser, enter the password you chose when registering. This protects your workspace from registrations made by someone else.</p>
    <button disabled={pending || resending || (!token && digits.join('').length !== 6)} type="submit">{pending ? 'Creating your workspace…' : 'Verify Email'}</button>
    {state.error && <p role="alert" className={styles.errorMessage}>{state.error}</p>}
    <button formAction={resendAction} formNoValidate disabled={pending || resending || seconds > 0 || !email} type="submit">{resending ? 'Sending…' : seconds > 0 ? `Resend Code in ${seconds}s` : 'Resend Code'}</button>
    {resend.error && <p role="alert" className={styles.errorMessage}>{resend.error}</p>}
    {resend.success && <p role="status" className="text-sm">A new code has been sent. Previous codes no longer work.</p>}
  </form>;
}
