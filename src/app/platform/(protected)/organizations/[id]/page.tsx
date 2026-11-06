import Link from 'next/link';
import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { ArrowLeft, Building2, CalendarDays, LockKeyhole, ShieldCheck } from 'lucide-react';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { organizationMetadata } from '@/features/platform-admin/service';
import { prisma } from '@/lib/db/prisma';
import { OrganizationInvitationControls } from '@/features/platform-admin/onboarding-forms';
import { OrganizationManagementForms } from '@/features/platform-admin/organization-management-forms';

export default async function PlatformOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdministrator();
  const { id } = await params;
  const org = await prisma.organization.findUnique({ where: { id }, select: organizationMetadata });
  if (!org) notFound();
  const [onboarding, contact, audits, registration] = await Promise.all([
    prisma.organizationAdministratorInvitation.findUnique({ where: { organizationId: id }, select: { email: true, status: true, deliveryStatus: true, expiresAt: true, lastIssuedAt: true, activatedAt: true, revokedAt: true } }),
    prisma.organization.findUnique({ where: { id }, select: { contactEmail: true } }),
    prisma.platformOrganizationAudit.findMany({ where: { organizationId: id }, select: { id: true, action: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10 }),
    prisma.companyRegistration.findUnique({ where: { organizationId: id }, select: { email: true, verifiedAt: true } }),
  ]);
  return <div className="platform-section-gap">
    <Link href="/platform/organizations" className="platform-page-back"><ArrowLeft size={14} aria-hidden="true"/> Back to organizations</Link>
    <div className="platform-page-heading">
      <div><p className="platform-eyebrow">Organization Management</p><h1 className="platform-title">{org.name}</h1><p className="platform-description">Manage workspace details and recruitment access. Employee data stays private to HR.</p></div>
      <span className={'platform-status ' + (org.careersEnabled ? 'platform-status-on' : 'platform-status-off')}>{org.careersEnabled ? 'Careers enabled' : 'Careers disabled'}</span>
    </div>
    <section className="platform-card">
      <div className="platform-card-header"><div><h2 className="platform-card-title">Workspace information</h2><p className="platform-card-description">General metadata for this organization</p></div><Building2 size={19} color="#167d77"/></div>
      <dl className="grid gap-5 border-t border-[#f0f1ef] px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Workspace address',org.slug === 'st-aloysius' ? '/saga' : '/w/' + org.slug],
          ['Time zone',org.timeZone],
          ['Career portal',org.careersEnabled ? 'Enabled' : 'Disabled'],
          ['Registered',org.createdAt.toISOString().slice(0,10)],
        ].map(([label,value]) => <div key={label}><dt className="text-[11px] font-semibold text-[#71818e]">{label}</dt><dd className="mt-2 break-all text-sm font-semibold">{value}</dd></div>)}
      </dl>
    </section>
    <div className="platform-card">
      <div className="platform-card-header"><div><h2 className="platform-card-title">Organization settings</h2><p className="platform-card-description">Edit verified platform metadata or control the public career portal</p></div></div>
      <div className="px-5 pb-5"><OrganizationManagementForms organization={{ id: org.id, name: org.name, contactEmail: contact?.contactEmail ?? null, timeZone: org.timeZone, careersEnabled: org.careersEnabled }}/></div>
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
      <section className="platform-card">
        <div className="platform-card-header"><div><h2 className="platform-card-title">HR administrator onboarding</h2><p className="platform-card-description">Initial invitation and registration status</p></div><ShieldCheck size={19} color="#167d77"/></div>
        <div className="space-y-4 px-6 pb-6 text-sm">
          {onboarding ? <>
            <div><p className="text-xs font-semibold text-[#71818e]">Initial HR administrator</p><p className="mt-1 break-all font-semibold">{onboarding.email}</p></div>
            <div className="flex flex-wrap gap-3"><span className="platform-status platform-status-on">{onboarding.status === 'PENDING' && onboarding.expiresAt <= new Date() ? 'Invitation expired' : onboarding.status}</span><span className="text-xs text-[#70808c]">Delivery: {onboarding.deliveryStatus}</span></div>
            <p className="text-xs text-[#687783]">{onboarding.activatedAt ? 'Activated on ' + onboarding.activatedAt.toISOString().slice(0, 10) : 'Email ownership pending verification'}</p>
            {onboarding.status === 'PENDING' && onboarding.deliveryStatus !== 'SENT' && <p className="wp-alert-danger">Email delivery was not confirmed. Check SMTP and resend a new invitation.</p>}
            {onboarding.status === 'PENDING' && <OrganizationInvitationControls organizationId={id} resendKey={randomUUID()} revokeKey={randomUUID()}/>}
          </> : registration?.verifiedAt ? <>
            <p className="text-xs text-[#71818e]">Self-service registration</p><p className="break-all font-semibold">{registration.email}</p>
            <p className="text-xs text-[#687783]">Verified on {registration.verifiedAt.toISOString().slice(0, 10)}</p>
          </> : <div className="platform-muted-box">This existing organization was created before platform onboarding tracking. Its current HR accounts are unchanged.</div>}
        </div>
      </section>
      <section className="platform-card">
        <div className="platform-card-header"><div><h2 className="platform-card-title">Recent platform changes</h2><p className="platform-card-description">This organization's recorded administrative actions</p></div><CalendarDays size={18} color="#167d77"/></div>
        <div className="px-6 pb-5">
          {audits.length ? <ul className="divide-y divide-[#edf0ef]">{audits.map(audit => <li key={audit.id} className="py-3">
            <p className="text-xs font-semibold">{audit.action.replaceAll('_',' ').toLowerCase()}</p>
            <time dateTime={audit.createdAt.toISOString()} className="mt-1 block text-[11px] text-[#7f8c97]">{audit.createdAt.toISOString().slice(0, 16).replace('T',' ')} UTC</time>
          </li>)}</ul> : <p className="platform-muted-box">No recorded platform changes for this workspace.</p>}
          <div className="mt-5 flex gap-2 text-xs text-[#697887]"><LockKeyhole size={16} className="shrink-0"/> Platform administrators cannot access employee salaries, documents or applicant data from this page.</div>
        </div>
      </section>
    </div>
  </div>;
}
