import { randomUUID } from 'node:crypto';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { EmployeeSelfAccessError, requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { requestWorkspacePath } from '@/lib/tenant/server';
import { SeparationError } from '@/features/separation/domain';
import { getMyResignations } from '@/features/separation/ess-resignation-service';
import { resignationStatusLabel } from '@/features/separation/ess-resignation';
import { ResignationForm } from '@/features/separation/components/ResignationForm';
import { TenantLink } from '@/components/ui/TenantLink';

export default async function ResignationPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await connection();
  try { await requireEmployeeSelfContext(); } catch (error) {
    if (error instanceof EmployeeSelfAccessError && error.code === 'FORBIDDEN') redirect(await requestWorkspacePath('/dashboard'));
    redirect(await requestWorkspacePath('/login?access=unavailable'));
  }
  const query = await searchParams;
  const page = Math.max(1, Math.min(100000, Math.floor(Number(query.page) || 1)));
  const data = await getMyResignations({ page }).catch(async error => {
    if (error instanceof SeparationError && error.code === 'FORBIDDEN') redirect(await requestWorkspacePath('/login?access=unavailable'));
    throw error;
  });
  const policy = data.policy;
  const period = (value: typeof policy) => value.noticeCalendarMonths !== null ? `${value.noticeCalendarMonths} calendar month(s)` : value.noticeCalendarDays != null ? `${value.noticeCalendarDays} calendar day(s)` : 'Policy not yet configured';
  return <div className="max-w-3xl space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee self-service</p><h1 className="mt-1 text-2xl font-black">My resignation</h1><p className="mt-2 text-sm text-slate-600">Submit a notice and track HR processing in your organization.</p></header>
    <section className="space-y-3 rounded-3xl border bg-white p-5 sm:p-6"><h2 className="font-bold">Resignation notice policy</h2>
      <p className="text-sm">Required notice: <strong>{period(policy)}</strong>. Organization date: {data.today} ({data.timeZone}).</p>
      {policy.noticeCalendarMonths === null && policy.noticeCalendarDays == null ? <p className="text-sm text-amber-900">HR has not configured a notice policy. You can still record your notice; HR must resolve policy setup during processing.</p> : <p className="text-sm text-slate-600">{policy.allowNoticeExceptions === false ? 'The recorded policy does not permit routine short-notice exceptions. Contact HR about any unresolved notice circumstances.' : 'Short notice is recorded for HR review; any authorized exception requires documented justification.'}</p>}
      {policy.requireNoticeReviews && <p className="text-sm text-slate-600">SAGA retains its one-calendar-month notice rule and verified superior and HRMO review requirements. This submission does not fabricate either review.</p>}
      <p className="text-sm text-slate-600">Submitting records your notice and notifies HR in Requires Attention. HR acknowledgment confirms receipt; it is not an acceptance or rejection decision. Submission does not disable your account, execute separation or calculate final pay.</p>
    </section>
    <section className="rounded-3xl border bg-white p-5 sm:p-6"><h2 className="mb-4 font-bold">Submit a resignation notice</h2>
      {data.hasActiveExit ? <p role="status" className="text-sm text-slate-600">An active exit case is already recorded. Track your submitted notice below, or contact HR if your existing case was opened by HR. A second active notice cannot be submitted.</p> : <ResignationForm requestKey={randomUUID()} today={data.today} />}
    </section>
    <section className="space-y-4"><h2 className="font-bold">My submitted notices</h2>
      {!data.items.length && <p className="rounded-3xl border bg-white p-5 text-sm text-slate-600">No resignation notices have been submitted through your account.</p>}
      {data.items.map(item => <article key={item.id} className="space-y-3 rounded-3xl border bg-white p-5 sm:p-6">
        <h3 className="font-bold">{resignationStatusLabel(item.status, Boolean(item.acknowledgedAt))}</h3>
        <p className="break-all text-xs text-slate-500">Reference {item.id} · Submitted {item.original.submittedAt}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Notice date</dt><dd>{item.original.noticeDate}</dd></div><div><dt className="text-slate-500">Notice requirement when submitted</dt><dd>{period(item.original.policySnapshot)}</dd></div><div><dt className="text-slate-500">Proposed last working day</dt><dd>{item.original.proposedLastWorkingDay}</dd></div><div><dt className="text-slate-500">Effective separation date</dt><dd>{item.original.proposedEffectiveDate}</dd></div></dl>
        <p className="whitespace-pre-wrap text-sm">{item.original.reason}</p>
        <p className="text-sm text-slate-600">{item.acknowledgedAt ? `HR recorded receipt on ${item.acknowledgedAt}.` : 'Receipt acknowledgment has not been recorded.'}</p>
        {item.acknowledgmentRemarks && <p className="whitespace-pre-wrap text-sm">HR message: {item.acknowledgmentRemarks}</p>}
        <p className="text-sm text-slate-600">Notice review: {item.noticeCompliance.replaceAll('_', ' ').toLowerCase()}. Required clearance progress: {item.clearance.completed} of {item.clearance.required}.</p>
        {item.status === 'CANCELLED' && <p className="text-sm text-slate-600">HR recorded a documented employee withdrawal. Your original notice remains in the case history.</p>}
      </article>)}
      <div className="flex flex-wrap gap-4 text-sm"><span>{data.total} notices · Page {data.page}</span>{data.page > 1 && <TenantLink className="underline" href={`/employee/resignation?page=${data.page - 1}`}>Previous</TenantLink>}{data.page * data.pageSize < data.total && <TenantLink className="underline" href={`/employee/resignation?page=${data.page + 1}`}>Next</TenantLink>}</div>
    </section>
    <p className="text-sm text-slate-600">Your submitted notice is preserved. Contact HR about corrections or withdrawal. Access changes only through the existing separation process; final pay remains with HR on the same Exit case. Contact HR for records after ESS access ends.</p>
  </div>;
}
