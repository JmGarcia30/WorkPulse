import Link from 'next/link';
import type { ReactNode } from 'react';
import { TenantLogo } from '@/components/layout/TenantLogo';
import { TenantTheme } from '@/components/layout/TenantTheme';
import type { OrganizationBrandingView } from '@/features/organization-branding/read-model';
import styles from '@/app/(auth)/login/login.module.css';

type Props = {
  tenant: OrganizationBrandingView;
  title: string;
  description: string;
  eyebrow: string;
  backHref: string;
  children: ReactNode;
};

export function TenantAccountAccessShell({ tenant, title, description, eyebrow, backHref, children }: Props) {
  return (
    <TenantTheme branding={tenant} className={styles.theme}>
      <main className={styles.page}>
        <section className={styles.identityPanel} aria-label={`${tenant.displayName} identity`}>
          <div className={styles.identityTop}>
            <TenantLogo branding={tenant} size={128} className={styles.crest} fallbackClassName={styles.crestFallback} priority />
            <p>{tenant.displayName}</p>
          </div>
          <div className={styles.identityCopy}>
            <span>Secure organization workspace</span>
            <h1>People operations and employee services, securely connected.</h1>
            {tenant.tagline && <p>{tenant.tagline}</p>}
          </div>
          <p className={styles.powered}>Powered by <strong>WorkPulse</strong></p>
        </section>
        <section className={styles.formSide}>
          <div className={styles.formPanel}>
            <div className={styles.mobileIdentity}>
              <TenantLogo branding={tenant} size={76} className={styles.mobileCrest} fallbackClassName={styles.mobileCrestFallback} priority />
              <span>{tenant.displayName}</span>
            </div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h2>{title}</h2>
            <p className={styles.formIntro}>{description}</p>
            <div className={styles.accessForm}>{children}</div>
            <Link href={backHref} className={styles.backLink}>Back to sign in</Link>
          </div>
        </section>
      </main>
    </TenantTheme>
  );
}
