import { requireRequestTenant } from '@/lib/tenant/server';
import { OrganizationAdministratorActivationForm } from '@/features/platform-admin/onboarding-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activate HR administrator | WorkPulse', referrer: 'no-referrer', robots: { index: false, follow: false } };

export default async function OrganizationAdministratorActivationPage() {
  const tenant = await requireRequestTenant();
  return <main className="mx-auto w-full max-w-md space-y-5 px-5 py-12"><p className="wp-eyebrow">{tenant.displayName}</p><h1 className="wp-page-title">Activate your HR administrator account</h1><OrganizationAdministratorActivationForm /></main>;
}
