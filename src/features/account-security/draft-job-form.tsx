'use client';
import { useActionState } from 'react';
import { deleteDraftJobAction } from './draft-job-action';

export function DraftJobDeleteForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(deleteDraftJobAction.bind(null, jobId), {});
  return <section className="wp-card space-y-3 p-5">
    <h2 className="font-semibold">Delete unused draft</h2>
    <p className="text-sm">This permanently removes an unpublished draft and its requirement tags. Applications and employment records prevent deletion.</p>
    <form action={action} className="space-y-3" onSubmit={event => { if (!window.confirm('Permanently delete this unused draft?')) event.preventDefault(); }}>
      <label className="block text-sm" htmlFor="delete-draft-confirmation">Type DELETE DRAFT to confirm</label>
      <input id="delete-draft-confirmation" name="confirmation" required pattern="DELETE DRAFT" className="wp-input" autoComplete="off" />
      <button className="wp-button-secondary" disabled={pending}>{pending ? 'Deleting…' : 'Delete draft'}</button>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  </section>;
}
