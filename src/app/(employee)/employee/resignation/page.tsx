import { randomUUID } from 'node:crypto';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { CheckCircle2, Clock, FileText, Info, ShieldAlert } from 'lucide-react';
import {
  EmployeeSelfAccessError,
  requireEmployeeSelfContext,
} from '@/features/employee-self-service/context';
import { requestWorkspacePath } from '@/lib/tenant/server';
import { SeparationError } from '@/features/separation/domain';
import { getMyResignations } from '@/features/separation/ess-resignation-service';
import { resignationStatusLabel } from '@/features/separation/ess-resignation';
import { ResignationForm } from '@/features/separation/components/ResignationForm';
import { TenantLink } from '@/components/ui/TenantLink';

function ResignationStatusBadge({ status, acknowledged }: { status: string; acknowledged: boolean }) {
  const label = resignationStatusLabel(status, acknowledged);
  const map: Record<string, string> = {
    ACKNOWLEDGED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
    UNDER_REVIEW: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    PROCESSED: 'bg-blue-50 text-blue-700 border-blue-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const style = map[status] ?? 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${style}`}>
      {label}
    </span>
  );
}

export default async function ResignationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await connection();
  try {
    await requireEmployeeSelfContext();
  } catch (error) {
    if (error instanceof EmployeeSelfAccessError && error.code === 'FORBIDDEN') {
      redirect(await requestWorkspacePath('/dashboard'));
    }
    redirect(await requestWorkspacePath('/login?access=unavailable'));
  }

  const query = await searchParams;
  const page = Math.max(1, Math.min(100000, Math.floor(Number(query.page) || 1)));
  const data = await getMyResignations({ page }).catch(async (error) => {
    if (error instanceof SeparationError && error.code === 'FORBIDDEN') {
      redirect(await requestWorkspacePath('/login?access=unavailable'));
    }
    throw error;
  });

  const policy = data.policy;
  const formatNoticePeriod = (value: typeof policy) =>
    value.noticeCalendarMonths !== null
      ? `${value.noticeCalendarMonths} calendar month(s)`
      : value.noticeCalendarDays != null
        ? `${value.noticeCalendarDays} calendar day(s)`
        : 'Policy not yet configured';

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--tenant-accent)]">
          Employee Self-Service • Separation & Exit
        </p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
          My Resignation
        </h1>
        <p className="text-sm text-slate-500">
          Submit formal resignation notices and monitor HR review, clearance progress, and exit status.
        </p>
      </header>

      {/* Notice Policy Card */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tenant-tint)] text-[var(--tenant-primary)]">
            <Info className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Resignation Notice Policy
            </h2>
            <p className="text-xs text-slate-500">
              Required advance notice: <strong>{formatNoticePeriod(policy)}</strong> • Organization date: {data.today} ({data.timeZone})
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs sm:text-sm text-slate-600">
          {policy.noticeCalendarMonths === null && policy.noticeCalendarDays == null ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-amber-800">
              HR has not yet completed notice policy configuration. You can still record your notice; HR will resolve the policy requirements during case review.
            </p>
          ) : (
            <p>
              {policy.allowNoticeExceptions === false
                ? 'Standard organizational policy does not permit routine short-notice exceptions. Contact HR regarding any exceptional circumstances.'
                : 'Short notice is recorded for HR review; authorized exceptions require documented operational justification.'}
            </p>
          )}

          {policy.requireNoticeReviews && (
            <p>
              SAGA preserves its mandatory one-calendar-month notice policy and verified superior and HRMO review requirements.
            </p>
          )}

          <p className="text-xs text-slate-500">
            Submitting a notice records your intention and alerts HR in their queue. HR acknowledgment confirms receipt, but does not immediately close or terminate your account.
          </p>
        </div>
      </section>

      {/* Submit Notice Section */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <FileText className="h-4 w-4" />
          </span>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Submit a Resignation Notice
          </h2>
        </div>

        {data.hasActiveExit ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs sm:text-sm text-amber-900 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
            <div>
              <strong>Active Exit Case on Record:</strong> An active exit case is already recorded for your account. You can track your existing notice below. A duplicate active notice cannot be filed.
            </div>
          </div>
        ) : (
          <ResignationForm requestKey={randomUUID()} today={data.today} />
        )}
      </section>

      {/* Submitted Notices History */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <Clock className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Submitted Notices History</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {data.total} total notices
          </span>
        </div>

        {!data.items.length ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-2xs text-xs sm:text-sm text-slate-500">
            No resignation notices have been submitted through your account.
          </div>
        ) : (
          <div className="space-y-4">
            {data.items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-2xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <ResignationStatusBadge
                      status={item.status}
                      acknowledged={Boolean(item.acknowledgedAt)}
                    />
                    <span className="text-xs text-slate-400 font-mono">
                      Ref: {item.id.slice(0, 12)}…
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Submitted: {item.original.submittedAt}
                  </span>
                </div>

                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs sm:text-sm">
                  <div>
                    <dt className="text-slate-400 font-medium">Notice Date</dt>
                    <dd className="font-bold text-slate-900 mt-0.5">{item.original.noticeDate}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 font-medium">Notice Requirement</dt>
                    <dd className="font-bold text-slate-900 mt-0.5">
                      {formatNoticePeriod(item.original.policySnapshot)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 font-medium">Last Working Day</dt>
                    <dd className="font-bold text-slate-900 mt-0.5">
                      {item.original.proposedLastWorkingDay}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 font-medium">Separation Date</dt>
                    <dd className="font-bold text-slate-900 mt-0.5">
                      {item.original.proposedEffectiveDate}
                    </dd>
                  </div>
                </dl>

                {item.original.reason && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs text-slate-800">
                    <p className="font-semibold text-slate-500 mb-1">Stated Reason:</p>
                    <p className="whitespace-pre-wrap">{item.original.reason}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div>
                    {item.acknowledgedAt ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>HR acknowledged receipt on {item.acknowledgedAt}</span>
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        Receipt acknowledgment pending HR review
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Clearance:</span>
                    <strong className="text-slate-800">
                      {item.clearance.completed} of {item.clearance.required} completed
                    </strong>
                  </div>
                </div>

                {item.acknowledgmentRemarks && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs text-indigo-900">
                    <strong>HR Note:</strong> {item.acknowledgmentRemarks}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-slate-200/80 pt-4 text-xs">
            <span className="text-slate-500">
              Showing page {data.page} of {Math.ceil(data.total / data.pageSize)}
            </span>
            <div className="flex gap-2">
              {data.page > 1 && (
                <TenantLink
                  href={`/employee/resignation?page=${data.page - 1}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Previous
                </TenantLink>
              )}
              {data.page * data.pageSize < data.total && (
                <TenantLink
                  href={`/employee/resignation?page=${data.page + 1}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Next
                </TenantLink>
              )}
            </div>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-400">
        All submitted notices are securely preserved in your organization&apos;s audit trail. For withdrawal or date amendments, please consult your HR officer.
      </p>
    </div>
  );
}
