'use client';

import { useState, useTransition } from 'react';
import { loginAction } from '@/lib/auth/actions';

export function TenantLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); setError(null); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await loginAction(data); if (result?.error) setError(result.error); }); }}><div><label className="wp-label" htmlFor="email">Email address</label><input className="wp-input mt-2" id="email" name="email" type="email" autoComplete="username" required /></div><div><label className="wp-label" htmlFor="password">Password</label><input className="wp-input mt-2" id="password" name="password" type="password" autoComplete="current-password" required /></div>{error && <p role="alert" className="wp-alert-danger">{error}</p>}<button className="wp-button-primary w-full" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button></form>;
}
