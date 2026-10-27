import Link from 'next/link';
import { Role } from '@prisma/client';
import { notFound } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { getRequestOrganizationBranding, requestWorkspacePath } from '@/lib/tenant/server';
import { BrandingSettingsForm } from '@/components/organization-branding/BrandingSettingsForm';

export default async function WorkspaceSetupPage() {
  const user = await requireBackOfficeContext();
  if (user.role !== Role.HR_ADMIN && user.role !== Role.ORGANIZATION_ADMIN) notFound();
  const branding = await getRequestOrganizationBranding(user.organizationId);
  if (!branding) notFound();
  const complete = branding.primary !== '#17324D' || branding.accent !== '#167D77' || branding.displayName !== branding.canonicalName;
  return <div className="mx-auto max-w-5xl space-y-8">
    <header className="space-y-3 border-b pb-6">
      <p className="wp-eyebrow">Workspace setup</p>
      <h1 className="wp-page-title">Make WorkPulse yours.</h1>
      <p className="max-w-2xl text-sm text-[var(--wp-text-muted)]">Set your organization's display name, tagline, primary and accent colors, contact details, and logo. These settings belong only to your workspace and can be updated later.</p>
      <p className="text-sm">Your workspace: <strong>{branding.canonicalName}</strong></p>
      <div className="flex flex-wrap gap-3">
        <Link href={await requestWorkspacePath('/')} className="wp-button-secondary">Preview public workspace</Link>
        <Link href={await requestWorkspacePath('/dashboard/organization')} className="wp-button-secondary">Organization settings</Link>
        <Link href={await requestWorkspacePath('/dashboard')} className="wp-button-primary">Continue to HR dashboard</Link>
      </div>
      {!complete && <p className="text-sm text-[var(--wp-text-muted)]">Save the organization details below before continuing to your dashboard. The logo and login image can be added separately.</p>}
    </header>
    <BrandingSettingsForm branding={branding} />
  </div>;
}
