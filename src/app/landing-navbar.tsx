'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Menu } from 'lucide-react';
import styles from './landing.module.css';

export function LandingNavbar({ workspaceUrl }: { workspaceUrl: string }) {
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('hero');
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting), { rootMargin: '-68px 0px 0px 0px', threshold: 0 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <header className={`${styles.header} ${pastHero ? styles.headerScrolled : ''}`}>
      <div className={styles.navbar}>
        <Link href="/" className={styles.brand} aria-label="WorkPulse home">
          <Image
            src="/branding/workpulse-logo.png?v=trans-2"
            alt="WorkPulse"
            width={160}
            height={28}
            className={styles.brandLogoImg}
            unoptimized
            priority
          />
        </Link>
        <nav aria-label="Primary navigation" className={styles.desktopNav}>
          <Link href="#features">Features</Link>
          <Link href="#lifecycle">Lifecycle</Link>
          <Link href="#modules">Modules</Link>
          <Link href="#security">Security</Link>
        </nav>
        <div className={styles.navActions}>
          <a href={workspaceUrl} className={styles.navGhostBtn}>Find Workspace / Sign In</a>
          <Link href="/request-demo" className={styles.navPrimaryBtn}>
            <span>Request Demo</span>
            <ArrowRight size={14} />
          </Link>
        </div>
        <details className={styles.mobileMenu}>
          <summary aria-label="Toggle navigation menu"><Menu size={20} /></summary>
          <nav aria-label="Mobile navigation" className={styles.mobilePanel}>
            <Link href="#features">Features</Link>
            <Link href="#lifecycle">Lifecycle</Link>
            <Link href="#modules">Modules</Link>
            <Link href="#security">Security</Link>
            <a href={workspaceUrl}>Find Workspace / Sign In</a>
            <Link href="/request-demo" className={styles.mobilePanelPrimary}>Request Demo</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
