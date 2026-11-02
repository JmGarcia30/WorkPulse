import { requireRequestTenant, requestWorkspacePath } from '@/lib/tenant/server';
import { TenantAccountAccessShell } from '@/components/auth/TenantAccountAccessShell';
import { OrganizationAdministratorActivationForm } from '@/features/platform-admin/onboarding-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activate HR administrator | WorkPulse', referrer: 'no-referrer', robots: { index: false, follow: false } };

export default async function OrganizationAdministratorActivationPage() {
  const tenant = await requireRequestTenant();
  return (
    <TenantAccountAccessShell
      tenant={tenant}
      title="Activate your account"
      description="Complete your HR administrator account setup to access your organization workspace."
      eyebrow="Secure account activation"
      backHref={await requestWorkspacePath('/login')}
    >
      <OrganizationAdministratorActivationForm />
    </TenantAccountAccessShell>
  );
}
