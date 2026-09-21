'use client';

import { useState } from 'react';
import { workspaceExists } from '@/features/organization-branding/workspace-actions';

export function WorkspaceDiscoveryForm() {
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const continueToWorkspace = async () => {
    const normalized = slug.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) { setError('Enter a valid workspace name.'); return; }
    setPending(true); const result = await workspaceExists(normalized); setPending(false);
    if (!result.ok) { setError(result.message); return; }
    const root = window.location.host.replace(/^app\./, '');
    window.location.assign(`${window.location.protocol}//${result.slug}.${root}/login`);
  };
  return <form className="mt-8" onSubmit={(event) => { event.preventDefault(); void continueToWorkspace(); }}><label className="wp-label" htmlFor="workspace">Workspace</label><div className="mt-2 flex"><input id="workspace" value={slug} onChange={(event) => setSlug(event.target.value)} className="wp-input rounded-r-none" placeholder="saga" autoCapitalize="none" autoCorrect="off" /><span className="flex items-center border-y border-r border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3 text-sm text-[var(--wp-text-muted)]">.workpulse.com</span></div>{error && <p role="alert" className="mt-2 text-sm text-[var(--wp-danger)]">{error}</p>}<button disabled={pending} className="wp-button-primary mt-5 w-full" type="submit">{pending ? 'Finding workspace…' : 'Continue to workspace'}</button><a href="/" className="mt-5 block text-center text-sm font-semibold text-[var(--wp-text-muted)] hover:text-[var(--wp-text)]">Back to WorkPulse</a></form>;
}
