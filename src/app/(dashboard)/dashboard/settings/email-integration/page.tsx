import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requestWorkspacePath } from '@/lib/tenant/server';
import { prisma } from '@/lib/db/prisma';
import { requireEmailAdministrator } from '@/features/email-integration/authorization';
import { integrationStatus } from '@/features/email-integration/service';
import { googleConfigured } from '@/features/email-integration/google';
import { emailMessage } from '@/features/email-integration/messages';
import { EmailIntegrationControls, SagaRecruitmentSenderControls } from '@/features/email-integration/forms';

export default async function EmailIntegrationPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  let actor; try { actor = await requireEmailAdministrator(); } catch { notFound(); }
  const { legacySaga, connection } = await integrationStatus(prisma, actor), configured = googleConfigured(), query = await searchParams;
  return <div className="max-w-2xl space-y-6"><header className="space-y-2"><p className="wp-eyebrow">Settings</p><h1 className="wp-page-title">Email Integration</h1><p className="text-sm text-[var(--wp-text-muted)]">Send recruitment notifications from your organization’s own Gmail or Google Workspace account.</p></header>
    <section className="wp-card space-y-5 p-5 sm:p-6">
      <Link className="wp-button-secondary" href={await requestWorkspacePath('/dashboard/settings/email-integration/templates')}>Preview HR email templates</Link>
      {legacySaga && <div className="space-y-2 text-sm"><p><strong>Recruitment sender:</strong> {connection?.recruitmentGmailActive ? 'SAGA verified Gmail connection' : 'Existing SAGA sender'}</p><p>Connecting or testing Gmail does not change SAGA’s recruitment sender. Test this connection successfully, then explicitly activate it below. Reconnecting or disconnecting returns recruitment to the existing SAGA sender.</p></div>}
        <dl className="space-y-3 text-sm"><div><dt className="font-semibold">Connection status</dt><dd>{connection?.status.replaceAll('_', ' ') || 'DISCONNECTED'}</dd></div>{connection?.email && <div><dt className="font-semibold">Connected account</dt><dd className="break-all">{connection.email}</dd></div>}{connection?.lastSentAt && <div><dt className="font-semibold">Last successful send</dt><dd>{connection.lastSentAt.toISOString()}</dd></div>}</dl>
        {connection?.testedAt && <p className="text-sm">Current connection tested successfully: {connection.testedAt.toISOString()}</p>}
        {!configured && <p role="status">{emailMessage('SETUP_REQUIRED')}</p>}
        {query.email && (query.email !== 'CONNECTED' || connection?.status === 'CONNECTED') && <p role="status">{emailMessage(query.email)}</p>}
        {connection?.lastError && <p role="alert" className="wp-alert-danger">{emailMessage(connection.lastError)}</p>}
        {connection?.retryAt && <p className="text-sm">Next send can be attempted after {connection.retryAt.toISOString()}.</p>}
        <EmailIntegrationControls configured={configured} connected={!!connection?.email} />
        {legacySaga && <SagaRecruitmentSenderControls active={!!connection?.recruitmentGmailActive} canActivate={!!connection?.testedAt && connection.status === 'CONNECTED'} />}
    </section><p className="text-sm text-[var(--wp-text-muted)]">WorkPulse requests send-email access and verified email identity. It cannot read your inbox. Never enter a Gmail password or App Password here. WorkPulse registration, verification, and invitation messages continue to use the platform sender.</p>
  </div>;
}
