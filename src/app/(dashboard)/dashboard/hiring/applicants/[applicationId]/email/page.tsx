import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { requestWorkspacePath } from '@/lib/tenant/server';
import { requireEmailAdministrator } from '@/features/email-integration/authorization';
import { hrWorkflowHistory } from '@/features/hiring/hr-email-workflows';
import { HrEmailWorkflow } from '@/components/hiring/HrEmailWorkflow';

export default async function ApplicantEmailPage({ params }: { params: Promise<{ applicationId: string }> }) {
  let actor; try { actor = await requireEmailAdministrator(); } catch { notFound(); }
  const { applicationId } = await params;
  const application = await prisma.application.findFirst({ where: { id: applicationId, job: { organizationId: actor.organizationId } }, select: { applicant: { select: { firstName: true, lastName: true } }, job: { select: { title: true } }, interviews: { where: { status: 'SCHEDULED' }, select: { id: true, scheduledAt: true, type: true }, orderBy: { scheduledAt: 'desc' } } } });
  if (!application) notFound();
  const history = await hrWorkflowHistory(actor, applicationId);
  return <div className="max-w-4xl space-y-5"><header className="space-y-2"><p className="wp-eyebrow">Recruitment and onboarding</p><h1 className="wp-page-title">HR email</h1><p className="text-sm">{application.applicant.firstName} {application.applicant.lastName} · {application.job.title}</p><Link className="text-sm underline" href={await requestWorkspacePath(`/dashboard/hiring/applicants/${applicationId}`)}>Back to applicant</Link></header>
    <HrEmailWorkflow applicationId={applicationId} interviews={application.interviews.map(interview => ({ id: interview.id, label: `${interview.type.replaceAll('_', ' ')} · ${interview.scheduledAt.toISOString()}` }))} />
    <section className="wp-card space-y-3 p-5"><h2 className="font-semibold">Email delivery history</h2><p className="text-xs text-[var(--wp-text-muted)]">Submitted means the provider accepted the message, not confirmed inbox delivery. SENDING or UNKNOWN may mean it was sent; repeat sending is blocked. Failed attempts require a fresh preview and confirmation.</p>{history.length ? <ul className="space-y-3">{history.map(row => <li key={row.id} className="space-y-1 border-t pt-3 text-sm"><p className="break-words font-semibold">{row.type} → {row.recipient}</p><p>{row.status} · {row.attemptCount} attempt(s){row.lastAttemptAt ? ' · ' + row.lastAttemptAt.toISOString() : ''}{row.errorCode ? ' · ' + row.errorCode : ''}</p></li>)}</ul> : <p className="text-sm">No emails prepared or sent through this workflow yet.</p>}</section>
  </div>;
}
