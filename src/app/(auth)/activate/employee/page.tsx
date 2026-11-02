import type { Metadata } from 'next';
import { ActivationForm } from '@/components/employee-self-service/ActivationForm';
import { TenantAccountAccessShell } from '@/components/auth/TenantAccountAccessShell';
import { requireRequestTenant, requestWorkspacePath } from '@/lib/tenant/server';

export const metadata: Metadata = {
  title: 'Activate WorkPulse Account',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default async function EmployeeActivationPage() {
  const tenant = await requireRequestTenant();
  return (
    <TenantAccountAccessShell
      tenant={tenant}
      title="Activate your account"
      description="Create your password to access employment and attendance information."
      eyebrow="Employee account activation"
      backHref={await requestWorkspacePath('/login')}
    >
      <ActivationForm />
    </TenantAccountAccessShell>
  );
}
