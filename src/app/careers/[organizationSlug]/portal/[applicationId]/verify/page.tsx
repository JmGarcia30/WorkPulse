import { VerifyCandidateEmail } from '@/components/careers/VerifyCandidateEmail';
export const metadata = { title: 'Verify application | WorkPulse', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default async function Page({ params }: { params: Promise<{ organizationSlug: string; applicationId: string }> }) {
  const { organizationSlug, applicationId } = await params;
  return <VerifyCandidateEmail slug={organizationSlug} id={applicationId} />;
}
