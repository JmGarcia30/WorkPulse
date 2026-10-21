'use client';
import { useState } from 'react';
import { verifyCandidateEmail } from '@/features/careers/verification-actions';

export function VerifyCandidateEmail({ slug, id }: { slug: string; id: string }) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  return <div className="max-w-md mx-auto p-8 space-y-4">
    <h1 className="text-xl font-bold">Verify your email</h1>
    <p>Confirm to open your application. The email link expires after 15 minutes.</p>
    <button disabled={pending} onClick={async () => {
      setPending(true);
      const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
      window.history.replaceState(null, '', window.location.pathname);
      try { const result = await verifyCandidateEmail(slug, id, token); setMessage(result.error); }
      finally { setPending(false); }
    }} className="rounded bg-indigo-600 text-white px-4 py-2">{pending ? 'Verifying…' : 'Verify and continue'}</button>
    <p role="status">{message}</p>
    <a href={`/careers/${encodeURIComponent(slug)}/portal/${encodeURIComponent(id)}`}>Request a new link</a>
  </div>;
}
