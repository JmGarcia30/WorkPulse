'use client';

import { useState, useTransition } from 'react';
import { loginAction } from '@/lib/auth/actions';
import styles from './TenantLoginForm.module.css';

export function TenantLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form className={styles.form} onSubmit={(event) => {
      event.preventDefault();
      setError(null);
      const data = new FormData(event.currentTarget);
      startTransition(async () => {
        const result = await loginAction(data);
        if (result?.error) setError(result.error);
      });
    }}>
      <label>
        <span>Email</span>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        <span>Password</span>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button disabled={pending}>{pending ? 'Signing in…' : 'Sign In'}</button>
    </form>
  );
}
