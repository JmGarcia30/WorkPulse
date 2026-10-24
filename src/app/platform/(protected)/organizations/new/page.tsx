import { randomUUID } from 'node:crypto';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { CreateOrganizationForm } from '@/features/platform-admin/onboarding-forms';

export default async function CreateOrganizationPage() {
  await requirePlatformAdministrator();
  return <><h1 className="wp-page-title">Create organization</h1><CreateOrganizationForm requestKey={randomUUID()} /></>;
}
