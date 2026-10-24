'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { previewHrEmailAction, sendHrEmailAction } from '@/features/hiring/hr-email-actions';
import type { HrWorkflowRequest } from '@/features/hiring/hr-email-workflows';

type Preview = NonNullable<Awaited<ReturnType<typeof previewHrEmailAction>>['preview']>;
const types = [['acknowledgment', 'Applicant acknowledgment'], ['interview', 'Interview invitation'], ['acceptance', 'Successful applicant notification'], ['rejection', 'Rejection notification'], ['onboarding', 'Employee onboarding instructions']] as const;

export function HrEmailWorkflow({ applicationId, interviews }: { applicationId: string; interviews: { id: string; label: string }[] }) {
  const router = useRouter();
  const [type, setType] = useState<HrWorkflowRequest['type']>('acknowledgment');
  const [interviewId, setInterviewId] = useState(interviews[0]?.id || '');
  const [instructions, setInstructions] = useState('');
  const [preview, setPreview] = useState<Preview>();
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<{ success: boolean; message: string }>();
  const [pending, startTransition] = useTransition();
  const reset = () => { setPreview(undefined); setConfirmed(false); setNotice(undefined); };
  const request = (): HrWorkflowRequest => ({ applicationId, type, ...(type === 'interview' ? { interviewId } : {}), ...(type === 'onboarding' ? { instructions } : {}) });
  return <section className="wp-card space-y-4 p-5" aria-busy={pending}>
    <p className="text-sm text-[var(--wp-text-muted)]">Email actions do not change application, offer, interview, or onboarding status. Review the existing workflow records first. Saving a status never sends these emails automatically.</p>
    <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
      <label className="grid gap-1 text-sm font-semibold">Email type<select className="rounded border p-2 font-normal" value={type} onChange={event => { reset(); setType(event.target.value as HrWorkflowRequest['type']); }}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {type === 'interview' && <label className="grid gap-1 text-sm font-semibold">Saved interview<select className="rounded border p-2 font-normal" value={interviewId} onChange={event => { reset(); setInterviewId(event.target.value); }}><option value="">Select a scheduled interview</option>{interviews.map(interview => <option key={interview.id} value={interview.id}>{interview.label}</option>)}</select></label>}
      {type === 'onboarding' && <label className="grid gap-1 text-sm font-semibold">Additional instructions for this email (optional)<textarea maxLength={4000} rows={4} className="rounded border p-2 font-normal" value={instructions} onChange={event => { reset(); setInstructions(event.target.value); }} /><span className="text-xs font-normal">Saved outstanding onboarding task titles and due dates are included. Internal notes, file links, and reviewer comments are excluded.</span></label>}
      <button type="button" className="wp-button-secondary" onClick={() => startTransition(async () => {
        reset();
        try { const result = await previewHrEmailAction(request()); if (result.preview) setPreview(result.preview); else setNotice({ success: false, message: result.error || 'Preview unavailable.' }); }
        catch { setNotice({ success: false, message: 'Preview could not be loaded. Please try again.' }); }
        router.refresh();
      })}>{pending ? 'Please wait…' : 'Preview recipient and email'}</button>
      {preview && <div className="space-y-4 border-t pt-4">
        <dl className="space-y-2 break-words text-sm"><div><dt className="font-semibold">To</dt><dd>{preview.to}</dd></div><div><dt className="font-semibold">From</dt><dd>{preview.from} · {preview.senderMode === 'legacy' ? 'Existing SAGA sender' : 'Organization Gmail account'}</dd></div><div><dt className="font-semibold">Subject</dt><dd>{preview.subject}</dd></div></dl>
        <iframe title="HR email content preview" sandbox="" srcDoc={preview.html} className="h-[600px] w-full rounded border bg-white" />
        <details><summary className="cursor-pointer text-sm font-semibold">Plain-text alternative</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm">{preview.text}</pre></details>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I reviewed the recipient, sender, subject, and content and explicitly confirm sending this email.</label>
        <button type="button" className="wp-button-primary" disabled={!confirmed || pending} onClick={() => startTransition(async () => {
          const approval = { id: preview.id, contentHash: preview.contentHash, confirmed };
          setConfirmed(false);
          try { setNotice(await sendHrEmailAction(request(), approval)); }
          catch { setNotice({ success: false, message: 'The result could not be confirmed. Refresh delivery history and check the sending account before trying again.' }); }
          setPreview(undefined); router.refresh();
        })}>Confirm and send email</button>
      </div>}
    </fieldset>
    {pending && <p role="status" className="text-sm">Processing email action… Please wait.</p>}
    {notice && <p role={notice.success ? 'status' : 'alert'} className={notice.success ? 'text-sm text-green-800' : 'text-sm text-red-800'}>{notice.message}</p>}
  </section>;
}
