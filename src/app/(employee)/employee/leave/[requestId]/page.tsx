import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Paperclip,
  Printer,
  Trash2,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { getMyLeaveRequest } from '@/features/leave/self-queries';
import {
  removeMyLeaveDocumentAction,
  uploadMyLeaveDocumentAction,
  withdrawMyLeaveRequestAction,
} from '@/features/leave/self-actions';

function LeaveStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
    WITHDRAWN: 'bg-slate-100 text-slate-600 border-slate-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const style = map[status] ?? 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${style}`}>
      {status}
    </span>
  );
}

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

export default async function MyLeaveRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const request = await getMyLeaveRequest(requestId);
  if (!request) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link
          href="/employee/leave"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Leave Requests</span>
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
                {request.type}
              </h1>
              <LeaveStatusBadge status={request.status} />
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              {request.category ? `${request.category} • ` : ''}
              Requested period: {request.from} to {request.to}
            </p>
          </div>

          <Link
            href={`/employee/leave/${request.id}/form`}
            target="_blank"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Leave Form</span>
          </Link>
        </div>
      </div>

      {/* Main Request Information Card */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-2xs space-y-6">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tenant-tint)] text-[var(--tenant-primary)]">
            <Calendar className="h-4 w-4" />
          </span>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">Request Details</h2>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs sm:text-sm">
          <div>
            <dt className="text-slate-400 font-medium">Leave Days / Units</dt>
            <dd className="mt-1 font-bold text-slate-900">
              {request.units != null ? `${request.units} day(s)` : 'Pending HR calculation'}
            </dd>
          </div>

          <div>
            <dt className="text-slate-400 font-medium">Expected Return Date</dt>
            <dd className="mt-1 font-bold text-slate-900">
              {request.expectedReturnDate ?? 'Not yet determined'}
            </dd>
          </div>

          <div>
            <dt className="text-slate-400 font-medium">Date Submitted</dt>
            <dd className="mt-1 font-bold text-slate-900">
              {formatDate(request.submittedAt)}
            </dd>
          </div>

          {request.reviewedAt && (
            <div>
              <dt className="text-slate-400 font-medium">Date Reviewed</dt>
              <dd className="mt-1 font-bold text-slate-900">
                {formatDate(request.reviewedAt)}
              </dd>
            </div>
          )}
        </dl>

        {request.units == null && request.status === 'PENDING' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800">
            <strong>Calculation Notice:</strong> Final leave deductions and unit counts are verified and confirmed by HR during approval.
          </div>
        )}

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Reason for Leave
          </h3>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap">
            {request.reason || 'No specific reason provided.'}
          </div>
        </div>

        {request.reviewerRemarks && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              HR Reviewer Remarks
            </h3>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 text-xs sm:text-sm text-indigo-900 whitespace-pre-wrap">
              {request.reviewerRemarks}
            </div>
          </div>
        )}
      </section>

      {/* Supporting Documents Section */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <Paperclip className="h-4 w-4" />
          </span>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">Supporting Documents</h2>
        </div>

        {request.documents.length > 0 ? (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {request.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3.5 hover:bg-slate-50/50 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <a
                    href={`/api/leave-documents/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs sm:text-sm font-semibold text-[var(--tenant-primary)] hover:underline truncate"
                  >
                    {doc.kindCode}: {doc.fileName}
                  </a>
                </div>

                {request.status === 'PENDING' && (
                  <form
                    action={async () => {
                      'use server';
                      await removeMyLeaveDocumentAction(request.id, doc.id, true);
                    }}
                  >
                    <button
                      type="submit"
                      aria-label="Remove document"
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No supporting documents uploaded for this request.</p>
        )}

        {/* Upload form for pending requests */}
        {request.status === 'PENDING' && (
          <form
            action={async (formData) => {
              'use server';
              await uploadMyLeaveDocumentAction(request.id, formData);
            }}
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            <select
              name="kindCode"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-[var(--tenant-primary)] focus:outline-hidden"
            >
              <option value="SUPPORTING_DOCUMENT">Supporting Document</option>
              <option value="MEDICAL_CERTIFICATE">Medical Certificate</option>
              <option value="SSS_SUPPORT">SSS Approval / Support</option>
            </select>
            <input
              type="file"
              name="file"
              required
              accept=".pdf,image/jpeg,image/png,image/webp"
              className="text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
            />
            <button
              type="submit"
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--tenant-primary)] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:brightness-95 transition"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Document</span>
            </button>
          </form>
        )}
      </section>

      {/* Withdraw Request Option */}
      {request.status === 'PENDING' && (
        <section className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-rose-950">Withdraw Request</h3>
              <p className="text-xs text-rose-700">
                You can withdraw this request while it is still awaiting HR review.
              </p>
            </div>
          </div>
          <form
            action={async () => {
              'use server';
              await withdrawMyLeaveRequestAction(request.id, true);
            }}
          >
            <button
              type="submit"
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
            >
              Withdraw Request
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
