import { notFound } from 'next/navigation';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { organizationMetadata } from '@/features/platform-admin/service';
import { prisma } from '@/lib/db/prisma';
import { randomUUID } from 'node:crypto';
import { OrganizationInvitationControls } from '@/features/platform-admin/onboarding-forms';

export default async function PlatformOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdministrator();
  const { id } = await params;
  const org = await prisma.organization.findUnique({ where: { id }, select: organizationMetadata });
  if (!org) notFound();
  const [onboarding, contact, audits, registration] = await Promise.all([
    prisma.organizationAdministratorInvitation.findUnique({ where: { organizationId: id }, select: { email: true, status: true, deliveryStatus: true, expiresAt: true, lastIssuedAt: true, activatedAt: true, revokedAt: true } }),
    prisma.organization.findUnique({ where: { id }, select: { contactEmail: true } }),
    prisma.platformOrganizationAudit.findMany({ where: { organizationId: id }, select: { id: true, action: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 15 }),
    prisma.companyRegistration.findUnique({ where: { organizationId: id }, select: { email: true, verifiedAt: true } }),
  ]);
  return <><h1 className="wp-page-title">{org.name}</h1><dl className="wp-card grid gap-5 p-6 sm:grid-cols-2">
    {Object.entries({ 'Organization ID': org.id, Slug: org.slug, 'Career portal status': org.careersEnabled ? 'Enabled' : 'Disabled', 'Time zone': org.timeZone, Registered: org.createdAt.toISOString().slice(0, 10) }).map(([label, value]) => <div key={label}><dt className="text-sm text-[var(--wp-text-muted)]">{label}</dt><dd className="mt-1 break-all font-medium">{value}</dd></div>)}
  </dl><p className="text-sm text-[var(--wp-text-muted)]">Employee, applicant, payroll and document records require separate workspace authorization.</p>
  <section className="wp-card space-y-4 p-6"><h2 className="wp-section-title">Organization onboarding</h2>
    <p className="text-sm">Contact email: {contact?.contactEmail ?? 'Not recorded for this existing organization'}</p>
    {onboarding ? <>
      <p className="text-sm break-all">Initial HR administrator: {onboarding.email}</p>
      <p className="text-sm">Invitation: {onboarding.status === 'PENDING' && onboarding.expiresAt <= new Date() ? 'EXPIRED (pending renewal)' : onboarding.status}</p>
      <p className="text-sm">Email ownership: {onboarding.activatedAt ? `Confirmed by activation on ${onboarding.activatedAt.toISOString()}` : 'Not verified — activation required'}</p>
      <p className="text-sm">Last invitation delivery: {onboarding.deliveryStatus}. Expires: {onboarding.expiresAt.toISOString()}</p>
      {onboarding.status === 'PENDING' && onboarding.deliveryStatus !== 'SENT' && <p className="wp-alert-danger">Delivery is failed, pending or unconfirmed. Configure SMTP and resend to issue a new link. Existing links are never displayed here.</p>}
      {onboarding.status === 'PENDING' && <OrganizationInvitationControls organizationId={id} resendKey={randomUUID()} revokeKey={randomUUID()} />}
    </> : registration?.verifiedAt ? <><p className="text-sm">Self-service company registration</p><p className="text-sm break-all">Initial HR administrator: {registration.email}</p><p className="text-sm">Email verified on {registration.verifiedAt.toISOString()}</p></> : <p className="text-sm">Existing organization — onboarding was not tracked through this workflow. Existing accounts are unchanged.</p>}
    <p className="text-sm text-[var(--wp-text-muted)]">Onboarding and career portal status are independent. No subscription or suspension status is assigned.</p>
  </section>
  {audits.length > 0 && <section className="wp-card space-y-3 p-6"><h2 className="wp-section-title">Recent onboarding activity</h2><ul className="space-y-2 text-sm">{audits.map(audit => <li key={audit.id}>{audit.action} · {audit.createdAt.toISOString()}</li>)}</ul></section>}
  </>;
}
