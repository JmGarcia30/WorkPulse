import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { getBackOfficeReadContext } from '@/lib/auth/guards';
import { listHrNotifications } from '@/features/hr-notifications/read-model';
import { HrNotificationCenter } from '@/components/hr/HrNotificationCenter';

export default async function HrNotificationsPage() {
  const actor = await getBackOfficeReadContext();
  if (actor.role !== Role.HR_ADMIN && actor.role !== Role.ORGANIZATION_ADMIN) redirect('/dashboard');
  const notifications = await listHrNotifications(actor);
  return <HrNotificationCenter notifications={notifications} />;
}
