'use client';

import { useActionState } from 'react';
import { loginFormAction } from '@/lib/auth/actions';
import styles from './TenantLoginForm.module.css';

export function TenantLoginForm() {
  const [state, formAction, pending] = useActionState(loginFormAction, null);

  return (
    <form className={styles.form} action={formAction}>
      <label>
        <span>Email</span>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        <span>Password</span>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && <p role="alert" className={styles.error}>{state.error}</p>}
      <button disabled={pending}>{pending ? 'Signing in…' : 'Sign In'}</button>
    </form>
  );
}
