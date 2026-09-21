import { Role } from '@prisma/client';
import { notFound } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { getOrganizationBranding } from '@/features/organization-branding/read-model';
import { BrandingSettingsForm } from '@/components/organization-branding/BrandingSettingsForm';

export default async function OrganizationSettingsPage() {
  const user = await requireBackOfficeContext();
  if (user.role !== Role.ORGANIZATION_ADMIN && user.role !== Role.HR_ADMIN) notFound();
  const branding = await getOrganizationBranding(user.organizationId); if (!branding) notFound();
  return <div className="space-y-8"><header className="border-b pb-6"><p className="wp-eyebrow">Administration</p><h1 className="wp-page-title mt-2">Organization settings</h1><p className="mt-3 max-w-2xl text-sm text-[var(--wp-text-muted)]">Control the trusted identity shown across your tenant workspace. Canonical name, workspace slug, and timezone remain governed by organization records.</p></header><BrandingSettingsForm branding={branding} /></div>;
}
