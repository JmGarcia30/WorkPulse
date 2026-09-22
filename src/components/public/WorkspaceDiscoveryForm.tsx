'use client';

import { useState } from 'react';
import { workspaceExists } from '@/features/organization-branding/workspace-actions';
import styles from './WorkspaceDiscovery.module.css';

function platformRootHost(host: string) {
  return host.replace(/^app\./, '');
}

export function WorkspaceDiscoveryForm({
  publicUrl = '/',
  rootSuffix = 'workpulse.com',
}: {
  publicUrl?: string;
  rootSuffix?: string;
}) {
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const continueToWorkspace = async () => {
    const normalized = slug.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
      setError('Enter a valid workspace name.');
      return;
    }

    setPending(true);
    setError(null);

    try {
      const result = await workspaceExists(normalized);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      const root = platformRootHost(window.location.host);
      // A full navigation is required because each tenant has its own origin.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`${window.location.protocol}//${result.slug}.${root}/login`);
    } catch {
      setError('We could not check that workspace right now. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void continueToWorkspace();
      }}
    >
      <label className={styles.label} htmlFor="workspace">
        Workspace name
      </label>
      <div className={styles.workspaceField}>
        <input
          id="workspace"
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setError(null);
          }}
          className={styles.input}
          placeholder="saga"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="workspace-helper"
          aria-invalid={Boolean(error)}
        />
        <span className={styles.domainSuffix} aria-hidden="true">
          .{rootSuffix}
        </span>
      </div>
      <p id="workspace-helper" className={styles.helperText}>Use the name before the first dot in your organization&apos;s WorkPulse URL.</p>
      {error && (
        <p role="alert" className={styles.errorMessage}>
          {error}
        </p>
      )}
      <button disabled={pending} className={styles.submitButton} type="submit">
        {pending ? 'Finding workspace…' : 'Continue to workspace'}
      </button>
      <a href={publicUrl} className={styles.backLink}>
        Back to WorkPulse
      </a>
    </form>
  );
}
