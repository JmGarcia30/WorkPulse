import { PlatformLoginForm } from '@/features/platform-admin/forms';

export default function PlatformLoginPage() {
  return <main className="mx-auto max-w-md px-5 py-16">
    <p className="wp-eyebrow">WorkPulse platform</p>
    <h1 className="wp-page-title mt-3 mb-4">Administrator sign-in</h1>
    <p className="mb-8 text-sm text-[var(--wp-text-muted)]">For provisioned platform administrators. Organization accounts use their workspace sign-in.</p>
    <PlatformLoginForm />
  </main>;
}
