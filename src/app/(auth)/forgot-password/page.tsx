import Link from 'next/link';
import { requireRequestTenant, requestWorkspacePath } from '@/lib/tenant/server';
import { ForgotPasswordForm } from '@/features/account-security/recovery-forms';
export default async function ForgotPasswordPage() {
  await requireRequestTenant();
  return <main className="mx-auto w-full max-w-lg space-y-6 px-5 py-12"><h1 className="text-2xl font-bold">Forgot password</h1><p>Request recovery for your HR or employee account in this workspace.</p><ForgotPasswordForm /><Link className="underline" href={await requestWorkspacePath('/login')}>Back to sign in</Link></main>;
}
