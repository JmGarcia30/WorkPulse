import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { EmploymentCategory, EmployeeStatus, ProbationStatus } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import { canManageEmploymentLifecycle, canViewEmployees } from '@/lib/permissions/rbac';
import { getOrganizationEmployeeById } from '@/features/employees/queries';
import { deriveProbationReviewState } from '@/features/employees/domain';
import { EmploymentLifecycleActions } from '@/components/employees/EmploymentLifecycleActions';
import { ArrowLeft, Briefcase, FileCheck2, History, ShieldCheck, UserRound } from 'lucide-react';

interface EmployeeProfilePageProps { params: Promise<{ employeeId: string }> }
const date = (value: Date | null | undefined) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', dateStyle: 'medium' }).format(value) : '—';
const dateInput = (value: Date | null | undefined) => value ? value.toISOString().slice(0, 10) : '';
const label = (value: string) => value.replaceAll('_', ' ');

export default async function EmployeeProfilePage({ params }: EmployeeProfilePageProps) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!canViewEmployees(user)) redirect('/dashboard');

  const { employeeId } = await params;
  const employee = await getOrganizationEmployeeById(user.organizationId, employeeId);
  if (!employee) notFound();
  const now = new Date();
  const employment = employee.employmentRecords.find((record) => record.effectiveFrom <= now && (record.effectiveTo === null || record.effectiveTo > now));
  const shown = employment ?? employee.employmentRecords[0];
  if (!shown) notFound();
  const probation = employment?.probation ?? null;
  const review = probation ? deriveProbationReviewState({ probationStatus: probation.probationStatus, expectedEndAt: probation.expectedEndAt, asOf: now }) : null;
  const offer = employee.employmentRecords.find((record) => record.acceptedOffer)?.acceptedOffer;
  const onboarding = employee.sourceApplication.onboarding;
  const requiredTasks = onboarding?.tasks.filter((task) => task.isRequired) ?? [];
  const satisfiedTasks = requiredTasks.filter((task) => task.status === 'VERIFIED' || task.status === 'WAIVED');
  const decisionAllowed = canManageEmploymentLifecycle(user) && employee.employeeStatus === EmployeeStatus.ACTIVE && probation?.probationStatus === ProbationStatus.ACTIVE && review?.decisionAllowed === true;
  const regularizationAllowed = decisionAllowed && shown.employmentCategory === EmploymentCategory.NON_TEACHING;
  const renewalAllowed = decisionAllowed && shown.employmentCategory === EmploymentCategory.TEACHING && probation !== null && probation.renewalCount < probation.maxRenewals;
  const notRenewalAllowed = decisionAllowed;
  let blockedReason: string | null = null;
  if (!canManageEmploymentLifecycle(user)) blockedReason = 'Your role cannot record employment lifecycle decisions.';
  else if (employee.employeeStatus !== EmployeeStatus.ACTIVE) blockedReason = 'This employee has no active employment relationship.';
  else if (!probation || probation.probationStatus !== ProbationStatus.ACTIVE) blockedReason = 'There is no active probation period awaiting a decision.';
  else if (!review?.decisionAllowed) blockedReason = `Final actions become available on ${date(probation.expectedEndAt)}. Current state: ${label(review?.state ?? 'ACTIVE')}.`;
  else if (shown.employmentCategory === EmploymentCategory.TEACHING && probation.renewalCount >= probation.maxRenewals) blockedReason = 'The maximum Teaching renewals have been reached. H2 defines no Faculty regularization action.';

  return <div className="space-y-6">
    <Link href="/dashboard/employees" className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Employee Directory</Link>
    <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs"><div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#181A1C] text-lg font-black text-white">{employee.firstName[0]}{employee.lastName[0]}</div><div><h1 className="text-xl font-bold">{employee.firstName} {employee.lastName}</h1><p className="text-xs text-slate-500">{employee.email} · {employee.phone}</p></div></div>
      <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Employee Number</p><p className="text-lg font-black">{employee.employeeNumber}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">{employee.employeeStatus}</span>{employee.employeeStatus === EmployeeStatus.INACTIVE && <p className="mt-2 max-w-xs text-[10px] text-slate-500">No active employment relationship. This does not indicate completed Exit, clearance, or formal separation.</p>}</div>
    </div></div>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Briefcase className="h-4 w-4" /> Employment Overview</h2>{!employment && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">No employment relationship is active today; showing the latest historical record.</p>}<dl className="grid grid-cols-2 gap-4 text-xs">
        <div><dt className="text-slate-500">Position</dt><dd className="font-bold">{shown.jobTitle}</dd></div><div><dt className="text-slate-500">Department</dt><dd className="font-bold">{shown.department}</dd></div><div><dt className="text-slate-500">Category</dt><dd className="font-bold">{label(shown.employmentCategory)}</dd></div><div><dt className="text-slate-500">Classification</dt><dd className="font-bold">{shown.employmentStatus}</dd></div><div><dt className="text-slate-500">Employment type</dt><dd className="font-bold">{shown.employmentType}</dd></div><div><dt className="text-slate-500">Pay terms</dt><dd className="font-bold">{shown.payFrequency} · {shown.salary.toFixed(2)}</dd></div><div><dt className="text-slate-500">Effective from</dt><dd className="font-bold">{date(shown.effectiveFrom)}</dd></div><div><dt className="text-slate-500">Effective to</dt><dd className="font-bold">{date(shown.effectiveTo)}</dd></div>
      </dl></section>

      <section className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4" /> Current Probation</h2>{probation && review ? <dl className="grid grid-cols-2 gap-4 text-xs">
        <div><dt className="text-slate-500">Review state</dt><dd className="font-bold">{label(review.state)}</dd></div><div><dt className="text-slate-500">Decision</dt><dd className="font-bold">{probation.decision}</dd></div><div><dt className="text-slate-500">Started</dt><dd className="font-bold">{date(probation.startedAt)}</dd></div><div><dt className="text-slate-500">Expected end</dt><dd className="font-bold">{date(probation.expectedEndAt)}</dd></div><div><dt className="text-slate-500">Time to review</dt><dd className="font-bold">{review.daysRemaining < 0 ? `${Math.abs(review.daysRemaining)} days overdue` : `${review.daysRemaining} days remaining`}</dd></div><div><dt className="text-slate-500">Renewals</dt><dd className="font-bold">{probation.renewalCount} of {probation.maxRenewals}</dd></div><div className="col-span-2"><dt className="text-slate-500">HR attention</dt><dd className="font-bold">{review.needsAttention ? 'Required' : 'Not currently required'}</dd></div>
      </dl> : <p className="text-xs text-slate-500">No active probation period applies today.</p>}</section>

      <section className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs lg:col-span-2"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" /> Probation Timeline</h2><div className="space-y-3">{employee.probationRecords.map((record) => <div key={record.id} className="grid gap-2 rounded-2xl border border-slate-100 p-4 text-xs sm:grid-cols-6"><div><p className="text-slate-500">Period</p><p className="font-bold">{date(record.startedAt)} – {date(record.expectedEndAt)}</p></div><div><p className="text-slate-500">Category</p><p className="font-bold">{label(record.category)}</p></div><div><p className="text-slate-500">Status</p><p className="font-bold">{record.probationStatus}</p></div><div><p className="text-slate-500">Decision</p><p className="font-bold">{record.decision}</p></div><div><p className="text-slate-500">Decision recorded</p><p className="font-bold">{date(record.decisionAt)}</p></div><div><p className="text-slate-500">Actor</p><p className="font-bold">{record.decisionBy?.name ?? '—'}</p></div>{record.remarks && <p className="sm:col-span-6 text-slate-600">{record.remarks}</p>}</div>)}</div></section>

      <section className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs lg:col-span-2"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Briefcase className="h-4 w-4" /> Employment History</h2><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-3">Effective period</th><th className="pb-3">Position</th><th className="pb-3">Department</th><th className="pb-3">Classification</th></tr></thead><tbody className="divide-y divide-slate-100">{employee.employmentRecords.map((record) => <tr key={record.id}><td className="py-3">{date(record.effectiveFrom)} – {date(record.effectiveTo)}</td><td>{record.jobTitle}</td><td>{record.department}</td><td className="font-bold">{record.employmentStatus}</td></tr>)}</tbody></table></div></section>

      <EmploymentLifecycleActions employeeId={employee.id} employeeName={`${employee.firstName} ${employee.lastName}`} category={shown.employmentCategory} regularizationAllowed={regularizationAllowed} renewalAllowed={renewalAllowed} notRenewalAllowed={notRenewalAllowed} blockedReason={blockedReason} defaultEffectiveDate={dateInput(probation?.expectedEndAt)} />

      <section className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><FileCheck2 className="h-4 w-4" /> Contract & Compliance</h2><dl className="grid grid-cols-2 gap-4 text-xs"><div><dt className="text-slate-500">Accepted offer</dt><dd className="font-bold">{offer?.status ?? '—'}</dd></div><div><dt className="text-slate-500">Contract executed</dt><dd className="font-bold">{date(offer?.contractExecutedAt)}</dd></div><div><dt className="text-slate-500">President signed</dt><dd className="font-bold">{offer?.contractSignedByPresident ? 'Yes' : 'No'}</dd></div><div><dt className="text-slate-500">Employee signed</dt><dd className="font-bold">{offer?.contractSignedByEmployee ? 'Yes' : 'No'}</dd></div><div><dt className="text-slate-500">Onboarding</dt><dd className="font-bold">{onboarding?.status ?? '—'}</dd></div><div><dt className="text-slate-500">Required items</dt><dd className="font-bold">{satisfiedTasks.length} / {requiredTasks.length} satisfied</dd></div></dl></section>

      <section className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs lg:col-span-2"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" /> Decision Audit</h2>{employee.employmentDecisions.length === 0 ? <p className="text-xs text-slate-500">No H2 employment decisions recorded.</p> : <div className="space-y-2">{employee.employmentDecisions.map((event) => <div key={event.id} className="rounded-xl bg-slate-50 p-3 text-xs"><p className="font-bold">{label(event.decision)}</p><p className="text-slate-600">Recorded {date(event.decisionAt)} by {event.changedBy.name}; effective {date(event.effectiveAt)}</p></div>)}</div>}</section>

      <section className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs lg:col-span-2"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><UserRound className="h-4 w-4" /> Hiring Traceability</h2><Link href={`/dashboard/hiring/applicants/${employee.sourceApplicationId}`} className="inline-flex rounded-xl bg-[#181A1C] px-4 py-2.5 text-xs font-bold text-white">View Hiring Record</Link></section>
    </div>
  </div>;
}
