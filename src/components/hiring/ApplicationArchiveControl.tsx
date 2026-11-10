'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { setApplicationArchivedAction } from '@/features/hiring/application-archive-actions';

export function ApplicationArchiveControl({
  applicationId,
  name,
  status,
  archived,
}: {
  applicationId: string;
  name: string;
  status: string;
  archived: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  if (status !== 'REJECTED' && status !== 'WITHDRAWN') return null;

  function confirm() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await setApplicationArchivedAction(applicationId, !archived);
        if (result.error) {
          setError(result.error);
          return;
        }
        setOpen(false);
        setNotice(archived ? 'Application restored to the active list.' : 'Application archived. Its history remains available.');
        router.refresh();
      } catch {
        setError('The request could not be completed. Check your connection and try again.');
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => { setOpen(true); setNotice(null); setError(null); }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-[#282934] hover:bg-slate-50 disabled:opacity-50"
      >
        {archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
        {archived ? 'Restore' : 'Archive'}
      </button>
      {notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}
      <ConfirmationDialog
        isOpen={open}
        onClose={() => { if (!pending) { setOpen(false); setError(null); } }}
        onConfirm={confirm}
        busy={pending}
        title={archived ? 'Restore this application?' : 'Archive this application?'}
        description={archived
          ? 'Return this application to the regular Rejected or Withdrawn lists. Its original decision will not change.'
          : 'Move this terminal application to Archived. It will be hidden from regular applicant lists, but all history and documents will be kept.'}
        details={[{ label: 'Applicant', value: name }, { label: 'Decision', value: status }]}
        warning={archived ? 'Restoring will not restart recruitment or notify the applicant.' : 'This does not delete the applicant or change the decision. You can restore it later.'}
        confirmLabel={archived ? 'Restore Application' : 'Archive Application'}
        confirmVariant="warning"
        error={error}
      />
    </div>
  );
}
