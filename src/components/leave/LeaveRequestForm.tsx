'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitMyLeaveRequestAction, uploadMyLeaveDocumentAction } from '@/features/leave/self-actions';

interface LeaveTypeOption {
  id: string;
  name: string;
  policy: {
    categories: Array<{ code: string; label: string }>;
    attestations: Array<{ code: string; label: string; options?: string[] }>;
    documents: Array<{ kindCode: string; label: string }>;
  };
}

export function LeaveRequestForm({ types }: { types: LeaveTypeOption[] }) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const type = useMemo(() => types.find((item) => item.id === typeId), [types, typeId]);

  return <form className="space-y-4 rounded-3xl border bg-white p-6" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const attestations = Object.fromEntries((type?.policy.attestations ?? []).map((rule) => [
      rule.code,
      form.get(`attestation_${rule.code}`) === 'on' ? true : String(form.get(`attestation_${rule.code}`) ?? ''),
    ]));
    setMessage(null);
    startTransition(async () => {
      const result = await submitMyLeaveRequestAction({
        leaveTypeId: typeId,
        from: String(form.get('from')),
        to: String(form.get('to')),
        categoryCode: String(form.get('categoryCode') ?? '') || null,
        reason: String(form.get('reason')),
        attestations,
      });
      if ('error' in result) { setMessage(result.error); return; }
      for (const rule of type?.policy.documents ?? []) {
        const file = form.get(`document_${rule.kindCode}`);
        if (file instanceof File && file.size) {
          const upload = new FormData();
          upload.set('kindCode', rule.kindCode); upload.set('file', file);
          const uploaded = await uploadMyLeaveDocumentAction(result.id, upload);
          if ('error' in uploaded) {
            setMessage(`Request submitted, but ${rule.label} was not uploaded: ${uploaded.error}`);
            return;
          }
        }
      }
      router.push(`/employee/leave/${result.id}`);
      router.refresh();
    });
  }}>
    <h2 className="font-bold">File Leave</h2>
    <label className="block text-sm">Leave Type<select value={typeId} onChange={(event) => setTypeId(event.target.value)} className="mt-1 w-full rounded-xl border p-3">{types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {!!type?.policy.categories.length && <label className="block text-sm">Category<select name="categoryCode" required className="mt-1 w-full rounded-xl border p-3"><option value="">Select</option>{type.policy.categories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Start Date<input type="date" name="from" required className="mt-1 w-full rounded-xl border p-3" /></label><label className="text-sm">End Date<input type="date" name="to" required className="mt-1 w-full rounded-xl border p-3" /></label></div>
    <label className="block text-sm">Reason<textarea name="reason" required maxLength={2000} className="mt-1 min-h-24 w-full rounded-xl border p-3" /></label>
    {type?.policy.attestations.map((rule) => rule.options ? <label key={rule.code} className="block text-sm">{rule.label}<select name={`attestation_${rule.code}`} required className="mt-1 w-full rounded-xl border p-3"><option value="">Select</option>{rule.options.map((option) => <option key={option}>{option}</option>)}</select></label> : rule.code.includes('DATE') ? <label key={rule.code} className="block text-sm">{rule.label}<input type="date" name={`attestation_${rule.code}`} required className="mt-1 w-full rounded-xl border p-3" /></label> : <label key={rule.code} className="flex gap-2 text-sm"><input type="checkbox" name={`attestation_${rule.code}`} required />{rule.label}</label>)}
    {type?.policy.documents.map((rule) => <label key={rule.kindCode} className="block text-sm">{rule.label}<input type="file" name={`document_${rule.kindCode}`} accept=".pdf,image/jpeg,image/png,image/webp" className="mt-1 block w-full rounded-xl border p-3" /><span className="mt-1 block text-xs text-slate-500">HR verifies applicable supporting documents before approval.</span></label>)}
    {message && <p className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}
    <button disabled={pending || !types.length} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Submitting…' : 'Submit Leave Request'}</button>
  </form>;
}
