import { TenantAccountAccessShell } from '@/components/auth/TenantAccountAccessShell';
import { requireRequestTenant, requestWorkspacePath } from '@/lib/tenant/server';
import { ForgotPasswordForm } from '@/features/account-security/recovery-forms';

export const metadata = { title: 'Forgot password | WorkPulse', robots: { index: false, follow: false } };

export default async function ForgotPasswordPage() {
  const tenant = await requireRequestTenant();
  return (
    <TenantAccountAccessShell
      tenant={tenant}
      title="Forgot password?"
      description="Enter your HR or employee account email to request a secure password reset link."
      eyebrow="Account recovery"
      backHref={await requestWorkspacePath('/login')}
    >
      <ForgotPasswordForm />
    </TenantAccountAccessShell>
  );
}
