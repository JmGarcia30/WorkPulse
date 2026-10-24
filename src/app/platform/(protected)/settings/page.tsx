import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { PlatformAccountForm } from '@/features/platform-admin/forms';

export default async function PlatformSettingsPage() {
  const administrator = await requirePlatformAdministrator();
  return <><h1 className="wp-page-title">My platform account</h1><PlatformAccountForm name={administrator.name} email={administrator.email} /></>;
}
