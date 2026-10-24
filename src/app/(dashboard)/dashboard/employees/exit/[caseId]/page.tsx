import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { ClearanceStatus } from '@prisma/client';
import { getSeparationCaseById, getFinalPayReadiness } from '@/features/separation/service';
import { SeparationError } from '@/features/separation/domain';
import { parsePolicySnapshot } from '@/features/separation/policy';
import { PolicyGuidance } from '@/features/separation/components/PolicyGuidance';
import { FinalPayPanel } from '@/features/separation/components/FinalPayPanel';
import { ActionForm } from '@/features/separation/components/ActionForm';
import { CaseFields, Field, fieldClass, label } from '@/features/separation/components/Fields';
import { TenantLink } from '@/components/ui/TenantLink';
import { WorkspacePanel } from '@/components/ui/Workspace';

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const found = await getSeparationCaseById(caseId).catch(error => {
    if (error instanceof SeparationError && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')) notFound();
    throw error;
  });
  const financial = await getFinalPayReadiness(caseId);
  const editable = found.status === 'DRAFT' || found.status === 'IN_PROGRESS';
  const active = !['COMPLETED', 'CANCELLED'].includes(found.status);
  const version = { caseId: found.id, version: found.version };
  const policy = parsePolicySnapshot(found.policySnapshot);
  const resignation = found.separationType === 'RESIGNATION';
  const employeeNotice = found.submissionSource === 'ESS';
  const reviews = resignation && policy.requireNoticeReviews ? ['NOTICE_SUPERIOR', 'NOTICE_HRMO'] : found.separationType === 'TERMINATION' ? ['TERMINATION_ADMIN_REVIEW', 'TERMINATION_DOCUMENTATION', 'TERMINATION_DUE_PROCESS'] : [];
  const details = { ...found, noticeDate: found.noticeDate?.slice(0, 10), proposedLastWorkingDay: found.proposedLastWorkingDay?.slice(0, 10), proposedEffectiveDate: found.proposedEffectiveDate?.slice(0, 10) };
  return <>
    <TenantLink href="/dashboard/employees/exit" className="text-sm underline">Back to Exit Management</TenantLink>
    <div><h1 className="text-2xl font-semibold">{found.employee.lastName}, {found.employee.firstName}</h1><p className="text-sm text-slate-600">{found.employee.employeeNumber} · {label(found.employee.employeeStatus)} · {label(found.status)}</p></div>
    {employeeNotice && <WorkspacePanel title="Employee-submitted resignation notice" description="The notice is already recorded. HR acknowledgment records receipt only; administrative review is not acceptance or rejection of the employee’s notice.">
      <p className="text-sm">{found.acknowledgedAt ? `Receipt recorded on ${found.acknowledgedAt} by ${found.acknowledgedById}.` : 'Receipt acknowledgment has not been recorded.'}</p>
      {found.acknowledgmentRemarks && <p className="mt-2 whitespace-pre-wrap text-sm">Message to employee: {found.acknowledgmentRemarks}</p>}
      {!found.acknowledgedAt && ['DRAFT', 'IN_PROGRESS', 'READY_FOR_FINAL_REVIEW'].includes(found.status) && <div className="mt-4"><ActionForm operation="acknowledge" {...version} label="Acknowledge receipt"><Field name="remarks" title="Receipt message (visible to employee)" required /></ActionForm></div>}
      <p className="mt-3 text-sm">Process this case using the existing clearance, documentary reviews and administrative execution steps below. Acknowledgment does not clear notice requirements, disable ESS or calculate final pay.</p>
      <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Preserved original notice</summary><pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(found.employeeNoticeSnapshot, null, 2)}</pre></details>
    </WorkspacePanel>}
    <WorkspacePanel title="Case information" description={`Case ${found.id} · Version ${found.version}`}>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">{[
        ['Separation type', label(found.separationType)], ['Reason', found.reason], ['Last working day', details.proposedLastWorkingDay], ['Effective separation date', details.proposedEffectiveDate],
        ['Administrative remarks', found.administrativeRemarks], ['Initiated', `${found.initiatedAt} · ${found.initiatedById}`],
        ['Approval', found.approvedAt ? `${found.approvedAt} · ${found.approvedById} · ${found.approvalRemarks}` : 'Pending'],
        ['Completion', found.completedAt ? `${found.completedAt} · ${found.completedById} · ${found.executionRemarks}` : 'Pending'],
        ['Cancellation', found.cancelledAt ? `${found.cancelledAt} · ${found.cancellationReason}` : null],
      ].map(([title, value]) => <div key={title}><dt className="font-medium">{title}</dt><dd className="whitespace-pre-wrap break-words text-slate-600">{value ?? '—'}</dd></div>)}</dl>
      <h3 className="mt-5 font-semibold">Employment history</h3><p className="text-xs text-slate-600">Latest 10 records; end dates are exclusive.</p>
      {found.employment.map(record => <p key={record.id} className="mt-2 text-sm">{record.jobTitle} · {record.department} · {record.effectiveFrom.slice(0, 10)} to {record.effectiveTo?.slice(0, 10) ?? 'Open'}</p>)}
      {editable && <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold">Edit case / start processing</summary><div className="mt-3"><p className="mb-3 text-sm text-slate-600">Saving starts processing and requires renewed notice exceptions and reviews for the updated case details.{employeeNotice && ' Submitted reason and dates are preserved. Record administrative remarks without rewriting the notice.'}</p><ActionForm operation="update" {...version} label="Save and set in progress"><CaseFields details={details} employeeNotice={employeeNotice} /></ActionForm></div></details>}
    </WorkspacePanel>
    <WorkspacePanel title="Notice and verified reviews" description="Record only verified documentary evidence. These records are not electronic signatures by a superior or HRMO.">
      {resignation && policy.noticeCalendarMonths === null && policy.noticeCalendarDays == null && <PolicyGuidance existingCase={editable} />}
      {resignation && (policy.noticeCalendarMonths !== null || policy.noticeCalendarDays != null) && <p className="mb-3 text-sm">Recorded policy: {policy.noticeCalendarMonths ?? policy.noticeCalendarDays} {policy.noticeCalendarMonths !== null ? 'calendar month(s)' : 'calendar day(s)'}. Authorized short-notice exceptions {policy.allowNoticeExceptions === false ? 'are not allowed' : 'require a recorded justification'}.</p>}
      <p className="text-sm">Notice: {details.noticeDate ?? 'Not recorded'} · {label(found.noticeCompliance)}</p>
      {found.noticeRemarks && <p className="mt-2 text-sm">{found.noticeRemarks}</p>}
      {found.noticeExceptionReason && <p className="mt-2 text-sm">Exception: {found.noticeExceptionReason} · {found.noticeExceptionById} · {found.noticeExceptionAt}</p>}
      {editable && found.noticeCompliance === 'EXCEPTION_REQUIRED' && policy.allowNoticeExceptions !== false && <div className="mt-4"><ActionForm operation="exception" {...version} label="Record authorized notice exception"><Field name="reason" title="Exception justification" required /></ActionForm></div>}
      <ul className="my-4 space-y-2 text-sm">{found.reviews.map(review => <li key={review.id} className="rounded-md border p-3"><strong>{label(review.kind)}</strong> · {review.caseVersion === found.versionOfDetails ? 'Current details' : 'Previous details'}<p className="whitespace-pre-wrap">{review.evidence}</p><p className="text-slate-600">Recorded by {review.recordedById} · {review.recordedAt}</p></li>)}</ul>
      {editable && reviews.length > 0 && <ActionForm operation="review" {...version} label="Record verified review">
        <label className="block text-sm">Review kind<select name="kind" className={fieldClass}>{reviews.map(kind => <option value={kind} key={kind}>{label(kind)}</option>)}</select></label>
        <Field name="evidence" title="Actual verified review / supporting document reference" required />
        <label className="block text-sm"><input type="checkbox" name="verified" required /> I verified this review evidence.</label>
      </ActionForm>}
    </WorkspacePanel>
    <WorkspacePanel title="Clearance checklist" description={`${found.clearanceProgress.completed} of ${found.clearanceProgress.required} required items completed. No item is cleared automatically.`}>
      <div className="space-y-4">{found.clearanceItems.map(item => <section key={item.id} className="rounded-md border border-slate-200 p-4">
        <h3 className="font-semibold">{item.title} · {label(item.status)}</h3><p className="text-sm text-slate-600">{item.category} · {item.isRequired ? 'Required' : 'Optional'} · {item.responsibleUnit ?? 'Responsible unit not assigned'}</p>
        {item.description && <p className="mt-2 text-sm">{item.description}</p>}{item.remarks && <p className="mt-2 text-sm">{item.remarks}</p>}
        {item.reviewedAt && <p className="mt-2 text-xs text-slate-600">Reviewed by {item.reviewedById} · {item.reviewedAt}</p>}
        {editable && <div className="mt-3"><ActionForm operation="clearance" {...version} label="Record clearance decision"><input type="hidden" name="itemId" value={item.id} />
          <label className="block text-sm">Decision<select className={fieldClass} name="status" defaultValue={item.status}>{Object.values(ClearanceStatus).map(status => <option key={status}>{status}</option>)}</select></label>
          <Field name="remarks" title="Remarks (reason required for blocked or waived)" />
          <label className="block text-sm"><input type="checkbox" name="verified" /> I verified this decision and am authorized to record it.</label>
        </ActionForm></div>}
      </section>)}</div>
      {editable && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Add clearance requirement</summary><div className="mt-3"><ActionForm operation="addItem" {...version} label="Add pending requirement">
        <input type="hidden" name="requestKey" value={randomUUID()} /><Field name="category" title="Category code (uppercase letters / underscores)" required /><Field name="title" title="Title" required /><Field name="description" title="Description" /><Field name="responsibleUnit" title="Responsible unit" /><label className="block text-sm"><input type="checkbox" name="isRequired" defaultChecked /> Required</label>
      </ActionForm></div></details>}
    </WorkspacePanel>
    <WorkspacePanel title="Readiness and final actions">
      {active && (found.readiness.ready ? <p className="mb-4 text-sm text-green-800">Backend readiness requirements are satisfied.</p> : <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">{found.readiness.blockers.map(blocker => <li key={blocker}>{blocker.startsWith('CLEARANCE_UNRESOLVED:') ? `Clearance unresolved: ${found.clearanceItems.find(item => item.id === blocker.split(':')[1])?.title ?? 'Required item'}` : label(blocker)}</li>)}</ul>)}
      {editable && <ActionForm operation="ready" {...version} label="Mark ready for final review" />}
      {found.status === 'READY_FOR_FINAL_REVIEW' && <ActionForm operation="approve" {...version} label={employeeNotice ? 'Confirm administrative readiness' : 'Approve separation'}>
        <Field name="remarks" title="Mandatory approval decision remarks" required /><Field name="backdatedJustification" title="Backdated effective-date justification (if applicable)" /><Field name="inactiveEmployeeJustification" title="Inactive employee separation authorization (if applicable)" />
        <label className="block text-sm"><input type="checkbox" name="confirmed" required /> {employeeNotice ? 'I confirm the administrative checks for separation processing; this does not grant or deny permission to resign.' : 'I approve this separation after reviewing clearance and supporting evidence.'}</label>
      </ActionForm>}
      {found.status === 'APPROVED_PENDING_EFFECTIVE' && <ActionForm operation="execute" {...version} label="Execute final separation">
        <p className="text-sm">Execution is allowed on or after {details.proposedEffectiveDate}, using the organization timezone. This closes employment and disables ESS access atomically.</p>
        <Field name="remarks" title="Mandatory execution remarks" required /><Field name="backdatedJustification" title="Late / backdated execution justification (if applicable)" />
        <label className="block text-sm font-semibold"><input type="checkbox" name="confirmed" required /> Confirm final separation: set this employee to SEPARATED, close employment, and terminate ESS access.</label>
      </ActionForm>}
      {active && <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold">{employeeNotice ? 'Record documented employee withdrawal' : 'Cancel case'}</summary><div className="mt-3"><ActionForm operation="cancel" {...version} label={employeeNotice ? 'Record employee withdrawal' : 'Cancel separation case'}><Field name="reason" title="Cancellation justification" required />{employeeNotice && <><Field name="employeeWithdrawalEvidence" title="Verified employee withdrawal reference" required /><label className="block text-sm"><input type="checkbox" name="employeeWithdrawalConfirmed" required /> I verified the employee’s withdrawal request. This is not an HR rejection of the notice.</label></>}</ActionForm></div></details>}
    </WorkspacePanel>
    <FinalPayPanel caseId={found.id} caseStatus={found.status} />
    <WorkspacePanel title="Financial follow-up" description="Existing payroll, leave and clearance follow-up; final-pay settlement is reviewed separately above.">
      <p className="text-sm font-semibold">{label(financial.status)}</p><p className="mt-2 text-sm">Financial follow-up does not add separation blockers.</p>
      <ul className="mt-3 space-y-1 text-sm"><li>Outstanding accountabilities: {financial.outstandingAccountabilities.length}</li><li>Unresolved payroll entries: {financial.unresolvedPayrollEntries.length}</li><li>Finalized payroll overlaps to review: {financial.finalizedPayrollOverlaps.length}</li><li>Payroll periods requiring review: {financial.payrollPeriodsRequiringReview.length}</li><li>Leave records requiring review: {financial.leaveRecordsRequiringReview.length}</li></ul>
      {financial.outstandingAccountabilities.map(item => <p key={item.id} className="mt-2 text-sm">{item.title}: {label(item.status)}{item.remarks ? ` · ${item.remarks}` : ''}</p>)}
      {financial.leaveRecordsRequiringReview.map(item => <p key={item.id} className="mt-2 text-sm">Leave {item.from} to {item.to}: {label(item.status)}</p>)}
    </WorkspacePanel>
    <WorkspacePanel title="Immutable audit history"><ol className="space-y-3 text-sm">{found.history.map(event => <li key={event.id} className="rounded-md border p-3"><strong>{label(event.action)}</strong> · {event.createdAt}<p className="text-slate-600">Actor: {event.actorUserId}</p>{event.remarks && <p className="whitespace-pre-wrap">{event.remarks}</p>}<details className="mt-2"><summary className="cursor-pointer">Recorded changes</summary><pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ previous: event.previousValues, next: event.newValues }, null, 2)}</pre></details></li>)}</ol></WorkspacePanel>
  </>;
}
