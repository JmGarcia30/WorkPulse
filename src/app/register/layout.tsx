import { requireRegistrationHost } from '@/features/company-registration/host';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create your company workspace | WorkPulse', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function RegistrationLayout({ children }: { children: React.ReactNode }) {
  await requireRegistrationHost();
  return <>{children}</>;
}
