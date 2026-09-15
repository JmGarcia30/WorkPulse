'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewLeaveRequestAction } from '@/features/leave/hr-actions';

export function LeaveReviewPanel({ requestId, typeCode }: { requestId: string; typeCode: string }) {
  const [remarks, setRemarks] = useState('');
  const [verified, setVerified] = useState(false);
  const [supportVerified, setSupportVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const run = (decision: 'APPROVE' | 'REJECT') => startTransition(async () => {
    const eligibilityChecks: Record<string, boolean> = { ELIGIBILITY_CONFIRMED: verified };
    if (typeCode === 'MATERNITY') {
      eligibilityChecks.SSS_SUPPORT_CONFIRMED = supportVerified;
      eligibilityChecks.DOCUMENT_SSS_SUPPORT_VERIFIED = supportVerified;
    }
    const result = await reviewLeaveRequestAction({ requestId, decision, remarks, eligibilityChecks });
    if ('error' in result) setMessage(result.error);
    else { router.refresh(); setMessage(decision === 'APPROVE' ? 'Request approved.' : 'Request rejected.'); }
  });
  return <section className="space-y-4 rounded-3xl border bg-white p-6"><h2 className="font-bold">HR Review</h2><label className="flex gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />I verified the employee against every applicable eligibility and policy condition.</label>{typeCode === 'MATERNITY' && <label className="flex gap-2 text-sm"><input type="checkbox" checked={supportVerified} onChange={(event) => setSupportVerified(event.target.checked)} />I verified the required SSS approval/support.</label>}<label className="block text-sm">Reviewer Remarks<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border p-3" /></label>{message && <p className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}<div className="flex gap-2"><button disabled={pending || !verified || !remarks.trim()} onClick={() => run('APPROVE')} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50">Approve</button><button disabled={pending || !remarks.trim()} onClick={() => run('REJECT')} className="rounded-xl border border-rose-300 px-4 py-2 font-bold text-rose-700 disabled:opacity-50">Reject</button></div></section>;
}
