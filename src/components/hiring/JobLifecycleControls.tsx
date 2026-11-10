'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, LockKeyhole, RotateCcw } from 'lucide-react';
import type { JobStatus } from '@prisma/client';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { closeJobAction, archiveJobAction, reuseJobAction } from '@/features/hiring/actions';

type LifecycleAction = 'close' | 'archive' | 'reuse';
type Props = {
  jobId: string;
  title: string;
  status: JobStatus;
  compact?: boolean;
};

const definitions = {
  close: {
    label: 'Close Posting',
    title: 'Close this job posting?',
    description: 'This will stop new applications for this posting. Existing applicants and their records stay available to HR.',
    warning: 'This does not delete the posting or its applications.',
    confirmLabel: 'Close Posting',
    confirmVariant: 'warning' as const,
    Icon: LockKeyhole,
  },
  archive: {
    label: 'Archive Posting',
    title: 'Archive this closed posting?',
    description: 'Move this closed posting into the Archived filter. Historical applications, decisions, and employee links are preserved.',
    warning: 'Archived postings become read-only. Use Reuse Posting to create a new recruitment cycle.',
    confirmLabel: 'Archive Posting',
    confirmVariant: 'warning' as const,
    Icon: Archive,
  },
  reuse: {
    label: 'Reuse Posting',
    title: 'Create a new draft from this archived posting?',
    description: 'Copy the position details and qualification requirements into a separate draft. Previous applicants will NOT move into the new cycle.',
    warning: 'The new draft will not appear on Careers until you review and publish it. Its closing date starts blank.',
    confirmLabel: 'Create New Draft',
    confirmVariant: 'primary' as const,
    Icon: RotateCcw,
  },
};

export function JobLifecycleControls({ jobId, title, status, compact = false }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<LifecycleAction | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const reuseRequestId = useRef<string | null>(null);

  const action: LifecycleAction | null = status === 'PUBLISHED' ? 'close'
    : status === 'CLOSED' ? 'archive'
    : status === 'ARCHIVED' ? 'reuse'
    : null;
  if (!action) return null;

  const option = definitions[action];
  const Icon = option.Icon;

  function onConfirm() {
    if (!active || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        if (active === 'reuse') {
          const result = await reuseJobAction(jobId, reuseRequestId.current || '');
          if (result.error || !result.jobId) {
            setError(result.error || 'A new draft could not be created.');
            return;
          }
          setActive(null);
          router.push(`/dashboard/hiring/jobs/${result.jobId}/edit?notice=reused`);
          router.refresh();
          return;
        }
        const result = active === 'close' ? await closeJobAction(jobId) : await archiveJobAction(jobId);
        if (result.error) {
          setError(result.error);
          return;
        }
        setActive(null);
        router.push(`/dashboard/hiring/jobs/${jobId}?notice=${active === 'close' ? 'closed' : 'archived'}`);
        router.refresh();
      } catch {
        setError('The operation could not be completed. Check your connection and try again.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        title={option.label}
        aria-label={`${option.label}: ${title}`}
        onClick={() => { if (action === 'reuse') reuseRequestId.current = window.crypto.randomUUID(); setActive(action); setError(null); }}
        className={compact
          ? 'inline-flex items-center gap-1.5 rounded-md border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--wp-text)] hover:bg-slate-100'
          : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-[#282934] hover:bg-slate-50'}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {option.label}
      </button>
      <ConfirmationDialog
        isOpen={active !== null}
        onClose={() => { if (!pending) { setActive(null); setError(null); } }}
        onConfirm={onConfirm}
        title={option.title}
        description={option.description}
        details={[{ label: 'Position', value: title }, { label: 'Current status', value: status }]}
        warning={option.warning}
        confirmLabel={option.confirmLabel}
        confirmVariant={option.confirmVariant}
        busy={pending}
        error={error}
      />
    </>
  );
}
