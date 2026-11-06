import Link from 'next/link';
import { ShieldCheck, LogOut } from 'lucide-react';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { platformLogoutAction } from '@/features/platform-admin/actions';
import { PlatformNavigation } from '@/features/platform-admin/platform-navigation';
import './platform-admin.css';

export default async function ProtectedPlatformLayout({ children }: { children: React.ReactNode }) {
  const administrator = await requirePlatformAdministrator();
  const initials = administrator.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
  return <div className="wp-platform-shell">
    <aside className="wp-platform-sidebar">
      <Link href="/platform" className="wp-platform-brand">
        <span className="wp-platform-brandmark" aria-hidden="true"><ShieldCheck size={24} strokeWidth={2}/></span>
        <span><span className="wp-platform-brand-title">WorkPulse</span><span className="wp-platform-brand-subtitle">Platform Admin</span></span>
      </Link>
      <PlatformNavigation />
      <div className="wp-platform-sidebar-note">
        <ShieldCheck size={17} aria-hidden="true"/>
        <span>Organization oversight only. Employee and payroll records remain private to each workspace.</span>
      </div>
    </aside>
    <div className="wp-platform-main">
      <header className="wp-platform-topbar">
        <div><p className="wp-platform-topbar-caption">WORKPULSE / ADMINISTRATION</p><p className="wp-platform-topbar-title">Platform control center</p></div>
        <div className="wp-platform-topbar-actions">
          <div className="wp-platform-user">
            <div><p className="wp-platform-user-name">{administrator.name}</p><p className="wp-platform-user-role">System Administrator</p></div>
            <span className="wp-platform-avatar" aria-hidden="true">{initials || 'SA'}</span>
          </div>
          <form action={platformLogoutAction}>
            <button type="submit" className="wp-platform-signout"><LogOut size={15} aria-hidden="true"/> Sign out</button>
          </form>
        </div>
      </header>
      <main className="wp-platform-content">{children}</main>
    </div>
  </div>;
}
