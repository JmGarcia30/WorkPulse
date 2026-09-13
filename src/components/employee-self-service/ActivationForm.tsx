'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { activateEmployeeAccountAction } from '@/features/employee-self-service/actions';
import { retainActivationToken } from '@/features/employee-self-service/activation-fragment';

export function ActivationForm() {
  const token = useRef('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // React Strict Mode replays effects in development. Never overwrite an already
    // captured secret after the first pass removes the fragment from the URL.
    token.current = retainActivationToken(window.location.hash, token.current);
    if (window.location.hash) window.history.replaceState(null, '', '/activate/employee');
  }, []);

  return <form onSubmit={(event) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await activateEmployeeAccountAction({ token: token.current, password, passwordConfirmation: confirmation });
      if (result?.error) setError(result.error);
    });
  }} className="space-y-4">
    {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <label className="block text-sm font-bold">Create password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>
    <label className="block text-sm font-bold">Confirm password<input type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>
    <p className="text-xs text-slate-500">Use 12–72 bytes. This one-time link expires after 24 hours.</p>
    <button disabled={pending} className="w-full rounded-xl bg-slate-900 p-3 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Activating…' : 'Activate account'}</button>
  </form>;
}
