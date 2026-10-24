import Link from 'next/link';
import { requireRegistrationHost } from '@/features/company-registration/host';
import { discoveryOrigin } from '@/lib/tenant/host';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create your company workspace | WorkPulse', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function RegistrationLayout({ children }: { children: React.ReactNode }) {
  await requireRegistrationHost();
  return <main className="mx-auto w-full max-w-lg px-5 py-10 sm:py-16">
    <Link href="/" className="wp-eyebrow">WorkPulse</Link>
    <section className="wp-card my-6 space-y-6 p-5 sm:p-8">{children}</section>
    <p className="text-center text-sm">Already have a workspace? <a className="underline" href={discoveryOrigin()}>Find your workspace and sign in</a></p>
  </main>;
}
