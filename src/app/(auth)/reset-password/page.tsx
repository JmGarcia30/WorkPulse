import { TenantAccountAccessShell } from '@/components/auth/TenantAccountAccessShell';
import { requireRequestTenant, requestWorkspacePath } from '@/lib/tenant/server';
import { ResetPasswordForm } from '@/features/account-security/recovery-forms';

export const metadata = { title: 'Reset password | WorkPulse', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function ResetPasswordPage() {
  const tenant = await requireRequestTenant();
  return (
    <TenantAccountAccessShell
      tenant={tenant}
      title="Reset password"
      description="Set a new password for your organization account."
      eyebrow="Secure account recovery"
      backHref={await requestWorkspacePath('/login')}
    >
      <ResetPasswordForm />
    </TenantAccountAccessShell>
  );
}
