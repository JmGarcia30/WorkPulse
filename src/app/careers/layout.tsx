import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { resolveRequestTenant } from '@/lib/tenant/server';
import { TenantLogo } from '@/components/layout/TenantLogo';
import { TenantTheme } from '@/components/layout/TenantTheme';
import styles from './careers.module.css';

export default async function CareersLayout({ children }: { children: React.ReactNode }) {
  const tenant = await resolveRequestTenant();
  const content = (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/careers" className={styles.brand}>
            {tenant ? (
              <TenantLogo branding={tenant} size={48} className={styles.logo} fallbackClassName={styles.logoFallback} />
            ) : (
              <span className={styles.workPulseMark}><Briefcase size={18} /></span>
            )}
            <span><strong>{tenant ? tenant.displayName : 'WorkPulse Careers'}</strong><small>{tenant ? 'Official career portal' : 'Organization career portals'}</small></span>
          </Link>
          <Link href={tenant ? '/' : '/'} className={styles.workspaceLink}>{tenant ? 'Workspace Home' : 'WorkPulse Home'}</Link>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <span>{tenant?.displayName || 'WorkPulse Careers'}</span>
        <span>Powered by <strong>WorkPulse</strong></span>
      </footer>
    </div>
  );

  return tenant ? <TenantTheme branding={tenant}>{content}</TenantTheme> : content;
}
