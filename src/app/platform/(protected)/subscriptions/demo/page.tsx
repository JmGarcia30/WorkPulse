import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { SubscriptionDemo } from '@/features/platform-admin/subscription-demo';
export default async function SubscriptionDemoPage() {
  await requirePlatformAdministrator();
  return <SubscriptionDemo />;
}
