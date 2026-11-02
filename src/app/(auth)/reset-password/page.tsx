import Link from 'next/link';
import { requireRequestTenant, requestWorkspacePath } from '@/lib/tenant/server';
import { ResetPasswordForm } from '@/features/account-security/recovery-forms';
export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default async function ResetPasswordPage() {
  await requireRequestTenant();
  return <main className="mx-auto w-full max-w-lg space-y-6 px-5 py-12"><h1 className="text-2xl font-bold">Reset password</h1><ResetPasswordForm /><Link className="underline" href={await requestWorkspacePath('/login')}>Back to sign in</Link></main>;
}
