import { requirePlatformHost } from '@/features/platform-admin/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Platform administration | WorkPulse', robots: { index: false, follow: false } };

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformHost();
  return <div className="min-h-screen">{children}</div>;
}
