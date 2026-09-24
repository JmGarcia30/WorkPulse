import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { TenantLoginForm } from '@/components/auth/TenantLoginForm';
import { TenantLogo } from '@/components/layout/TenantLogo';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { resolveRequestTenant } from '@/lib/tenant/server';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/routing';
import styles from './login.module.css';

export default async function LoginPage() {
  const tenant = await resolveRequestTenant();
  if (!tenant) notFound();
  const session = await getSession();
  if (session?.organizationId === tenant.organizationId) redirect(landingPathForRole(session.role));

  return (
    <TenantTheme branding={tenant} className={styles.theme}>
      <main className={styles.page}>
        <section className={styles.identityPanel} aria-label={`${tenant.displayName} identity`}>
          <div className={styles.identityTop}>
            <TenantLogo branding={tenant} size={128} className={styles.crest} fallbackClassName={styles.crestFallback} priority />
            <p>{tenant.displayName}</p>
          </div>
          <div className={styles.identityCopy}>
            <span>Organization workspace</span>
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
            <p className={styles.eyebrow}>Secure workspace</p>
            <h2>Welcome back</h2>
            <p className={styles.formIntro}>Sign in to your organization workspace.</p>
            <TenantLoginForm />
            <Link href="/" className={styles.backLink}>Back to SAGA workspace</Link>
          </div>
        </section>
      </main>
    </TenantTheme>
  );
}
