import Link from 'next/link';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { platformLogoutAction } from '@/features/platform-admin/actions';

export default async function ProtectedPlatformLayout({ children }: { children: React.ReactNode }) {
  const administrator = await requirePlatformAdministrator();
  return <>
    <header className="border-b bg-white px-5 py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
      <Link className="font-semibold" href="/platform">WorkPulse · Platform administration</Link>
      <nav aria-label="Platform administration" className="flex flex-wrap items-center gap-5 text-sm">
        <Link href="/platform">Organizations</Link><Link href="/platform/settings">My account</Link>
        <form action={platformLogoutAction}><button className="wp-button-secondary">Sign out</button></form>
      </nav>
    </div></header>
    <main className="mx-auto w-full max-w-6xl space-y-6 px-5 py-8">
      <p className="text-sm text-[var(--wp-text-muted)]">Signed in as {administrator.name}. Platform access covers organization metadata only.</p>
      {children}
    </main>
  </>;
}
