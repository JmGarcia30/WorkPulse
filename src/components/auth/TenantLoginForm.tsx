'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { loginFormAction } from '@/lib/auth/actions';
import styles from './TenantLoginForm.module.css';

export function TenantLoginForm() {
  const [state, formAction, pending] = useActionState(loginFormAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form className={styles.form} action={formAction}>
      <label>
        <span>Email</span>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        <span>Password</span>
        <div className={styles.passwordField}>
          <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required />
          <button
            type="button"
            className={styles.visibilityToggle}
            onClick={() => setShowPassword(value => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
          </button>
        </div>
      </label>
      {state?.error && <p role="alert" className={styles.error}>{state.error}</p>}
      <button disabled={pending}>{pending ? 'Signing in…' : 'Sign In'}</button>
    </form>
  );
}
