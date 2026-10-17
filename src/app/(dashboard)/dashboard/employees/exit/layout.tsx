import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageSeparation } from '@/lib/permissions/rbac';
import { notFound } from 'next/navigation';

export default async function ExitLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireBackOfficeContext();
  if (!canManageSeparation(actor)) notFound();
  return <div className="space-y-5">{children}</div>;
}
