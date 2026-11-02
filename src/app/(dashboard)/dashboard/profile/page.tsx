import { notFound } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { OwnProfileForms } from '@/features/account-security/profile-forms';

export default async function MyProfilePage() {
  const user = await requireBackOfficeContext();
  if (!['HR_ADMIN', 'ORGANIZATION_ADMIN'].includes(user.role)) notFound();
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">My Profile</h1>
    <section className="wp-card space-y-2 break-words p-6" aria-label="Your account">
      <p><strong>Name:</strong> {user.name}</p><p><strong>Email:</strong> {user.email}</p><p><strong>Role:</strong> {user.role.replaceAll('_', ' ')}</p>
      <p className="text-sm text-slate-600">Your email and role are managed by your organization and cannot be changed here.</p>
    </section>
    <OwnProfileForms name={user.name} />
  </div>;
}
