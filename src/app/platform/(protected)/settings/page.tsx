import { UserRound, ShieldCheck } from 'lucide-react';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { PlatformAccountForm } from '@/features/platform-admin/forms';

export default async function PlatformSettingsPage() {
  const administrator = await requirePlatformAdministrator();
  return <div className="platform-section-gap">
    <div><p className="platform-eyebrow">Account & Security</p><h1 className="platform-title">My Account</h1><p className="platform-description">Update your platform administrator profile or change the password used to sign in.</p></div>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
      <section className="platform-card p-6">
        <div className="mb-6 flex items-center gap-3"><div className="platform-stat-icon"><UserRound size={19}/></div><div><h2 className="platform-card-title">Profile & password</h2><p className="platform-card-description">Changes here apply only to your platform account.</p></div></div>
        <PlatformAccountForm name={administrator.name} email={administrator.email}/>
      </section>
      <aside className="platform-card p-6"><div className="platform-stat-icon mb-4"><ShieldCheck size={19}/></div><h2 className="platform-card-title">Account security</h2><p className="platform-card-description mt-3">Use a unique password that you do not share with employee testing accounts.</p>
        <div className="platform-muted-box mt-5">Changing your password signs out all existing platform sessions. Organization HR credentials remain separate.</div>
      </aside>
    </div>
  </div>;
}
