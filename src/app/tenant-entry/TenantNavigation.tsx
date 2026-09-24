'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OrganizationBrandingView } from '@/features/organization-branding/read-model';
import { TenantLogo } from '@/components/layout/TenantLogo';
import styles from './tenant-entry.module.css';

export function TenantNavigation({ branding, careersEnabled, navigationName }: {
  branding: OrganizationBrandingView;
  careersEnabled: boolean;
  navigationName?: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById('tenant-nav-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
      <div className={styles.headerInner}>
        <Link href="#top" className={styles.identity} aria-label={`${branding.displayName} home`}>
          <TenantLogo branding={branding} size={48} className={styles.logo} fallbackClassName={styles.logoFallback} priority />
          <span>{navigationName || branding.displayName}</span>
        </Link>
        <nav className={styles.navigation} aria-label="Tenant navigation">
          <Link href="#top" className={styles.homeLink}>Home</Link>
          <Link href="#announcements">Announcements</Link>
          {careersEnabled && <Link href="#careers">Careers</Link>}
          <Link href="/login" className={styles.navLogin}>Log In</Link>
        </nav>
      </div>
    </header>
  );
}
