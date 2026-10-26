'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, FileCheck, Loader2 } from 'lucide-react';
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

  return (
    <form
      className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-2xs"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const attestations = Object.fromEntries(
          (type?.policy.attestations ?? []).map((rule) => [
            rule.code,
            form.get(`attestation_${rule.code}`) === 'on'
              ? true
              : String(form.get(`attestation_${rule.code}`) ?? ''),
          ])
        );
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
          if ('error' in result) {
            setMessage(result.error);
            return;
          }
          for (const rule of type?.policy.documents ?? []) {
            const file = form.get(`document_${rule.kindCode}`);
            if (file instanceof File && file.size) {
              const upload = new FormData();
              upload.set('kindCode', rule.kindCode);
              upload.set('file', file);
              const uploaded = await uploadMyLeaveDocumentAction(result.id, upload);
              if ('error' in uploaded) {
                setMessage(
                  `Request submitted, but ${rule.label} was not uploaded: ${uploaded.error}`
                );
                return;
              }
            }
          }
          router.push(`/employee/leave/${result.id}`);
          router.refresh();
        });
      }}
    >
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
          Leave Type
        </label>
        <select
          value={typeId}
          onChange={(event) => setTypeId(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--tenant-primary)] focus:outline-hidden transition"
        >
          {types.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {!!type?.policy.categories.length && (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            Leave Category
          </label>
          <select
            name="categoryCode"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--tenant-primary)] focus:outline-hidden transition"
          >
            <option value="">Select Category</option>
            {type.policy.categories.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            Start Date
          </label>
          <input
            type="date"
            name="from"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--tenant-primary)] focus:outline-hidden transition"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            End Date
          </label>
          <input
            type="date"
            name="to"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--tenant-primary)] focus:outline-hidden transition"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
          Reason for Leave
        </label>
        <textarea
          name="reason"
          required
          maxLength={2000}
          rows={3}
          placeholder="Briefly describe the purpose of this leave request..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--tenant-primary)] focus:outline-hidden transition"
        />
      </div>

      {type?.policy.attestations.map((rule) =>
        rule.options ? (
          <div key={rule.code}>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              {rule.label}
            </label>
            <select
              name={`attestation_${rule.code}`}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--tenant-primary)] focus:outline-hidden transition"
            >
              <option value="">Select option</option>
              {rule.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : rule.code.includes('DATE') ? (
          <div key={rule.code}>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              {rule.label}
            </label>
            <input
              type="date"
              name={`attestation_${rule.code}`}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[var(--tenant-primary)] focus:outline-hidden transition"
            />
          </div>
        ) : (
          <label key={rule.code} className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              name={`attestation_${rule.code}`}
              required
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--tenant-primary)] focus:ring-[var(--tenant-primary)]"
            />
            <span>{rule.label}</span>
          </label>
        )
      )}

      {type?.policy.documents.map((rule) => (
        <div key={rule.kindCode} className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            {rule.label}
          </label>
          <input
            type="file"
            name={`document_${rule.kindCode}`}
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--tenant-tint)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--tenant-primary)] hover:file:brightness-95"
          />
          <span className="block text-[11px] text-slate-400">
            HR verifies applicable supporting documents before approval. Max 10MB (.pdf, .jpg, .png).
          </span>
        </div>
      ))}

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !types.length}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-primary)] px-5 py-2 text-sm font-bold text-white shadow-xs transition hover:brightness-95 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Submitting…</span>
            </>
          ) : (
            <>
              <FileCheck className="h-4 w-4" />
              <span>Submit Leave Request</span>
            </>
          )}
        </button>
        <Link
          href="/employee/leave"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
